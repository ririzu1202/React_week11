/* IA 판정 로직 : 부수 효과가 없는 순수 함수만 모은다
   inspection.test.js 가 실제 실행 결과에 쓰고, ia-judge.test.js 가 가짜 결과로 판정기 자체를 검사한다

   판정 결과(verdict) 모양 : { caught, reason, detail, undecidable }
   - caught : 기대한 Assertion 이 결함을 잡았는가
   - undecidable : 목표 테스트를 판정할 수 없는 상태 (안 돌았음 · 중복 · 건너뜀 · todo)
     → "못 잡았다" 와 구분한다. 테스트가 결함을 놓친 게 아니라 판정 재료가 없는 것이다 */
'use strict';

const TEST_ID = /^\[([A-Z]+-\d+)\]/;

const firstLine = (text) => String(text ?? '').split(/\r?\n/)[0];
const describeError = (e) => (e ? `${e.failureType} / ${e.name} : ${firstLine(e.message)}` : '오류 정보 없음');
const miss = (reason, detail, undecidable = false) => ({ caught: false, reason, detail, undecidable });

/* reporter 가 stdout 에 쓴 줄에서 테스트별 결과를 꺼내는 함수. 표식이 없는 줄은 무시한다 */
function parseResults(stdout, mark) {
  const results = [];
  for (const line of String(stdout).split(/\r?\n/)) {
    const at = line.indexOf(mark);
    if (at !== -1) results.push(JSON.parse(line.slice(at + mark.length)));
  }
  return results;
}

/* 테스트 이름 맨 앞의 [M-29] 같은 ID. 파일 · 묶음 단위 결과처럼 ID 가 없으면 null */
function idOf(result) {
  const m = TEST_ID.exec((result && result.name) || '');
  return m ? m[1] : null;
}

/* 판정에 세는 결과인가 : 건너뛴 테스트와 todo 테스트는 결과가 있어도 세지 않는다 */
const counts = (r) => !r.skip && !r.todo;

/* 결과를 테스트 ID 별로 묶는 함수. ID 가 없는 결과 · 건너뛴 결과 · todo 결과는 뺀다 */
function byId(run) {
  const map = new Map();
  for (const r of run.results) {
    const id = idOf(r);
    if (!id || !counts(r)) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(r);
  }
  return map;
}

function outcome(map, id) {
  const hits = map.get(id) || [];
  return hits.length === 1 ? hits[0].result : `${hits.length}건 실행`;
}

/* 목표 테스트 결과를 딱 하나 찾는 함수. 못 찾으면 왜 판정할 수 없는지 돌려준다 */
function locate(run, id) {
  const all = run.results.filter((r) => idOf(r) === id);
  const live = all.filter(counts);
  if (live.length === 1) return { hit: live[0] };
  if (live.length > 1) return { problem: miss('target-duplicated', `${id} 가 ${live.length} 번 실행됐다`, true) };
  if (all.some((r) => r.skip)) return { problem: miss('target-skipped', `${id} 가 건너뛰어졌다`, true) };
  if (all.some((r) => r.todo)) return { problem: miss('target-todo', `${id} 가 todo 라서 판정에 세지 않는다`, true) };
  return { problem: miss('target-not-run', `${id} 가 실행되지 않았다`, true) };
}

/* 실패한 Assertion 이 기대한 그 Assertion 인지 확인하는 함수
   - tag : Assertion 메시지 맨 앞의 고정 표식 [IA:M-29:value]. 뒤의 설명 문구는 바뀌어도 된다
   - operator : 비교 연산 (assert/strict 의 equal → strictEqual) */
function matchesEvidence(error, evidence) {
  if (!error) return false;
  if (evidence.operator !== undefined && error.operator !== evidence.operator) return false;
  if (evidence.tag !== undefined && !firstLine(error.message).startsWith(`[${evidence.tag}]`)) return false;
  return true;
}

/* 정상 종료인가 : 숫자 종료 코드가 있고 신호로 끝나지 않았어야 한다
   Node 자식 프로세스가 신호(SIGTERM 등)로 끝나면 종료 코드는 null 이고 signal 에 신호 이름이 온다 */
const exitedNormally = (run) => Number.isInteger(run.status) && (run.signal === null || run.signal === undefined);
const exitText = (run) => (exitedNormally(run) ? `종료 코드 ${run.status}` : `종료 코드 ${run.status} · 신호 ${run.signal}`);

/* 기준선 확인 : 원래 구현으로 목표 테스트가 딱 한 번 돌고 통과했는지. 문제가 있으면 이유 문장을 돌려준다 */
function checkBaseline(run, id) {
  const { hit, problem } = locate(run, id);
  if (problem) return `원래 구현 실행에서 판정할 수 없다 (${problem.reason}) : ${problem.detail}`;
  if (hit.result !== 'pass') return `원래 구현이 이미 ${id} 에서 실패한다 : ${describeError(hit.error)}`;
  if (!exitedNormally(run)) return `원래 구현 실행이 정상 종료되지 않았다 (${exitText(run)})`;
  if (run.status !== 0) return `원래 구현 실행의 종료 코드가 ${run.status} 다`;
  return null;
}

/* 결함 실행 결과만 보고 "기대한 Assertion 이 결함을 잡았나" 를 판정하는 함수 (기준선은 따로 본다) */
function judgeMutant(run, target) {
  const { hit, problem } = locate(run, target.id);
  if (problem) return problem;
  if (hit.result === 'pass') return miss('mutant-passed', `결함을 넣어도 ${target.id} 가 통과했다`);
  const e = hit.error || {};
  if (e.failureType !== 'testCodeFailure' || e.code !== 'ERR_ASSERTION') {
    return miss('not-assertion', `${target.id} 실패가 Assertion 실패가 아니다 : ${describeError(hit.error)}`);
  }
  if (!matchesEvidence(e, target.evidence)) {
    return miss('other-assertion', `${target.id} 에서 기대와 다른 Assertion 이 실패했다 : ${describeError(e)} (operator ${e.operator})`);
  }
  if (!exitedNormally(run)) return miss('abnormal-exit', `실행이 정상 종료되지 않아 결과를 믿을 수 없다 (${exitText(run)})`, true);
  if (run.status === 0) return miss('exit-zero', '실패가 있는데 종료 코드가 0 이다');
  return { caught: true, reason: 'caught', detail: '', undecidable: false };
}

module.exports = {
  TEST_ID, firstLine, describeError, miss,
  parseResults, idOf, byId, outcome, locate, matchesEvidence, exitedNormally, checkBaseline, judgeMutant,
};
