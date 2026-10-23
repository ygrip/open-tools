(() => {
  'use strict';
  const payload = document.getElementById('__tool_ui_phrase_pack');
  if (!payload) return;
  const pack = JSON.parse(payload.textContent);
  const supported = ['en','id','ms','fil','th','vi','zh','my','km','lo','ja','hi'];
  const translations = {};
  for (const language of supported.slice(2)) {
    translations[language] = Object.fromEntries(pack.keys.map((key, i) => [key, pack[language][i]]));
  }
  const trackedText = new WeakMap();
  const trackedAttrs = new WeakMap();
  const target = 'button,label,h1,h2,h3,h4,summary,[role="button"],[data-i18n],[data-t],.eyebrow,.tab,[role="tab"],.status';
  const excluded = 'script,style,pre,code,textarea,[contenteditable="true"],[data-user-content]';
  let requested = null;
  function currentLanguage() {
    const value = String(requested || window.trickIt?.locale || document.documentElement.lang || 'en').toLowerCase().split(/[-_]/)[0];
    return supported.includes(value) ? value : 'en';
  }
  function translated(source, language) {
    if (language === 'en' || language === 'id') return source;
    const trimmed = source.trim();
    const replacement = translations[language][trimmed];
    return replacement ? source.replace(trimmed, replacement) : source;
  }
  function visitText(node, language) {
    const parent = node.parentElement;
    if (!parent || parent.closest(excluded) || !parent.closest(target)) return;
    const previous = trackedText.get(node);
    const original = previous && node.nodeValue === previous.display ? previous.original : node.nodeValue;
    if (!original || !original.trim()) return;
    const display = translated(original, language);
    trackedText.set(node, {original, display});
    if (display !== node.nodeValue) node.nodeValue = display;
  }
  function visitAttribute(node, attribute, language) {
    if (node.closest(excluded) || !node.hasAttribute(attribute)) return;
    const previous = trackedAttrs.get(node) || {};
    const current = node.getAttribute(attribute);
    const old = previous[attribute];
    const original = old && current === old.display ? old.original : current;
    const display = translated(original, language);
    previous[attribute] = {original, display};
    trackedAttrs.set(node, previous);
    if (display !== current) node.setAttribute(attribute, display);
  }
  function visit(root, language) {
    if (root.nodeType === Node.TEXT_NODE) {visitText(root, language);return;}
    if (root.nodeType !== Node.ELEMENT_NODE || root.matches(excluded)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) visitText(current, language);
    for (const el of [root, ...root.querySelectorAll('[aria-label],[title],[placeholder]')]) {
      for (const attr of ['aria-label','title','placeholder']) visitAttribute(el, attr, language);
    }
  }
  function refresh() {
    const language = currentLanguage();
    document.documentElement.lang = language;
    visit(document.body, language);
  }
  const observer = new MutationObserver((mutations) => {
    const language = currentLanguage();
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') visitText(mutation.target, language);
      else if (mutation.type === 'attributes') visitAttribute(mutation.target, mutation.attributeName, language);
      else for (const node of mutation.addedNodes) visit(node, language);
    }
  });
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['aria-label','placeholder','title']});
  addEventListener('trick-it:localechange', (event) => {requested=event.detail?.locale || null;refresh();});
  refresh();
})();