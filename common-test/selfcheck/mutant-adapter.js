/* 자체 검토용 "일부러 틀린 구현" — 테스트가 결함을 잡는지 보려고 만든다. 실제 Adapter 가 아니다
   MUTANT 환경 변수로 종류를 고른다. 바탕은 종휘 구현 (페이지 결함은 복사본 app.js 를 고쳐 만든다) */
'use strict';

const path = require('node:path');
const base = require('../adapters/jonghwi.js');

const kind = process.env.MUTANT;
const PAGE_ROOT = process.env.MUTANT_PAGE_ROOT;

module.exports = {
  ...base,
  name: `결함:${kind}`,
  loadModules(window) {
    const real = base.loadModules(window);
    const M = window.MiniReact;
    const filtered = (drop) => (c, o, n) => M.applyPatches(c, M.diff(o, n).filter((p) => !drop.includes(p.type)));
    switch (kind) {
      case 'full-rerender': // 결과는 맞지만 매번 통째로 다시 그림
        return { ...real, update: (c, o, n) => { M.mount(c, n); } };
      case 'noop': // 아무것도 안 고침
        return { ...real, update: () => {} };
      case 'no-remove': // 지우기를 빠뜨림
        return { ...real, update: filtered(['REMOVE']) };
      case 'no-props': // 속성 변경을 빠뜨림
        return { ...real, update: filtered(['PROPS']) };
      case 'no-text': // 글자 변경을 빠뜨림
        return { ...real, update: filtered(['TEXT']) };
      case 'innerhtml-text': // 글자를 HTML 로 해석해 넣음 (XSS 결함)
        return { ...real, update: (c, o, n) => { real.update(c, o, n); c.querySelectorAll('*').forEach((el) => { if (el.children.length === 0 && /[<>]/.test(el.textContent)) el.innerHTML = el.textContent; }); } };
      default:
        return real;
    }
  },
  page: PAGE_ROOT ? { ...base.page, file: path.join(PAGE_ROOT, 'index.html') } : base.page,
};

/* 공정성 확인용 "다르지만 맞는 구현" — 통과해야 한다 */
if (kind === 'ok-property-only-form') {
  const loadModules = module.exports.loadModules;
  module.exports.loadModules = (window) => {
    const real = base.loadModules(window);
    return {
      ...real,
      // 폼 값을 프로퍼티로만 반영하는 설계 흉내 : 결과는 같게 두고 value · checked 속성만 옛 값으로 되돌린다
      update: (c, o, n) => {
        const olds = Array.from(c.querySelectorAll('input')).map((i) => [i.getAttribute('value'), i.hasAttribute('checked')]);
        const r = real.update(c, o, n);
        Array.from((r || c).querySelectorAll('input')).forEach((i, k) => {
          if (!olds[k]) return;
          const [v, ch] = olds[k];
          const pv = i.value; const pc = i.checked;
          if (v === null) i.removeAttribute('value'); else i.setAttribute('value', v);
          if (ch) i.setAttribute('checked', ''); else i.removeAttribute('checked');
          i.value = pv; i.checked = pc;
        });
        return r;
      },
    };
  };
}
