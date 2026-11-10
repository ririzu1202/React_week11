/* IA 검사용 결함 Adapter : 실제 구현 Adapter(BASE_ADAPTER)에 그대로 맡기고, MUTANT_KIND 로 고른 결함 하나만 끼워 넣는다
   - baseline : 결함 없음. 원래 구현이 같은 테스트를 통과하는지 먼저 보는 기준선
   - 알 수 없는 MUTANT_KIND 는 바로 오류로 끝낸다 (오타가 "결함 없음" 으로 돌아 결과를 흐리지 않게) */
'use strict';

const basePath = process.env.BASE_ADAPTER;
if (!basePath) throw new Error('BASE_ADAPTER must point to the real implementation adapter');

const KINDS = new Set([
  'baseline', // 결함 없음
  'setup-error', // Adapter 초기화 오류 (IA-06)
  'noop-update', // update 가 아무것도 안 함 (IA-01 · IA-08)
  'full-rerender', // 결과는 같지만 자식 노드를 전부 새로 만듦 (IA-02)
  'mutate-on-read', // toVdom 이 원본 DOM 에 속성을 붙임 (IA-03)
  'noop-patch-button', // Patch 버튼을 눌러도 구현의 처리기가 돌지 않음 (IA-04)
  'noop-back-button', // 뒤로가기 버튼을 눌러도 구현의 처리기가 돌지 않음 (IA-05)
  'property-only-form', // 정상 변형 : 폼 값 · 체크를 속성 대신 프로퍼티로만 반영 (IA-07)
]);
const kind = process.env.MUTANT_KIND;
if (!KINDS.has(kind)) throw new Error(`알 수 없는 MUTANT_KIND : ${kind}`);

const base = require(basePath);
const H = require('../lib/harness');

/* 그 버튼으로 가는 click 이벤트를 창 맨 앞(capture 단계)에서 막는 함수
   btn.click() · dispatchEvent · 폼 제출 어느 쪽으로 눌러도 구현의 처리기가 돌지 않는다
   (구현이 페이지를 열 때 window capture 처리기를 먼저 붙였다면 그 처리기는 막지 못한다) */
function blockClicks(page, selector) {
  if (!page.document.querySelector(selector)) throw new Error(`결함을 넣을 버튼을 찾지 못했다 : ${selector}`);
  page.window.addEventListener('click', (event) => {
    const t = event.target;
    if (t && typeof t.closest === 'function' && t.closest(selector)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

module.exports = {
  ...base,
  async loadModules(window) {
    if (kind === 'setup-error') throw new Error('intentional selfcheck setup failure');
    const real = await base.loadModules(window);
    return {
      ...real,
      toVdom(node) {
        const vdom = real.toVdom(node);
        if (kind === 'mutate-on-read') node.setAttribute('data-mutated-by-inspector', '1');
        return vdom;
      },
      update(container, oldVdom, newVdom) {
        if (kind === 'noop-update') return undefined;

        const oldInputs = kind === 'property-only-form'
          ? Array.from(container.querySelectorAll('input')).map((input) => [
              input.getAttribute('value'),
              input.hasAttribute('checked'),
            ])
          : null;
        const result = real.update(container, oldVdom, newVdom);
        if (kind === 'full-rerender') {
          const root = result && result.nodeType === 1 ? result : container;
          root.replaceChildren(...Array.from(root.childNodes, (node) => node.cloneNode(true)));
        }
        if (kind === 'property-only-form') {
          const inputs = Array.from((result && result.nodeType === 1 ? result : container).querySelectorAll('input'));
          inputs.forEach((input, index) => {
            if (!oldInputs[index]) return;
            const [oldValue, wasChecked] = oldInputs[index];
            const liveValue = input.value;
            const liveChecked = input.checked;
            if (oldValue === null) input.removeAttribute('value');
            else input.setAttribute('value', oldValue);
            if (wasChecked) input.setAttribute('checked', '');
            else input.removeAttribute('checked');
            input.value = liveValue;
            input.checked = liveChecked;
          });
        }
        return result;
      },
    };
  },
  page: {
    ...base.page,
    async open(...args) {
      const page = typeof base.page.open === 'function'
        ? await base.page.open(...args)
        : await H.openPage({ ...base, page: { ...base.page, open: undefined } });
      const selector = kind === 'noop-patch-button'
        ? base.page.selectors.patch
        : kind === 'noop-back-button'
          ? base.page.selectors.back
          : null;
      if (selector) blockClicks(page, selector);
      return page;
    },
  },
};
