# Adapter 인터페이스

> 내 구현을 공통 테스트에 연결하는 **이름 맞추기 파일** 하나.
> `adapters/template.js` 를 복사해 채운다. 예시 : `adapters/jonghwi.js`

## 규칙

- 내 구현의 함수를 **부르기만** 한다
- 비교 · 고치기 · 변환 로직을 Adapter 에서 대신 하면 안 된다
	- 예 : `update` 안에서 `innerHTML` 로 다시 그리기 ❌
	- 예 : 내 `diff` 결과를 걸러 내거나 고치기 ❌
- 교차 검증 때 Adapter 파일도 같이 본다

## 모양

```js
module.exports = {
  name: '이름',
  loadModules(window) { return { toVdom, update, diff? } },
  page: { file, selectors, io, settleMs?, open? },
};
```

### `loadModules(window)` — 모듈 테스트용

- `window` : 테스트가 만든 jsdom 창. 내 코드가 `document` 를 쓰면 이 창의 것을 쓰게 한다
	- script 태그 방식 : `H.evalScripts(window, [파일 경로들])` 뒤 `window.내전역` 에서 꺼낸다
	- CommonJS : `globalThis.window = window; globalThis.document = window.document;` 뒤 `require`
- 돌려줄 함수

| 이름 | 입력 | 출력 | 하는 일 |
| --- | --- | --- | --- |
| `toVdom(node)` | 실제 DOM 요소 (`div` 컨테이너) | 내 Virtual DOM (모양 자유) | 내 변환 함수 호출 |
| `update(container, oldV, newV)` | 컨테이너, `toVdom` 결과 두 개 | 루트가 바뀌면 새 루트 요소, 아니면 없음 | 내 diff → 내 patch 호출 |
| `diff(oldV, newV)` (선택) | `toVdom` 결과 두 개 | 아무거나 | 내 diff 호출. 있으면 M-40 을 돌린다 |
| `mount(container, vdom)` (선택) | 컨테이너, `toVdom` 결과 | 루트가 바뀌면 새 루트 | 내 첫 렌더 함수 호출. VDOM 이 실제 노드 참조(`el` 등)를 들고 있어야 patch 할 수 있는 설계면 넣는다. 테스트는 이 뒤의 요소를 기준으로 "그대로 남았나" 를 본다 |

- 내 patch 가 diff 를 안에서 부르는 구조면 `update` 가 그 함수 하나만 불러도 된다
- `loadModules` 는 Promise 를 돌려줘도 된다 (ES 모듈 구현)

```js
async loadModules(window) {
  globalThis.window = window; globalThis.document = window.document;
  const M = await import('file:///D:/내구현/src/index.js');
  return { toVdom: M.domToVdom, update: (c, o, n) => M.patch(c, M.diff(o, n)) };
}
```

### 사람마다 바꾸는 부분 — 순서와 예시

1. `adapters/template.js` 를 복사해 `adapters/<내 이름>.js` 로 저장 (예 : `adapters/minki.js`)
2. `ROOT` 를 내 구현 폴더 경로로
3. `loadModules` 안의 `const M = {};` 한 줄을 **두 줄**로 바꾼다
4. `return { … }` 의 `M.내변환함수` 같은 이름을 내 실제 함수 이름으로
5. `page` 의 `selectors` · `io` 를 내 페이지에 맞게

```js
// 3 번 — script 태그 방식일 때
H.evalScripts(window, ['vdom.js', 'diff.js', 'patch.js'].map((f) => path.join(ROOT, 'src', f)));
const M = window.MiniReact;
```

| 칸 | 무엇을 넣나 | 예시 |
| --- | --- | --- |
| `ROOT` | 내 구현 폴더 | `'D:/민기/mini-react'` |
| 파일 목록 | 내 `index.html` 이 `<script src>` 로 불러오는 파일을 **같은 순서**로 | `virtual-dom.js → differ.js → patcher.js → main.js` 순서면 `['virtual-dom.js', 'differ.js', 'patcher.js']` |
| 폴더 (`'src'`) | 그 파일들이 있는 폴더 | `js/` 안이면 `path.join(ROOT, 'js', f)`, 루트에 바로 있으면 `path.join(ROOT, f)` |
| 전역 이름 | 파일들이 함수를 올려 두는 이름 | `window.VDOM = {…}` 로 모았으면 `window.VDOM` · 파일 맨 위에 `function diff() {}` 로 그냥 선언했으면 `const M = window;` |
| `toVdom` | 내 DOM → VDOM 함수 | 함수가 `createVNode(el)` 면 `(node) => M.createVNode(node)` |
| `update` | 내 diff → 내 patch | patch 가 diff 를 안에서 부르는 `updateElement(parent, newV, oldV)` 면 `(c, o, n) => M.updateElement(c, n, o)` (인자 순서 주의) |
| `selectors` | 내 페이지의 요소 선택자 | 실제 영역이 `<div id="real">` 이면 `actual: '#real'` |
| `io` | 테스트 영역 종류 | `<textarea>` → `H.textareaIO`, contenteditable → `H.editableIO` |

> [!WARNING]
> 파일 목록에서 **화면용 스크립트(`app.js` · `main.js` 등)는 뺀다.**
> 모듈 테스트는 빈 창에서 돌아서, 열리자마자 `document.getElementById('actual')` 처럼 페이지 요소를 찾는 파일은 오류가 난다.

- 내 파일이 `typeof module !== 'undefined' ? module.exports = … : window.X = …` 처럼 갈라지면 걱정 없다
	- 테스트 창 안에는 `module` · `require` 가 없어서 `window.X` 쪽으로 붙는다
- `update(c, …)` 의 `c` 는 **바뀔 내용을 담은 컨테이너 자신**이다. 내 patch 가 첫 인자로 **부모**를 받는 구조면 안 맞을 수 있다 → 막히면 팀에 공유

### 실제로 채운 예 — 종휘 구현

| 칸 | 어디서 찾았나 | 넣은 값 |
| --- | --- | --- |
| `ROOT` | 구현 폴더 | `D:/KraftonJungle/sw-ai-week11-12` |
| 파일 목록 | `index.html` 의 `<script src>` : `vdom → diff → patch → history → app` | `['vdom.js', 'diff.js', 'patch.js', 'history.js']` (`app.js` 뺌) |
| 폴더 | 파일들이 `src/` 안 | `path.join(ROOT, 'src', f)` |
| 전역 이름 | 네 파일 끝이 모두 `root.MiniReact = …` | `const M = window.MiniReact;` |
| 함수 | `domToVdom` · `diff` · `applyPatches` | `toVdom` · `update` · `diff` 에 연결 |
| `selectors` | id `actual` · `test` · `btn-patch` · `btn-back` · `btn-forward` | 그대로 |
| `io` | `<textarea id="test">` | `H.textareaIO` |

- 결과 파일 : `adapters/jonghwi.js` → `# pass 50 · # fail 0 · # todo 5` (v2)

### `page` — 페이지 테스트용

| 칸 | 뜻 |
| --- | --- |
| `file` | 검증 페이지 HTML 파일 경로 |
| `selectors` | `{ actual, test, patch, back, forward }` CSS 선택자 |
| `io` | 테스트 영역 읽기 · 쓰기. HTML 글(textarea)이면 `H.textareaIO`, 렌더링된 편집 영역이면 `H.editableIO`, 다르면 `{ read(el), write(el, html) }` 직접 |
| `settleMs` | 버튼을 누른 뒤 기다릴 시간 (기본 50ms) |
| `open` (선택) | jsdom 으로 못 여는 구현(ES 모듈 `type="module"` · 번들러 · 서버 필요)이면 직접 열어 `{ window, document, errors, close }` 를 돌려준다 |
