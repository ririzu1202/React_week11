/* 종휘 구현(sw-ai-week11-12 feat-Jongeume) Adapter — template.js 를 복사해 채움
   규칙 : 내 구현의 함수를 "이름만 맞춰 부르는" 코드만 넣는다. 비교 · 고치기 로직을 여기서 대신 하면 안 된다 */
'use strict';

const path = require('node:path');
const H = require('../lib/harness');

const ROOT = process.env.JONGHWI_ROOT || 'D:/KraftonJungle/sw-ai-week11-12';

module.exports = {
  name: '종휘',

  /* 모듈 테스트용 : 테스트가 만든 창(window) 안에서 내 구현을 불러 두 함수를 돌려준다 */
  loadModules(window) {
    // script 태그 방식 : index.html 의 <script src> 순서 그대로 (화면용 app.js 는 뺌)
    H.evalScripts(window, ['vdom.js', 'diff.js', 'patch.js', 'history.js'].map((f) => path.join(ROOT, 'src', f)));
    // 네 파일 모두 함수를 window.MiniReact 에 모은다
    const M = window.MiniReact;
    return {
      /* 실제 DOM 요소(컨테이너) → 내 Virtual DOM (모양은 자유) */
      toVdom: (node) => M.domToVdom(node),
      /* 컨테이너를 oldV 모양에서 newV 모양으로 : 내 diff 를 부르고 그 결과로 내 patch 를 부른다
         루트가 새 요소로 바뀌면 그 요소를 돌려준다 (아니면 아무것도 안 돌려줘도 됨) */
      update: (container, oldV, newV) => M.applyPatches(container, M.diff(oldV, newV)),
      /* (선택) diff 만 따로 — 있으면 M-40 을 돌린다 */
      diff: (oldV, newV) => M.diff(oldV, newV),
    };
  },

  /* 페이지 테스트용 */
  page: {
    file: path.join(ROOT, 'index.html'),
    selectors: { actual: '#actual', test: '#test', patch: '#btn-patch', back: '#btn-back', forward: '#btn-forward' },
    io: H.textareaIO, // 테스트 영역이 <textarea id="test"> 라서 textareaIO
    settleMs: 50, // 버튼을 누른 뒤 화면이 바뀔 때까지 기다릴 시간
  },
};
