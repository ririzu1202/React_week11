/* 공통 페이지(기능) 테스트 : 검증 페이지를 열어 버튼을 누르고 화면 결과만 검사 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../lib/harness');

const adapter = H.loadAdapter();
const S = adapter.page.selectors;
const io = adapter.page.io;
const BLANK = { looseSpace: true }; // 화면에 보이는 대로 공백 비교 (J4)

/* 페이지를 새로 열고 자주 쓰는 요소 · 동작을 묶어 돌려주는 함수 (테스트마다 새 페이지 → 상태 간섭 없음) */
async function open() {
  const p = await H.openPage(adapter);
  const $ = (sel) => p.document.querySelector(sel);
  const el = { actual: $(S.actual), test: $(S.test), patch: $(S.patch), back: $(S.back), forward: $(S.forward) };
  const actualCanon = () => H.canonChildren(el.actual, BLANK);
  const testCanon = () => H.canonHtml(p.document, io.read(el.test), BLANK);
  const click = async (btn) => { btn.click(); await H.settle(adapter); };
  return { ...p, el, actualCanon, testCanon, click };
}

/* 테스트 영역 HTML 에서 마지막 글자 하나를 바꾼 새 HTML 을 만드는 함수 (어느 샘플이든 쓸 수 있게) */
function editLastText(document, html, suffix = ' ★') {
  const frag = H.parseFragment(document, html);
  const walker = document.createTreeWalker(frag, 4 /* SHOW_TEXT */);
  let last = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const inRaw = n.parentElement && n.parentElement.closest('pre, textarea, script, style');
    if (!inRaw && /\S/.test(n.nodeValue)) last = n;
  }
  assert.ok(last, '테스트 영역에 바꿀 글자가 없다 (샘플 HTML 에 글자가 있어야 한다)');
  last.nodeValue += suffix;
  const box = document.createElement('div');
  box.appendChild(frag);
  return box.innerHTML;
}

/* 테스트 영역 끝에 요소 하나를 붙인 새 HTML 을 만드는 함수 */
function appendElement(html, tag = 'p', text = '추가된 문단') {
  return `${html}<${tag} data-common-test="1">${text}</${tag}>`;
}

/* 테스트 영역을 고치고 Patch 를 누르는 함수 */
async function editAndPatch(pg, nextHtml) {
  io.write(pg.el.test, nextHtml);
  await pg.click(pg.el.patch);
  return H.canonHtml(pg.document, nextHtml, BLANK);
}

/* ───────── R4 : 페이지 구성 ───────── */

test('[P-01][정상][R4] 영역 2개 · 버튼 3개가 있고, 로드 중 스크립트 오류가 없다', async () => {
  const pg = await open();
  try {
    for (const [k, v] of Object.entries(pg.el)) assert.ok(v, `${k} (${S[k]}) 를 찾지 못했다`);
    assert.equal(pg.errors.length, 0, `로드 중 오류: ${pg.errors.map((e) => e.message).join(' / ')}`);
  } finally { pg.close(); }
});

/* ───────── R5 : 로드 ───────── */

test('[P-02][정상][R5] 로드하면 테스트 영역에 실제 영역과 같은 내용이 그려진다', async () => {
  const pg = await open();
  try {
    assert.ok(pg.el.actual.querySelectorAll('*').length >= 2, '실제 영역 샘플에 요소가 2개 이상 있어야 검증할 수 있다');
    assert.equal(pg.testCanon(), pg.actualCanon());
  } finally { pg.close(); }
});

/* ───────── R6 · R3 : Patch ───────── */

test('[P-03][정상][R6] 글자 하나를 고치고 Patch 하면 실제 영역이 테스트 영역과 같아진다', async () => {
  const pg = await open();
  try {
    const expected = await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test)));
    assert.equal(pg.actualCanon(), expected, '[IA:P-03:result] Patch 뒤 실제 영역이 테스트 영역과 다르다');
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
  } finally { pg.close(); }
});

test('[P-04][정상][R3·R6] 글자 하나를 고치면 실제 영역의 나머지 요소는 그대로(같은 객체) 남는다', async () => {
  const pg = await open();
  try {
    const before = Array.from(pg.el.actual.querySelectorAll('*'));
    await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test)));
    const kept = before.filter((e) => pg.el.actual.contains(e));
    assert.ok(kept.length >= before.length - 1, `요소 ${before.length} 개 중 ${kept.length} 개만 남았다 (통째로 다시 그린 것으로 보임)`);
  } finally { pg.close(); }
});

test('[P-05][정상][R6] 요소를 하나 붙이고 Patch 하면 실제 영역에도 생긴다', async () => {
  const pg = await open();
  try {
    const expected = await editAndPatch(pg, appendElement(io.read(pg.el.test)));
    assert.equal(pg.actualCanon(), expected);
    assert.ok(pg.el.actual.querySelector('[data-common-test="1"]'), '붙인 요소가 실제 영역에 없다');
  } finally { pg.close(); }
});

test('[P-06][경계][R6] 테스트 영역을 비우고 Patch 하면 실제 영역도 빈다', async () => {
  const pg = await open();
  try {
    const expected = await editAndPatch(pg, '');
    assert.equal(pg.actualCanon(), expected);
  } finally { pg.close(); }
});

test('[P-07][경계][R6] 아무것도 고치지 않고 Patch 해도 실제 영역은 그대로다', async () => {
  const pg = await open();
  try {
    const before = pg.actualCanon();
    await pg.click(pg.el.patch);
    assert.equal(pg.actualCanon(), before);
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
  } finally { pg.close(); }
});

/* ───────── R7 · R8 : State History ───────── */

test('[P-08][정상][R7·R8] Patch 뒤 뒤로가기 → 두 영역 모두 처음 내용으로 돌아간다', async () => {
  const pg = await open();
  try {
    const initial = pg.actualCanon();
    await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test)));
    await pg.click(pg.el.back);
    assert.equal(pg.actualCanon(), initial, '[IA:P-08:back] 실제 영역이 처음으로 돌아가지 않았다');
    assert.equal(pg.testCanon(), initial, '테스트 영역이 처음으로 돌아가지 않았다');
  } finally { pg.close(); }
});

test('[P-09][정상][R8] 뒤로간 뒤 앞으로가기 → 두 영역 모두 Patch 한 내용으로 간다', async () => {
  const pg = await open();
  try {
    const patched = await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test)));
    await pg.click(pg.el.back);
    await pg.click(pg.el.forward);
    assert.equal(pg.actualCanon(), patched, '실제 영역');
    assert.equal(pg.testCanon(), patched, '테스트 영역');
  } finally { pg.close(); }
});

test('[P-10][정상][R7·R8] Patch 두 번 → 뒤로 두 번이면 처음, 앞으로 한 번이면 첫 Patch', async () => {
  const pg = await open();
  try {
    const initial = pg.actualCanon();
    const first = await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test), ' 1'));
    await editAndPatch(pg, appendElement(io.read(pg.el.test)));
    await pg.click(pg.el.back);
    await pg.click(pg.el.back);
    assert.equal(pg.actualCanon(), initial, '뒤로 두 번 : 실제 영역');
    assert.equal(pg.testCanon(), initial, '뒤로 두 번 : 테스트 영역');
    await pg.click(pg.el.forward);
    assert.equal(pg.actualCanon(), first, '앞으로 한 번 : 실제 영역');
    assert.equal(pg.testCanon(), first, '앞으로 한 번 : 테스트 영역');
  } finally { pg.close(); }
});

test('[P-11][경계][R8] 기록의 처음에서 뒤로가기 → 오류 없이 두 영역 그대로', async () => {
  const pg = await open();
  try {
    const a = pg.actualCanon();
    const t = pg.testCanon();
    await pg.click(pg.el.back);
    assert.equal(pg.actualCanon(), a);
    assert.equal(pg.testCanon(), t);
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
  } finally { pg.close(); }
});

test('[P-12][경계][R8] 기록의 끝에서 앞으로가기 → 오류 없이 두 영역 그대로', async () => {
  const pg = await open();
  try {
    await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test)));
    const a = pg.actualCanon();
    const t = pg.testCanon();
    await pg.click(pg.el.forward);
    assert.equal(pg.actualCanon(), a);
    assert.equal(pg.testCanon(), t);
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
  } finally { pg.close(); }
});

test('[P-15][정상][R6·R8] 뒤로가기 뒤 다른 곳을 고쳐 Patch 하면 실제 영역이 테스트 영역과 같아진다', async () => {
  // 원문 : Patch 는 "이전 Virtual DOM 과 비교" — 뒤로간 뒤의 "이전" 은 지금 화면에 보이는 상태다 (11-09 4시 회의 결정)
  const pg = await open();
  try {
    await editAndPatch(pg, appendElement(io.read(pg.el.test)));      // 수정 1 : 끝에 문단 추가
    await pg.click(pg.el.back);                                        // 뒤로 : 수정 1 이전 화면
    const expected = await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test), ' ◆')); // 다른 곳(마지막 글자) 수정
    assert.equal(pg.actualCanon(), expected, '뒤로간 뒤 Patch 결과가 테스트 영역과 다르다 (비교 기준이 뒤로간 화면으로 안 옮겨졌을 수 있음)');
    assert.equal(pg.el.actual.querySelector('[data-common-test="1"]'), null, '뒤로가기로 없어진 문단이 다시 생겼다');
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
  } finally { pg.close(); }
});

/* ───────── 선택 품질 · 판단 필요 ───────── */

test('[P-13][선택][J3] 뒤로간 뒤 새로 Patch 하면 앞으로가기 기록은 버려진다', async () => {
  const pg = await open();
  try {
    await editAndPatch(pg, editLastText(pg.document, io.read(pg.el.test), ' 1'));
    await pg.click(pg.el.back);
    const branch = await editAndPatch(pg, appendElement(io.read(pg.el.test)));
    await pg.click(pg.el.forward);
    assert.equal(pg.actualCanon(), branch);
  } finally { pg.close(); }
});

test('[P-14][선택][Q2] 닫히지 않은 HTML 을 넣어도 오류 없이 브라우저가 고친 모양대로 반영된다', async () => {
  const pg = await open();
  try {
    const expected = await editAndPatch(pg, '<p>열린 <b>굵게<p>다음');
    assert.equal(pg.errors.length, 0, pg.errors.map((e) => e.message).join(' / '));
    assert.equal(pg.actualCanon(), expected);
  } finally { pg.close(); }
});
