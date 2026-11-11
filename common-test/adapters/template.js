/* Adapter 틀 — 이 파일을 복사해 내 구현에 맞게 채운다 (ADAPTER.md 참고)
   규칙 : 내 구현의 함수를 "이름만 맞춰 부르는" 코드만 넣는다. 비교 · 고치기 로직을 여기서 대신 하면 안 된다 */
'use strict';

const path = require('node:path');
const H = require('../lib/harness');

const ROOT = 'D:/경로/내-구현-폴더';

module.exports = {
  name: '이름',

  /* 모듈 테스트용 : 테스트가 만든 창(window) 안에서 내 구현을 불러 두 함수를 돌려준다 */
  loadModules(window) {
    // 이 줄(const M = {};)을 바꾼다 — 자세한 예시는 ADAPTER.md 「사람마다 바꾸는 부분」
    // script 태그 방식이면 : 아래 두 줄처럼
    //   H.evalScripts(window, ['vdom.js', 'diff.js', 'patch.js'].map((f) => path.join(ROOT, 'src', f)));
    //   const M = window.MiniReact;
    //   - 파일 목록 = 내 index.html 의 <script src> 를 같은 순서로. 화면용 app.js · main.js 는 뺀다
    //   - window.MiniReact = 내 파일들이 함수를 올려 두는 전역 이름 (전역 함수로 선언했으면 const M = window;)
    // CommonJS 면 : globalThis.window = window; globalThis.document = window.document; 뒤 require
    // ES 모듈이면 : ADAPTER.md 의 async loadModules 예시
    const M = {};
    return {
      /* 실제 DOM 요소(컨테이너) → 내 Virtual DOM (모양은 자유) */
      toVdom: (node) => M.내변환함수(node),
      /* 컨테이너를 oldV 모양에서 newV 모양으로 : 내 diff 를 부르고 그 결과로 내 patch 를 부른다
         루트가 새 요소로 바뀌면 그 요소를 돌려준다 (아니면 아무것도 안 돌려줘도 됨) */
      update: (container, oldV, newV) => M.내패치함수(container, M.내디프함수(oldV, newV)),
      /* (선택) diff 만 따로 — 있으면 M-40 을 돌린다 */
      diff: (oldV, newV) => M.내디프함수(oldV, newV),
    };
  },

  /* 페이지 테스트용 */
  page: {
    file: path.join(ROOT, 'index.html'),
    selectors: { actual: '#실제영역', test: '#테스트영역', patch: '#패치버튼', back: '#뒤로', forward: '#앞으로' },
    io: H.textareaIO, // 테스트 영역이 HTML 글(textarea)이면 textareaIO, 렌더링된 편집 영역이면 editableIO
    settleMs: 50, // 버튼을 누른 뒤 화면이 바뀔 때까지 기다릴 시간
    // open: async () => ({ window, document, errors: [], close() {} }), // jsdom 으로 못 여는 구현(ES 모듈 · 번들러)이면 직접 연다
  },
};
