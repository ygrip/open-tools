/**
 * Host-owned syntax-highlighted code output.
 * Runs inside each opaque sandbox; source code never crosses the host bridge.
 * Highlight.js is the BSD-3-Clause 11.12.0 CDN build (see highlight-runtime.ts).
 */
export const codeBlockStyles = `
.ti-code { --ti-code-bg: #fffaf3; --ti-code-foreground: #352e39; --ti-code-keyword: #8e42a1; --ti-code-string: #20754e; --ti-code-number: #975416; --ti-code-function: #265caa; --ti-code-comment: #716776; width: 100%; min-width: 0; max-width: 100%; overflow: hidden; background: var(--ot-surface); color: var(--ot-text); border: 1px solid var(--ot-border); border-radius: 18px; box-shadow: inset 1px 2px 1px var(--ot-highlight), 0 4px 0 -1px var(--ot-border); font: inherit; }
:root[data-theme="dark"] .ti-code { --ti-code-bg: #24252c; --ti-code-foreground: #f4eaf1; --ti-code-keyword: #dfa7fb; --ti-code-string: #9de0ab; --ti-code-number: #f1c78f; --ti-code-function: #94bbff; --ti-code-comment: #b7acbd; }
.ti-code-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; padding: 9px 12px; min-width: 0; border-bottom: 1px solid var(--ot-border); background: var(--ot-surface); }
.ti-code-title { flex: 1 1 auto; min-width: 0; font-size: 12px; line-height: 1.4; font-weight: 800; color: var(--ot-muted); overflow-wrap: anywhere; }
.ti-code-action { flex: 0 0 auto; min-width: 44px; min-height: 44px; padding: 7px 12px; border: 1px solid var(--ot-border); border-radius: 12px; color: var(--ot-text); background: var(--ot-bg); font: inherit; font-size: 12px; font-weight: 750; cursor: pointer; }
.ti-code-action[hidden] { display: none; }
.ti-code-action:hover { background: var(--ot-surface); }
.ti-code-action:focus-visible { outline: 3px solid var(--ot-accent); outline-offset: 2px; }
.ti-code pre { width: 100%; max-width: 100%; min-width: 0; overflow-x: auto; overflow-y: hidden; margin: 0; padding: clamp(12px, 3vw, 18px); border: 0; background: var(--ti-code-bg); color: var(--ti-code-foreground); font: 13px/1.65 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace; tab-size: 2; white-space: pre; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
.ti-code code { display: block; width: max-content; min-width: 100%; font: inherit; white-space: inherit; overflow-wrap: normal; color: inherit; background: transparent; padding: 0; border: 0; }
.ti-code[data-wrap="true"] pre { white-space: pre-wrap; }
.ti-code[data-wrap="true"] code { width: auto; min-width: 0; overflow-wrap: anywhere; }
.ti-code .hljs-keyword, .ti-code .hljs-selector-tag, .ti-code .hljs-literal, .ti-code .hljs-operator { color: var(--ti-code-keyword); }
.ti-code .hljs-string, .ti-code .hljs-attr, .ti-code .hljs-template-variable, .ti-code .hljs-regexp, .ti-code .hljs-addition { color: var(--ti-code-string); }
.ti-code .hljs-number, .ti-code .hljs-built_in, .ti-code .hljs-type, .ti-code .hljs-params, .ti-code .hljs-symbol { color: var(--ti-code-number); }
.ti-code .hljs-title, .ti-code .hljs-function, .ti-code .hljs-property, .ti-code .hljs-attribute, .ti-code .hljs-selector-class, .ti-code .hljs-selector-id { color: var(--ti-code-function); }
.ti-code .hljs-comment, .ti-code .hljs-quote, .ti-code .hljs-meta { color: var(--ti-code-comment); font-style: italic; }
.ti-code .hljs-deletion { color: #c14747; }
:root[data-theme="dark"] .ti-code .hljs-deletion { color: #ff9c9c; }
@media (max-width: 375px) { .ti-code-head { padding: 6px 9px; } .ti-code pre { font-size: 12px; } }
@media (prefers-reduced-motion: reduce) { .ti-code pre { scroll-behavior: auto; } }
`;

/** Runs in sandbox SDK scope after the Highlight.js library, before ui is constructed. */
export const codeBlockScript = `
    function codeBlock(target, options = {}) {
      const host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!(host instanceof Element)) throw new TypeError('trickIt.ui.codeBlock needs a target element.');
      const root = document.createElement('section');
      root.className = 'ti-code';
      const head = document.createElement('div'); head.className = 'ti-code-head';
      const title = document.createElement('span'); title.className = 'ti-code-title';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'ti-code-action';
      const pre = document.createElement('pre'); const content = document.createElement('code');
      pre.append(content); head.append(title, button); root.append(head, pre); host.append(root);
      let data = { code: '', language: 'plaintext', wrap: false, copy: false, ...options };
      let active = true;
      const labels = () => document.documentElement.lang === 'id' ?
        { copy: 'Salin kode', copied: 'Tersalin', error: 'Tidak dapat menyalin', unavailable: 'Izin menyalin belum tersedia' } :
        { copy: 'Copy code', copied: 'Copied', error: 'Could not copy', unavailable: 'Copy permission is not available' };
      function localize() { button.textContent = labels().copy; button.setAttribute('aria-label', labels().copy); }
      function update(next = {}) {
        if (!active) return controller;
        data = { ...data, ...next };
        const source = String(data.code ?? '');
        if (source.length > 2 * 1024 * 1024) throw new RangeError('Code block exceeds 2 MiB.');
        const language = typeof data.language === 'string' ? data.language.toLowerCase().replace(/^language-/, '') : 'plaintext';
        const grammar = language === 'auto' ? 'auto' : hljs.getLanguage(language) ? language : 'plaintext';
        const caption = typeof data.title === 'string' && data.title.trim() ? data.title : (grammar === 'auto' ? 'Code' : language);
        title.textContent = caption.slice(0, 200);
        root.setAttribute('aria-label', caption.slice(0, 200));
        root.dataset.wrap = String(data.wrap === true);
        button.hidden = data.copy !== true;
        button.disabled = data.copy === true && !config.permissions.includes('clipboard-write');
        button.title = button.disabled ? labels().unavailable : labels().copy;
        // Highlight.js escapes source before returning markup. Fallback uses textContent;
        // never accept HTML supplied by the tool or auto-execute fenced content.
        if (source.length <= 100000 && grammar !== 'plaintext' && typeof hljs !== 'undefined') {
          try {
            const result = grammar === 'auto' ? hljs.highlightAuto(source) : hljs.highlight(source, { language: grammar, ignoreIllegals: true });
            content.innerHTML = result.value;
          } catch { content.textContent = source; }
        } else content.textContent = source;
        return controller;
      }
      async function copy() {
        if (!active || !config.permissions.includes('clipboard-write')) return;
        try {
          await request('clipboard-write', String(data.code ?? ''));
          if (active) { button.textContent = labels().copied; button.setAttribute('aria-label', labels().copied); }
        } catch {
          if (active) { button.textContent = labels().error; button.setAttribute('aria-label', labels().error); }
        }
      }
      button.addEventListener('click', copy);
      addEventListener('trick-it:localechange', localize);
      function remove() { active = false; removeEventListener('trick-it:localechange', localize); button.removeEventListener('click', copy); root.remove(); }
      const controller = Object.freeze({ element: root, update, remove });
      localize(); update();
      return controller;
    }
`;
