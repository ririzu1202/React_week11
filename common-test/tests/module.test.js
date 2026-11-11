/* 공통 모듈 테스트 : DOM → Virtual DOM 변환, Diff, Patch 를 바깥에서 보이는 결과로만 검사 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../lib/harness');

const adapter = H.loadAdapter();
const win = H.createModuleWindow();
let M;
// ES 모듈 구현은 import() 가 비동기라 loadModules 가 Promise 를 돌려줘도 된다
test.before(async () => { M = await adapter.loadModules(win); });

/* 테스트마다 body 를 비워 서로 간섭하지 않게 하는 함수 */
function reset() {
  win.document.body.innerHTML = '';
}

/* before HTML 로 그린 컨테이너를 after HTML 로 update 하고 결과를 돌려주는 함수 */
function run(before, after) {
  reset();
  const actual = H.makeContainer(win, before);
  const target = H.makeContainer(win, after);
  const oldV = M.toVdom(actual);
  const newV = M.toVdom(target);
  let root0 = actual;
  // (선택) 노드 참조를 VDOM 에 묶는 구현은 Adapter 의 mount 로 먼저 그린다. 그 뒤의 요소를 기준으로 본다
  if (typeof M.mount === 'function') {
    const m = M.mount(actual, oldV);
    if (m && m.nodeType === 1) root0 = m;
  }
  const beforeEls = H.allElements(root0);
  const w = H.watch(win, root0);
  const ret = M.update(root0, oldV, newV);
  const root = ret && ret.nodeType === 1 ? ret : root0;
  const records = w.take();
  w.stop();
  return { root, target, records, beforeEls, oldV, newV };
}

/* 결과 DOM 이 after HTML 을 그대로 파싱한 것과 같은지 확인하는 함수 */
function assertSame(r, msg) {
  assert.equal(H.canonChildren(r.root), H.canonChildren(r.target), msg);
}

/* ───────── R1 : DOM → Virtual DOM 변환 ───────── */

test('[M-01][정상][R1] 변환 결과로 빈 영역을 그리면 원래 DOM 과 같다', () => {
  const html = '<h1 class="t">제목</h1><p>글 <b>굵게</b> 끝</p><ul><li>하나</li><li>둘</li></ul>';
  const r = run('', html);
  assertSame(r);
});

test('[M-02][정상][R1] 변환은 원래 DOM 을 바꾸지 않는다', () => {
  reset();
  const html = '<p id="a">글</p><ul><li>하나</li></ul>';
  const c = H.makeContainer(win, html);
  const before = H.canonChildren(c);
  const w = H.watch(win, c);
  M.toVdom(c);
  assert.equal(w.take().length, 0, '[IA:M-02:no-mutation] 변환 중 DOM 변경이 일어났다');
  w.stop();
  assert.equal(H.canonChildren(c), before);
});

/* ───────── R2 · R3 : Diff + Patch 결과가 새 DOM 과 같다 ───────── */

const CASES = [
  // [ID, 분류, 설명, before, after]
  ['M-03', '정상', '글자만 바뀜', '<p>안녕</p>', '<p>잘 가</p>'],
  ['M-04', '정상', '속성 값이 바뀜', '<p class="a">글</p>', '<p class="b">글</p>'],
  ['M-05', '정상', '속성이 생김', '<p>글</p>', '<p title="설명">글</p>'],
  ['M-06', '정상', '속성이 없어짐', '<p title="설명" class="a">글</p>', '<p class="a">글</p>'],
  ['M-07', '정상', '자식이 뒤에 늘어남', '<ul><li>1</li></ul>', '<ul><li>1</li><li>2</li><li>3</li></ul>'],
  ['M-08', '정상', '자식이 뒤에서 줄어듦', '<ul><li>1</li><li>2</li><li>3</li></ul>', '<ul><li>1</li></ul>'],
  ['M-09', '정상', '태그가 바뀜', '<div><span>글</span></div>', '<div><b>글</b></div>'],
  ['M-10', '정상', '깊은 곳 글자만 바뀜', '<div><section><article><p><span>깊다</span></p></article></section></div>', '<div><section><article><p><span>더 깊다</span></p></article></section></div>'],
  ['M-11', '정상', '여러 곳이 한꺼번에 바뀜', '<h1>제목</h1><p class="a">글</p><ul><li>1</li><li>2</li></ul>', '<h2>제목</h2><p class="b">새 글</p><ul><li>1</li><li>2</li><li>3</li></ul><footer>끝</footer>'],
  ['M-12', '경계', '빈 영역 → 내용', '', '<p>처음</p>'],
  ['M-13', '경계', '내용 → 빈 영역', '<p>하나</p><p>둘</p>', ''],
  ['M-14', '경계', '맨 앞에 끼워 넣음', '<ul><li>b</li><li>c</li></ul>', '<ul><li>a</li><li>b</li><li>c</li></ul>'],
  ['M-15', '경계', '가운데에 끼워 넣음', '<ul><li>a</li><li>c</li></ul>', '<ul><li>a</li><li>b</li><li>c</li></ul>'],
  ['M-16', '경계', '맨 앞을 지움', '<ul><li>a</li><li>b</li><li>c</li></ul>', '<ul><li>b</li><li>c</li></ul>'],
  ['M-17', '경계', '가운데를 지움', '<ul><li>a</li><li>b</li><li>c</li></ul>', '<ul><li>a</li><li>c</li></ul>'],
  ['M-18', '경계', '순서를 뒤집음', '<ul><li>1</li><li>2</li><li>3</li></ul>', '<ul><li>3</li><li>2</li><li>1</li></ul>'],
  ['M-19', '경계', '글자 → 요소', '<p>글자</p>', '<p><b>요소</b></p>'],
  ['M-20', '경계', '요소 → 글자', '<p><b>요소</b></p>', '<p>글자</p>'],
  ['M-21', '경계', '글자 → 자식 없음', '<p>글자</p>', '<p></p>'],
  ['M-22', '경계', '속성 값 "" (불리언 속성) 생김', '<button>누름</button>', '<button disabled="">누름</button>'],
  ['M-23', '경계', '불리언 속성 없어짐', '<button disabled="">누름</button>', '<button>누름</button>'],
  ['M-24', '경계', '깊이 30 중첩', '<div>'.repeat(30) + '끝' + '</div>'.repeat(30), '<div>'.repeat(30) + '바뀐 끝' + '</div>'.repeat(30)],
  ['M-25', '경계', '항목 200개 중 하나만 바뀜',
    '<ul>' + Array.from({ length: 200 }, (_, i) => `<li>${i}</li>`).join('') + '</ul>',
    '<ul>' + Array.from({ length: 200 }, (_, i) => `<li>${i === 137 ? 'X' : i}</li>`).join('') + '</ul>'],
  ['M-26', '예외', '특수 문자 · 한글 · 이모지 · 엔티티', '<p>a</p>', '<p>&lt;b&gt; &amp; "따옴표" 한글 😀 &nbsp;끝</p>'],
  ['M-27', '예외', '태그처럼 보이는 글자', '<p>안전</p>', '<p>&lt;img src=x onerror="alert(1)"&gt;</p>'],
  ['M-28', '정상', '여러 태그 : 표', '<table><tbody><tr><td>1</td><td>2</td></tr></tbody></table>', '<table><tbody><tr><td>1</td><td>3</td></tr><tr><td>4</td><td>5</td></tr></tbody></table>'],
  ['M-30', '정상', '여러 태그 : 링크 · 이미지 속성', '<a href="/a">링크</a><img src="a.png" alt="a">', '<a href="/b" target="_blank">링크</a><img src="b.png" alt="b">'],
];

for (const [id, kind, desc, before, after] of CASES) {
  test(`[${id}][${kind}][R2·R3] ${desc} → 결과가 새 HTML 과 같다`, () => {
    assertSame(run(before, after));
  });
}

test('[M-29][정상][R2·R3] 여러 태그 : 폼 요소 값 · 체크가 바뀐다 (속성 · 프로퍼티 어느 쪽으로 반영해도 됨)', () => {
  const r = run('<form><input type="text" value="a"><input type="checkbox"></form>', '<form><input type="text" value="b"><input type="checkbox" checked=""></form>');
  const [text, box] = r.root.querySelectorAll('input');
  assert.ok(text && box, 'input 두 개가 있어야 한다');
  assert.equal(text.value, 'b', '[IA:M-29:value] 글 입력칸 값');
  assert.equal(box.checked, true, '체크 상자');
  // value · checked 는 프로퍼티만 바꾸면 속성이 안 따라온다 → 이 둘을 뺀 나머지 모양만 비교
  const strip = (root) => H.canonChildren(root).replace(/ (value|checked)="[^"]*"/g, '');
  assert.equal(strip(r.root), strip(r.target));
});

test('[M-31][예외][R3] 태그처럼 보이는 글자는 요소로 만들어지지 않는다', () => {
  const r = run('<p>안전</p>', '<p>&lt;img src=x onerror="alert(1)"&gt;</p>');
  assert.equal(r.root.querySelector('img'), null, '글자가 HTML 로 해석되어 img 가 생겼다');
});

test('[M-32][경계][R3] 불리언 속성이 없어지면 실제로 꺼진다', () => {
  const r = run('<button disabled="">누름</button>', '<button>누름</button>');
  const btn = r.root.querySelector('button');
  assert.equal(btn.hasAttribute('disabled'), false);
  assert.equal(btn.disabled, false);
});

test('[M-33][정상][R2·R3] 연달아 세 번 update 해도 마지막 HTML 과 같다', () => {
  reset();
  const steps = ['<p>1</p>', '<p>2</p><p>x</p>', '<ul><li>3</li></ul>', '<p>4</p>'];
  let root = H.makeContainer(win, steps[0]);
  let prev = M.toVdom(root);
  for (let i = 1; i < steps.length; i++) {
    const t = H.makeContainer(win, steps[i]);
    const next = M.toVdom(t);
    const ret = M.update(root, prev, next);
    if (ret && ret.nodeType === 1) root = ret;
    assert.equal(H.canonChildren(root), H.canonChildren(t), `${i} 번째 update 결과가 다르다`);
    prev = next;
  }
});

/* ───────── R2 · R3 : 바뀐 부분만 반영 ───────── */

test('[M-34][정상][R2] 같은 두 트리를 비교하면 DOM 을 전혀 건드리지 않는다', () => {
  const html = '<h1>제목</h1><ul><li>1</li><li>2</li></ul><p class="a">글</p>';
  const r = run(html, html);
  assert.equal(r.records.length, 0, `[IA:M-34:no-change] 변경이 없어야 하는데 ${r.records.length} 건 일어났다`);
});

test('[M-35][정상][R3] 항목 하나의 글자가 바뀌면 나머지 요소는 그대로(같은 객체) 남는다', () => {
  const r = run('<ul><li>1</li><li>2</li><li>3</li></ul><p>그대로</p>', '<ul><li>1</li><li>바뀜</li><li>3</li></ul><p>그대로</p>');
  assertSame(r);
  const kept = r.beforeEls.filter((el) => r.root.contains(el));
  // 바뀐 li 하나는 교체돼도 허용 (판단 필요 J5). 나머지 ul · li 2개 · p 는 남아야 한다
  assert.ok(kept.length >= r.beforeEls.length - 1, `요소 ${r.beforeEls.length} 개 중 ${kept.length} 개만 남았다 (통째로 다시 그린 것으로 보임)`);
});

test('[M-36][정상][R3] 항목 200개 중 하나가 바뀌면 나머지 199개는 그대로 남는다', () => {
  const before = '<ul>' + Array.from({ length: 200 }, (_, i) => `<li>${i}</li>`).join('') + '</ul>';
  const after = before.replace('<li>137</li>', '<li>X</li>');
  const r = run(before, after);
  assertSame(r);
  // 요소 201개(ul + li 200) 중 바뀐 li 하나 말고는 같은 객체로 남아야 한다
  const kept = r.beforeEls.filter((el) => r.root.contains(el));
  assert.ok(kept.length >= r.beforeEls.length - 1, `요소 ${r.beforeEls.length} 개 중 ${kept.length} 개만 남았다`);
  // DOM 변경 기록도 바뀐 li 근처 몇 건이어야 한다 (넉넉히 5 건 이하)
  assert.ok(r.records.length <= 5, `DOM 변경이 ${r.records.length} 건 — 바뀐 곳만 고친 것으로 보기 어렵다`);
});

test('[M-37][정상][R3] 속성 하나가 바뀌면 그 요소 밖의 요소는 그대로 남는다', () => {
  const r = run('<div><p class="a">1</p><p>2</p></div>', '<div><p class="b">1</p><p>2</p></div>');
  assertSame(r);
  const kept = r.beforeEls.filter((el) => r.root.contains(el));
  assert.ok(kept.length >= r.beforeEls.length - 1, `요소 ${r.beforeEls.length} 개 중 ${kept.length} 개만 남았다`);
});

/* ───────── 선택 품질 : 판단 필요 · 구현에 따라 다를 수 있는 것 ───────── */

test('[M-38][선택][Q2] 속성만 바뀌면 그 요소도 교체하지 않는다', () => {
  const r = run('<p class="a">1</p>', '<p class="b">1</p>');
  const kept = r.beforeEls.filter((el) => r.root.contains(el));
  assert.equal(kept.length, r.beforeEls.length);
});

test('[M-39][선택][Q2] SVG 안에 새로 생긴 요소는 SVG 이름공간이다', () => {
  const r = run('<svg><circle r="1"></circle></svg>', '<svg><circle r="1"></circle><rect width="2"></rect></svg>');
  assertSame(r);
  assert.equal(r.root.querySelector('rect').namespaceURI, 'http://www.w3.org/2000/svg');
});

test('[M-40][선택][Q2] diff 는 입력 Virtual DOM 을 고치지 않는다', (t) => {
  if (typeof M.diff !== 'function') { t.skip('Adapter 에 diff 가 없음'); return; }
  reset();
  const a = H.makeContainer(win, '<ul><li>1</li></ul>');
  const b = H.makeContainer(win, '<ul><li>2</li><li>3</li></ul>');
  const oldV = M.toVdom(a);
  const newV = M.toVdom(b);
  const snap = (v) => safeJson(v);
  const before = [snap(oldV), snap(newV)];
  M.diff(oldV, newV);
  assert.deepEqual([snap(oldV), snap(newV)], before);
});

test('[M-41][선택][J9] 폼 속성을 지우면 사용자가 바꾼 입력 값과 체크 상태도 초기화된다', () => {
  reset();
  const actual = H.makeContainer(win, '<form><input value="기본 값"><input type="checkbox" checked=""></form>');
  const target = H.makeContainer(win, '<form><input><input type="checkbox"></form>');
  const oldV = M.toVdom(actual);
  const newV = M.toVdom(target);
  let root = actual;
  if (typeof M.mount === 'function') {
    const mounted = M.mount(actual, oldV);
    if (mounted && mounted.nodeType === 1) root = mounted;
  }

  const [text, box] = root.querySelectorAll('input');
  assert.ok(text && box, 'input 두 개가 있어야 한다');
  // 렌더 뒤 사용자가 값을 바꾼 상황을 만들어 속성만 지웠을 때 남는 stale property 를 잡는다.
  text.value = '사용자가 입력한 값';
  box.checked = false;
  box.checked = true;
  const ret = M.update(root, oldV, newV);
  if (ret && ret.nodeType === 1) root = ret;

  assert.equal(text.hasAttribute('value'), false, 'value 속성이 남아 있다');
  assert.equal(text.value, '', '입력 값 프로퍼티가 초기화되지 않았다');
  assert.equal(box.hasAttribute('checked'), false, 'checked 속성이 남아 있다');
  assert.equal(box.checked, false, '체크 상태 프로퍼티가 초기화되지 않았다');
  assert.equal(H.canonChildren(root), H.canonChildren(target), '업데이트 결과가 새 HTML 과 다르다');
});

/* DOM 참조 · 순환이 있어도 비교할 수 있게 직렬화하는 함수 */
function safeJson(v) {
  const seen = new WeakSet();
  return JSON.stringify(v, (k, val) => {
    if (val && typeof val === 'object') {
      if (typeof val.nodeType === 'number') return '[DOM]';
      if (seen.has(val)) return '[순환]';
      seen.add(val);
    }
    if (typeof val === 'function') return '[함수]';
    return val;
  });
}
