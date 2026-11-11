/* 정혁 구현(mini-react, TypeScript ES 모듈) Adapter — 내 구현의 함수를 이름만 맞춰 부른다
   규칙 : 비교 · patch · 변환 로직을 여기서 대신 하지 않는다 (ADAPTER.md 참고) */
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { JSDOM, VirtualConsole } = require('jsdom');
const H = require('../lib/harness');

const ROOT = process.env.MINI_REACT_ROOT || path.resolve(__dirname, '../..');

/* 구현 파일 경로 → import() 용 file URL */
function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(ROOT, relativePath)).href;
}

/* ES 모듈 구현이 전역 document 등을 쓰므로, 테스트가 만든 창의 것을 전역에 연결한다 */
function bindDomGlobals(window) {
  globalThis.window = window;
  globalThis.document = window.document;
  for (const name of [
    'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
    'HTMLSelectElement', 'HTMLOptionElement', 'MutationObserver', 'NodeFilter', 'Event', 'KeyboardEvent',
  ]) {
    if (window[name]) globalThis[name] = window[name];
  }
}

/* jsdom 은 .ts ES 모듈 페이지를 못 돌리므로, 빈 창을 만들고 내 페이지 생성 함수를 불러 붙인다 */
async function openLabPage() {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error));
  const dom = new JSDOM('<!doctype html><html lang="ko"><body></body></html>', {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole,
  });
  bindDomGlobals(dom.window);
  try {
    const { createLabPage } = await import(moduleUrl('src/app/lab-page.ts'));
    dom.window.document.body.append(createLabPage());
  } catch (error) {
    dom.window.close();
    throw error;
  }
  return { window: dom.window, document: dom.window.document, errors, close: () => dom.window.close() };
}

module.exports = {
  name: '정혁',

  /* 모듈 테스트용 : ES 모듈이라 import() 가 비동기 → Promise 를 돌려준다 */
  async loadModules(window) {
    bindDomGlobals(window);
    const [domModule, diffModule, patchModule] = await Promise.all([
      import(moduleUrl('src/phase1/dom-to-vdom.ts')),
      import(moduleUrl('src/phase1/diff.ts')),
      import(moduleUrl('src/phase1/patch.ts')),
    ]);
    return {
      toVdom: (node) => domModule.domToVdom(node),
      update: (container, oldV, newV) => patchModule.applyPatches(container, diffModule.diff(oldV, newV)),
      diff: (oldV, newV) => diffModule.diff(oldV, newV),
    };
  },

  /* 페이지 테스트용 */
  page: {
    file: path.join(ROOT, 'index.html'), // open 이 있으면 쓰지 않음 (참고용)
    selectors: {
      actual: '[data-role="real"]',
      test: '[data-role="code"]',
      patch: '[data-role="patch"]',
      back: '[data-role="back"]',
      forward: '[data-role="forward"]',
    },
    io: H.textareaIO,
    settleMs: 50,
    open: openLabPage,
  },
};
