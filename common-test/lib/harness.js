/* 공통 테스트가 쓰는 도구 : Adapter 불러오기 · 정규화 비교 · 페이지 열기 */
'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { JSDOM, VirtualConsole } = require('jsdom');

/* 환경 변수 ADAPTER 로 지정한 Adapter 파일을 불러오는 함수 */
function loadAdapter() {
  const file = process.env.ADAPTER;
  if (!file) throw new Error('ADAPTER 환경 변수로 Adapter 파일 경로를 지정하세요 (예: ADAPTER=adapters/jonghwi.js)');
  const adapter = require(path.resolve(file));
  for (const key of ['name', 'loadModules', 'page']) {
    if (!(key in adapter)) throw new Error(`Adapter 에 ${key} 가 없습니다 (ADAPTER.md 참고)`);
  }
  return adapter;
}

/* 모듈 테스트가 함께 쓰는 브라우저 창 하나를 만드는 함수 */
function createModuleWindow() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  return dom.window;
}

/* HTML 문자열을 그 창의 div 컨테이너 안에 파싱해 돌려주는 함수 */
function makeContainer(window, html) {
  const div = window.document.createElement('div');
  div.innerHTML = html;
  window.document.body.appendChild(div);
  return div;
}

/* HTML 문자열을 실행 없이 파싱해 자식 노드 묶음으로 돌려주는 함수 */
function parseFragment(document, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  return tpl.content;
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/* 노드의 자식들을 구현과 상관없는 정규화 문자열로 바꾸는 함수
   - 속성은 이름순, 주석은 뺌, 붙은 글자는 합침
   - looseSpace : 화면에 보이는 대로 공백을 다룬다 (페이지 비교 전용 — 공백 처리는 판단 필요 J4)
     · 공백 여러 개 → 한 칸, 요소의 처음 · 끝 글자는 앞 · 뒤 공백을 지움, 비면 뺌
     · pre · textarea · script · style 안은 그대로 */
const RAW = new Set(['pre', 'textarea', 'script', 'style', 'listing', 'xmp']);
function canonChildren(parent, opts = {}, inRaw = false) {
  const items = [];
  let text = null;
  const flush = () => { if (text !== null) items.push({ text }); text = null; };
  const kids = parent.localName === 'template' && parent.content ? parent.content.childNodes : parent.childNodes;
  for (const n of Array.from(kids)) {
    if (n.nodeType === 3) { text = (text || '') + n.nodeValue; continue; }
    if (n.nodeType !== 1) continue;
    flush();
    items.push({ el: canonElement(n, opts, inRaw) });
  }
  flush();
  const loose = opts.looseSpace && !inRaw;
  return items.map((it, i) => {
    if (it.el !== undefined) return it.el;
    let t = it.text;
    if (loose) {
      t = t.replace(/\s+/g, ' ');
      if (i === 0) t = t.replace(/^ /, '');
      if (i === items.length - 1) t = t.replace(/ $/, '');
      if (t === '' || t === ' ') return '';
    }
    return `#text(${JSON.stringify(t)})`;
  }).join('');
}

/* 요소 하나를 정규화 문자열로 바꾸는 함수 */
function canonElement(el, opts, inRaw) {
  const ns = el.namespaceURI === 'http://www.w3.org/1999/xhtml' ? '' : `{${el.namespaceURI}}`;
  const attrs = Array.from(el.attributes)
    .map((a) => `${a.name}=${JSON.stringify(a.value)}`)
    .sort()
    .join(' ');
  const open = `<${ns}${el.localName}${attrs ? ' ' + attrs : ''}>`;
  if (VOID.has(el.localName)) return open;
  return `${open}${canonChildren(el, opts, inRaw || RAW.has(el.localName))}</${el.localName}>`;
}

/* HTML 문자열을 정규화 문자열로 바꾸는 함수 */
function canonHtml(document, html, opts) {
  return canonChildren(parseFragment(document, html), opts);
}

/* 요소 아래의 모든 요소 노드를 배열로 모으는 함수 */
function allElements(root) {
  return Array.from(root.querySelectorAll('*'));
}

/* 그 컨테이너 아래에서 일어난 DOM 변경을 세는 관찰자를 붙이는 함수 */
function watch(window, root) {
  const records = [];
  const ob = new window.MutationObserver((list) => records.push(...list));
  ob.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  return {
    take() {
      records.push(...ob.takeRecords());
      return records.splice(0);
    },
    stop() { ob.disconnect(); },
  };
}

/* 검증 페이지를 jsdom 으로 열고 스크립트 오류를 모으는 함수 */
async function openPage(adapter) {
  if (typeof adapter.page.open === 'function') return adapter.page.open();
  const file = path.resolve(adapter.page.file);
  if (!fs.existsSync(file)) throw new Error(`페이지 파일이 없습니다: ${file}`);
  const errors = [];
  const vc = new VirtualConsole();
  // jsdom 이 아직 못 하는 기능("Not implemented") · 스타일 · 이미지 로드 실패는 구현의 오류가 아니라서 뺀다
  vc.on('jsdomError', (e) => {
    const msg = String(e && e.message);
    if (/^Not implemented/.test(msg) || /Could not load (link|img)/i.test(msg)) return;
    errors.push(e);
  });
  const dom = await JSDOM.fromFile(file, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === 'complete') resolve();
    else dom.window.addEventListener('load', resolve);
  });
  await new Promise((r) => setTimeout(r, adapter.page.settleMs ?? 50));
  return { window: dom.window, document: dom.window.document, errors, close: () => dom.window.close() };
}

/* textarea 처럼 HTML 글을 담는 테스트 영역용 읽기 · 쓰기 */
const textareaIO = {
  read: (el) => el.value,
  write(el, html) {
    el.value = html;
    el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
  },
};

/* 렌더링된 편집 영역(contenteditable 등)용 읽기 · 쓰기 */
const editableIO = {
  read: (el) => el.innerHTML,
  write(el, html) {
    el.innerHTML = html;
    el.dispatchEvent(new el.ownerDocument.defaultView.Event('input', { bubbles: true }));
  },
};

/* 스크립트 파일들을 그 창 안에서 순서대로 실행하는 함수 (script 태그 방식 구현용) */
function evalScripts(window, files) {
  for (const f of files) window.eval(fs.readFileSync(f, 'utf8'));
}

/* 화면 비동기 갱신을 기다리는 함수 (버튼 클릭 뒤) */
function settle(adapter) {
  return new Promise((r) => setTimeout(r, adapter.page.settleMs ?? 50));
}

module.exports = {
  loadAdapter, createModuleWindow, makeContainer, parseFragment,
  canonChildren, canonHtml, allElements, watch,
  openPage, textareaIO, editableIO, evalScripts, settle,
};
