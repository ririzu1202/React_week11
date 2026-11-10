/* 판정기 자체 검사 (IJ) : IA 판정 함수(selfcheck/ia-judge.js)가 결과를 올바로 분류하는지 가짜 실행 결과로 본다
   구현 · Adapter · 자식 프로세스가 필요 없다. 판정기만 바꿨을 때 이것만 빠르게 돌릴 수 있다 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const J = require('./ia-judge');
const { MARK } = require('./ia-reporter');

/* 가짜 결과 만드는 함수들 (ia-reporter.js 가 내보내는 모양과 같다) */
const NAME = '[M-29][정상] 폼 값';
const result = (over) => ({ result: 'pass', name: NAME, nesting: 0, skip: false, todo: false, error: null, ...over });
const assertionError = (message, operator = 'strictEqual') => ({
  failureType: 'testCodeFailure', code: 'ERR_ASSERTION', name: 'AssertionError', message, operator, generatedMessage: false,
});
const failed = (error, over) => result({ result: 'fail', error, ...over });
const run = (results, status = 1, signal = null) => ({ results, status, signal });

const TARGET = { id: 'M-29', evidence: { operator: 'strictEqual', tag: 'IA:M-29:value' } };
const EXPECTED = assertionError("[IA:M-29:value] 글 입력칸 값\n\n'a' !== 'b'");

test('[IJ-01] 기대한 Assertion(표식 + 비교 연산)이 실패하면 결함 탐지로 센다', () => {
  const v = J.judgeMutant(run([failed(EXPECTED)]), TARGET);
  assert.deepEqual(v, { caught: true, reason: 'caught', detail: '', undecidable: false });
});

test('[IJ-02] 표식 뒤 설명 문구가 바뀌어도 같은 Assertion 으로 알아본다', () => {
  const v = J.judgeMutant(run([failed(assertionError('[IA:M-29:value] 입력값이 b 로 바뀌어야 한다'))]), TARGET);
  assert.equal(v.caught, true);
});

test('[IJ-03] 같은 테스트의 다른 Assertion 이 실패하면 결함 탐지가 아니다', () => {
  const other = J.judgeMutant(run([failed(assertionError('체크 상자'))]), TARGET);
  assert.equal(other.caught, false);
  assert.equal(other.reason, 'other-assertion');
  assert.equal(other.undecidable, false);
  // 표식 없이 문구만 같아도 다른 Assertion 으로 본다 (문구가 아니라 표식으로 식별)
  assert.equal(J.judgeMutant(run([failed(assertionError('글 입력칸 값'))]), TARGET).reason, 'other-assertion');
});

test('[IJ-04] 표식은 같아도 비교 연산이 다르면 결함 탐지가 아니다', () => {
  const v = J.judgeMutant(run([failed(assertionError('[IA:M-29:value] 글 입력칸 값', 'deepStrictEqual'))]), TARGET);
  assert.equal(v.reason, 'other-assertion');
});

test('[IJ-05] 결함을 넣었는데 목표 테스트가 통과하면 결함 탐지 실패다', () => {
  const v = J.judgeMutant(run([result()], 0), TARGET);
  assert.equal(v.caught, false);
  assert.equal(v.reason, 'mutant-passed');
  assert.equal(v.undecidable, false);
});

test('[IJ-06] Assertion 이 아닌 실패(초기화 오류 · 예외)는 결함 탐지가 아니다', () => {
  const hook = { failureType: 'hookFailure', code: 'ERR_TEST_FAILURE', name: 'Error', message: 'intentional selfcheck setup failure' };
  const thrown = { failureType: 'testCodeFailure', code: null, name: 'TypeError', message: 'x is not a function' };
  assert.equal(J.judgeMutant(run([failed(hook)]), TARGET).reason, 'not-assertion');
  assert.equal(J.judgeMutant(run([failed(thrown)]), TARGET).reason, 'not-assertion');
});

test('[IJ-07] 목표 테스트가 건너뛰어지면 판정 불가다', () => {
  const v = J.judgeMutant(run([result({ skip: true })]), TARGET);
  assert.equal(v.caught, false);
  assert.equal(v.reason, 'target-skipped');
  assert.equal(v.undecidable, true);
});

test('[IJ-08] 목표 테스트가 todo 면 판정에 세지 않고 판정 불가다', () => {
  // todo 테스트는 실패해도 실행 전체를 실패시키지 않으므로, 실패 결과가 있어도 탐지로 세면 안 된다
  const v = J.judgeMutant(run([failed(EXPECTED, { todo: true })]), TARGET);
  assert.equal(v.reason, 'target-todo');
  assert.equal(v.undecidable, true);
});

test('[IJ-09] 목표 테스트가 두 번 이상 실행되면 판정 불가다', () => {
  const v = J.judgeMutant(run([failed(EXPECTED), failed(EXPECTED)]), TARGET);
  assert.equal(v.reason, 'target-duplicated');
  assert.equal(v.undecidable, true);
});

test('[IJ-10] 목표 테스트가 결과에 없으면 판정 불가다', () => {
  const v = J.judgeMutant(run([result({ name: '[M-30][정상] 다른 테스트' }), result({ name: '검사 방식의 정확성' })]), TARGET);
  assert.equal(v.reason, 'target-not-run');
  assert.equal(v.undecidable, true);
});

test('[IJ-11] 실패가 있는데 종료 코드가 0 이면 결함 탐지로 세지 않는다', () => {
  assert.equal(J.judgeMutant(run([failed(EXPECTED)], 0), TARGET).reason, 'exit-zero');
});

test('[IJ-12] 기준선은 목표 테스트가 한 번 통과하고 종료 코드가 0 일 때만 통과다', () => {
  assert.equal(J.checkBaseline(run([result()], 0), 'M-29'), null);
  assert.match(J.checkBaseline(run([failed(EXPECTED)], 1), 'M-29'), /이미 M-29 에서 실패한다/);
  assert.match(J.checkBaseline(run([result()], 1), 'M-29'), /종료 코드가 1/);
  assert.match(J.checkBaseline(run([result({ todo: true })], 0), 'M-29'), /target-todo/);
  assert.match(J.checkBaseline(run([result({ skip: true })], 0), 'M-29'), /target-skipped/);
});

test('[IJ-13] 결과 읽기 : 표식 줄만 읽고, ID 별 묶음에서 ID 없는 결과 · 건너뜀 · todo 를 뺀다', () => {
  const rows = [result(), result({ name: '[M-30] 둘째', skip: true }), result({ name: '[M-31] 셋째', todo: true }), result({ name: '검사 방식의 정확성' })];
  const stdout = ['사람이 읽는 줄', ...rows.map((r) => `${MARK}${JSON.stringify(r)}`), ''].join('\r\n');
  const parsed = J.parseResults(stdout, MARK);
  assert.equal(parsed.length, 4);
  assert.deepEqual([...J.byId(run(parsed)).keys()], ['M-29']);
  assert.equal(J.outcome(J.byId(run(parsed)), 'M-31'), '0건 실행');
});

test('[IJ-14] 자식 프로세스가 신호로 끝나면(종료 코드 null) 결함 탐지로 세지 않고 판정 불가다', () => {
  // 기대한 Assertion 이 실패한 뒤 SIGTERM 등으로 끝난 경우 : 결과 줄은 맞아 보여도 실행이 온전히 끝났다고 볼 수 없다
  const v = J.judgeMutant(run([failed(EXPECTED)], null, 'SIGTERM'), TARGET);
  assert.equal(v.caught, false);
  assert.equal(v.reason, 'abnormal-exit');
  assert.equal(v.undecidable, true);
  // 종료 코드가 숫자여도 신호가 함께 오면 정상 종료가 아니다
  assert.equal(J.judgeMutant(run([failed(EXPECTED)], 1, 'SIGKILL'), TARGET).reason, 'abnormal-exit');
  // 기준선도 신호로 끝났으면 통과로 보지 않는다
  assert.match(J.checkBaseline(run([result()], null, 'SIGTERM'), 'M-29'), /정상 종료되지 않았다/);
});
