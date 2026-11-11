/* 검사 방식의 정확성 (IA) : 일부러 넣은 결함을 기존 기능 테스트가 정말 잡는지 본다

   판정 규칙
   1. 기준선 먼저 : 같은 파일 · 같은 테스트를 결함 없이(MUTANT_KIND=baseline) 돌려 통과해야 결함 실행 결과를 센다
      (원래 구현이 이미 실패하는 테스트라면, 결함을 넣었을 때의 실패는 결함 탐지가 아니다)
   2. 구조화된 결과로 판정 : 사람이 읽는 출력(tap · spec)의 글자 대신 selfcheck/ia-reporter.js 가 내보낸
      테스트 이름 · 실패 종류 · 오류 코드 · 비교 연산 · 메시지 첫 줄을 본다
      (기본 출력 형식은 Node 23 에서 tap → spec 으로 바뀌었고, Assertion 메시지 뒤에 붙는 비교 내용도 버전마다 다르다)
   3. 고정 표식으로 Assertion 식별 : 목표 Assertion 메시지 맨 앞에 [IA:M-29:value] 같은 표식을 두고,
      표식 + 비교 연산으로 "기대한 그 Assertion" 인지 본다. 표식 뒤 설명 문구는 고쳐도 판정이 깨지지 않는다
   4. 판정 불가 구분 : 목표 테스트가 안 돌았거나 · 중복 · 건너뜀 · todo 면 "못 잡음" 이 아니라 판정 불가(undecidable)
   5. 범위 : 결함 하나를 미리 정한 테스트 하나에 연결해 본다. 여기서 통과했다고 다른 결함 · 다른 테스트 ·
      다른 Adapter 에서도 맞다는 뜻은 아니다. IA-07 은 정상 변형 하나 · 모듈 테스트 · IA_ADAPTERS 에 넣은 Adapter 에 한정된다

   판정 함수는 selfcheck/ia-judge.js 에 있고, 판정기 자체는 selfcheck/ia-judge.test.js (IJ) 가 가짜 결과로 검사한다 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { MARK } = require('./ia-reporter');
const J = require('./ia-judge');

const ROOT = path.resolve(__dirname, '..');
const BASE_ADAPTER = process.env.ADAPTER;
const MUTANT_ADAPTER = path.join(ROOT, 'selfcheck', 'inspection-mutant-adapter.js');
const REPORTER = pathToFileURL(path.join(ROOT, 'selfcheck', 'ia-reporter.js')).href;
const RUN_TIMEOUT_MS = Number(process.env.IA_TIMEOUT_MS) || 30_000;

/* IA-07 을 돌릴 Adapter 목록. IA_ADAPTERS 에 경로를 구분자(Windows ';' · 그 밖 ':')로 이어 적는다. 없으면 ADAPTER 하나 */
const IA07_ADAPTERS = (process.env.IA_ADAPTERS || BASE_ADAPTER || '')
  .split(path.delimiter).map((p) => p.trim()).filter(Boolean);

/* 결함이 걸려야 하는 테스트와, 그 테스트 안의 어느 Assertion 이어야 하는지
   - tag : 그 Assertion 메시지 맨 앞의 고정 표식 (tests/*.test.js 에 적혀 있다)
   - operator : 비교 연산 (assert/strict 의 equal → strictEqual) */
const TARGET = {
  'M-02': { file: 'tests/module.test.js', id: 'M-02', evidence: { operator: 'strictEqual', tag: 'IA:M-02:no-mutation' } },
  'M-29': { file: 'tests/module.test.js', id: 'M-29', evidence: { operator: 'strictEqual', tag: 'IA:M-29:value' } },
  'M-34': { file: 'tests/module.test.js', id: 'M-34', evidence: { operator: 'strictEqual', tag: 'IA:M-34:no-change' } },
  'P-03': { file: 'tests/page.test.js', id: 'P-03', evidence: { operator: 'strictEqual', tag: 'IA:P-03:result' } },
  'P-08': { file: 'tests/page.test.js', id: 'P-08', evidence: { operator: 'strictEqual', tag: 'IA:P-08:back' } },
};

/* 테스트 파일 하나를 결함 Adapter 로 따로 실행하고 결과를 돌려주는 함수
   kind = 'baseline' 이면 결함 없이 원래 구현 그대로 돈다. id 를 주면 그 테스트 하나만 돈다 */
function runSuite(kind, file, id, adapter) {
  assert.ok(adapter, 'ADAPTER 환경 변수에 실제 구현 Adapter 경로가 필요하다');
  const args = [
    '--test',
    // 판정용 : 구조화된 결과 (stdout)
    `--test-reporter=${REPORTER}`, '--test-reporter-destination=stdout',
    // 사람이 읽는 출력 : 판정에는 쓰지 않고, 실패했을 때 원인을 보여 주는 데만 쓴다 (stderr)
    '--test-reporter=spec', '--test-reporter-destination=stderr',
  ];
  if (id) args.push('--test-name-pattern', `^\\[${id}\\]`);
  args.push(file);
  const childEnv = {
    ...process.env,
    ADAPTER: MUTANT_ADAPTER,
    BASE_ADAPTER: path.resolve(adapter),
    MUTANT_KIND: kind,
  };
  // node:test sets this marker for its own workers; don't pass it to an independent test run.
  delete childEnv.NODE_TEST_CONTEXT;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: ROOT, env: childEnv });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${kind} · ${file} · ${id || '전체'} 실행이 ${RUN_TIMEOUT_MS}ms 안에 끝나지 않았다 (IA_TIMEOUT_MS 로 늘릴 수 있다)`));
    }, RUN_TIMEOUT_MS);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (status, signal) => {
      clearTimeout(timer);
      try {
        resolve({ kind, file, id, adapter, status, signal, results: J.parseResults(stdout, MARK), stderr });
      } catch (error) {
        reject(new Error(`IA reporter 결과를 읽지 못했다 : ${error.message}`));
      }
    });
  });
}

/* 같은 실행은 한 번만 한다 (여러 IA 가 같은 기준선을 쓴다) */
const runs = new Map();
function cachedRun(kind, file, id, adapter = BASE_ADAPTER) {
  const key = [kind, file, id || '*', adapter].join('|');
  if (!runs.has(key)) runs.set(key, runSuite(kind, file, id, adapter));
  return runs.get(key);
}

const tail = (text, n = 3000) => (text.length > n ? `…${text.slice(-n)}` : text);

/* 기준선 → 결함 실행 순서로 돌려 판정하는 함수. 기준선이 통과하지 않으면 결함 실행은 하지 않는다 */
async function assess(kind, target, { baselineKind = 'baseline' } = {}) {
  const baseline = await cachedRun(baselineKind, target.file, target.id);
  const problem = J.checkBaseline(baseline, target.id);
  if (problem) return { verdict: J.miss('baseline-not-passing', problem, true), baseline, mutant: null };
  const mutant = await cachedRun(kind, target.file, target.id);
  return { verdict: J.judgeMutant(mutant, target), baseline, mutant };
}

async function assertCaught(kind, target) {
  const { verdict, baseline, mutant } = await assess(kind, target);
  const shown = mutant || baseline;
  const label = verdict.undecidable ? '판정 불가' : '못 잡음';
  assert.ok(verdict.caught, `[${label} · ${verdict.reason}] ${verdict.detail}\n--- ${shown.kind} 실행 출력 ---\n${tail(shown.stderr)}`);
}

/* IA-07 : Adapter 하나에서 정상 변형이 필수 테스트를 더 실패하는지 비교하는 함수. 문제 목록과 선택 테스트 차이를 돌려준다 */
async function compareNormalVariant(adapter) {
  const file = 'tests/module.test.js';
  const name = path.basename(adapter);
  const [baseline, variant] = await Promise.all([
    cachedRun('baseline', file, null, adapter),
    cachedRun('property-only-form', file, null, adapter),
  ]);
  const b = J.byId(baseline);
  const v = J.byId(variant);
  if (b.size === 0) return { problems: [`${name} : 원래 구현 실행에서 테스트 결과를 하나도 못 읽었다\n${tail(baseline.stderr)}`], optional: [] };
  const problems = [];
  if ([...v.keys()].sort().join() !== [...b.keys()].sort().join()) problems.push(`${name} : 두 실행에서 돈 테스트 목록이 다르다`);
  // M-29 는 폼 값 · 체크를 직접 보는 테스트라 두 실행 모두에서 통과해야 이 비교가 의미가 있다
  if (J.outcome(b, 'M-29') !== 'pass') problems.push(`${name} : 원래 구현이 M-29 를 통과하지 못해 이 비교를 할 수 없다`);
  else if (J.outcome(v, 'M-29') !== 'pass') problems.push(`${name} : 정상 변형이 M-29 에서 실패했다\n${tail(variant.stderr)}`);
  const isOptional = (id) => (b.get(id) || []).some((r) => r.name.includes('[선택]'));
  const regressions = [...b.keys()].filter((id) => J.outcome(b, id) === 'pass' && J.outcome(v, id) !== 'pass');
  const required = regressions.filter((id) => !isOptional(id));
  if (required.length) problems.push(`${name} : 원래 구현은 통과했는데 정상 변형은 실패한 필수 테스트 : ${required.join(', ')}\n${tail(variant.stderr)}`);
  return { problems, optional: regressions.filter(isOptional) };
}

describe('검사 방식의 정확성', { concurrency: 3 }, () => {
  test('[IA-01] update가 아무 작업도 안 하면 M-29의 값 Assertion이 잡는다', async () => {
    await assertCaught('noop-update', TARGET['M-29']);
  });

  test('[IA-02] 내용은 같게 통째로 다시 그리면 M-34의 변경 0건 Assertion이 잡는다', async () => {
    await assertCaught('full-rerender', TARGET['M-34']);
  });

  test('[IA-03] 읽기 함수가 원본 DOM을 바꾸면 M-02의 비변경 Assertion이 잡는다', async () => {
    await assertCaught('mutate-on-read', TARGET['M-02']);
  });

  test('[IA-04] Patch 버튼이 동작하지 않으면 P-03의 결과 비교 Assertion이 잡는다', async () => {
    await assertCaught('noop-patch-button', TARGET['P-03']);
  });

  test('[IA-05] 뒤로가기 버튼이 동작하지 않으면 P-08의 복귀 Assertion이 잡는다', async () => {
    await assertCaught('noop-back-button', TARGET['P-08']);
  });

  test('[IA-06] Adapter 초기화 오류를 결함 탐지 성공으로 오인하지 않는다', async () => {
    const { verdict, mutant } = await assess('setup-error', TARGET['M-29']);
    assert.ok(mutant, `기준선이 통과해야 이 대조를 볼 수 있다 : ${verdict.detail}`);
    // 대조군이 의도대로 만들어졌는지 : 초기화 오류로 실패했어야 한다
    assert.notEqual(mutant.status, 0, '초기화 오류를 넣었는데 실행이 성공했다');
    assert.ok(
      mutant.results.some((r) => r.result === 'fail' && r.error && J.firstLine(r.error.message) === 'intentional selfcheck setup failure'),
      `의도한 초기화 오류가 결과에 없다\n${tail(mutant.stderr)}`,
    );
    assert.equal(verdict.caught, false, '초기화 오류를 결함 탐지로 셌다');
    assert.equal(verdict.reason, 'not-assertion', `다른 이유로 걸러졌다 : ${verdict.detail}`);
  });

  test('[IA-07] 폼 값을 프로퍼티로만 반영하는 변형은 모듈 필수 테스트에서 원래 구현보다 더 실패하지 않는다 (Adapter별)', async (t) => {
    // 범위 : 정상 변형 하나 · tests/module.test.js 전체 · IA_ADAPTERS 의 Adapter 마다 (없으면 ADAPTER 하나)
    // 선택 테스트([선택])는 "판단 필요" 항목이라 차이를 실패로 세지 않고 진단 메시지로만 남긴다
    //   예 : M-41(J9)은 value · checked 속성까지 지우라고 요구해서, 속성을 건드리지 않는 이 설계와 맞지 않는다
    assert.ok(IA07_ADAPTERS.length > 0, 'IA_ADAPTERS 또는 ADAPTER 에 Adapter 경로가 필요하다');
    const reports = await Promise.all(IA07_ADAPTERS.map(async (adapter) => ({ adapter, ...(await compareNormalVariant(adapter)) })));
    for (const { adapter, optional } of reports) {
      t.diagnostic(`${path.basename(adapter)} : 검사함${optional.length ? ` · 선택 테스트에서만 다름 (판단 필요, 실패로 세지 않음) : ${optional.join(', ')}` : ''}`);
    }
    const problems = reports.flatMap((r) => r.problems);
    assert.deepEqual(problems, [], problems.join('\n'));
  });

  test('[IA-08] 원래 구현이 이미 실패하는 테스트는 결함 탐지로 세지 않는다', async () => {
    // 원래 구현이 처음부터 update 를 안 하는 상황을 흉내 낸다 : 기준선 · 결함 실행 모두 noop-update
    const target = TARGET['M-29'];
    const { verdict } = await assess('noop-update', target, { baselineKind: 'noop-update' });
    const mutantOnly = J.judgeMutant(await cachedRun('noop-update', target.file, target.id), target);
    // 기준선을 안 보면 이 결과는 "잡았다" 로 보인다 — 바로 그 경우를 막는지 본다
    assert.equal(mutantOnly.caught, true, `대조군이 의도대로 만들어지지 않았다 : ${mutantOnly.detail}`);
    assert.equal(verdict.caught, false, '원래 구현이 이미 실패하는데 결함 탐지로 셌다');
    assert.equal(verdict.reason, 'baseline-not-passing', `다른 이유로 걸러졌다 : ${verdict.detail}`);
  });
});
