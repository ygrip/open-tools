import { tableStyles, tableScript } from './ui-table';

/**
 * Host-owned clay UI kit injected into every tool sandbox as `trickIt.ui`.
 *
 * - `status(target, options)` renders an inline waiting / working / done / error
 *   card inside the tool (no data leaves the frame).
 *   Finished (done/error) cards have a close button; `dismiss()` hides the card and the
 *   next state change shows it again.
 * - `loader(target, options)` reuses the status card for asset download,
 *   verified-byte progress and tool-owned initialization, with EN/ID defaults.
 *   A completed loader hides itself after a moment (`autoHide: false` keeps it).
 * - `fileInput(target, options)` renders a shared clay drop zone: configurable
 *   copy, accepted types and size/count limits, validated before `onChange`.
 * - `toast(message, options)` and `dialog/confirm/info(options)` are rendered by the host in
 *   the real viewport (a self-sizing iframe has no useful fixed viewport) and are
 *   clearly attributed to the tool. They need no permission and carry text only.
 *   A standalone file without a host falls back to in-frame rendering.
 *
 * Styles use the `ti-` prefix and the `--ot-*` theme tokens, and can be restyled
 * by the tool. Motion respects prefers-reduced-motion.
 */
export const uiKitStyles = `
.ti-status { --ti-tone: var(--ot-accent); display: flex; align-items: center; gap: 16px; min-width: 0; margin: 16px 0; padding: 18px 20px; border: 1px solid var(--ot-border); border-radius: 22px; background: var(--ot-surface); color: var(--ot-text); box-shadow: 0 5px 0 -1px var(--ot-border), 0 14px 26px -16px var(--ot-shadow), inset 2px 3px 2px var(--ot-highlight); font: inherit; overflow-wrap: anywhere; animation: ti-rise .3s cubic-bezier(.22,1,.36,1); }
.ti-status[data-state="done"] { --ti-tone: #7fbf9a; }
.ti-status[data-state="error"] { --ti-tone: #e7826f; animation: ti-shake .4s ease-in-out; }
.ti-status[hidden] { display: none; }
.ti-close { flex: 0 0 44px; width: 44px; height: 44px; min-height: 0; padding: 0; align-self: flex-start; margin: -8px -10px -8px 0; border: 0; border-radius: 14px; background: transparent; color: var(--ot-muted); display: grid; place-items: center; cursor: pointer; font: inherit; }
.ti-close[hidden] { display: none; }
.ti-close:hover, .ti-close:focus-visible { background: var(--ot-bg); color: var(--ot-text); }
.ti-close svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
.ti-orb { position: relative; flex: 0 0 52px; width: 52px; height: 52px; border-radius: 18px; display: grid; place-items: center; background: color-mix(in srgb, var(--ti-tone) 26%, var(--ot-surface)); box-shadow: 0 4px 0 color-mix(in srgb, var(--ti-tone) 45%, var(--ot-border)), inset 2px 3px 2px var(--ot-highlight); }
.ti-orb svg { width: 26px; height: 26px; fill: none; stroke: color-mix(in srgb, var(--ti-tone), var(--ot-text) 55%); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.ti-dots { display: flex; gap: 5px; }
.ti-dots i { width: 9px; height: 9px; border-radius: 50%; background: color-mix(in srgb, var(--ti-tone), var(--ot-text) 25%); animation: ti-bounce .7s cubic-bezier(.22,1,.36,1) infinite alternate; }
.ti-dots i:nth-child(2) { animation-delay: .14s; } .ti-dots i:nth-child(3) { animation-delay: .28s; }
.ti-ring { width: 28px; height: 28px; border-radius: 50%; border: 4px solid color-mix(in srgb, var(--ti-tone) 30%, transparent); border-top-color: color-mix(in srgb, var(--ti-tone), var(--ot-text) 25%); animation: ti-spin .8s linear infinite; }
.ti-status[data-state="done"] .ti-orb svg { stroke-dasharray: 30; stroke-dashoffset: 30; animation: ti-draw .45s .1s cubic-bezier(.22,1,.36,1) forwards; }
.ti-copy { min-width: 0; flex: 1; }
.ti-title { display: block; font-weight: 800; line-height: 1.35; }
.ti-detail { display: block; margin-top: 3px; color: var(--ot-muted); font-size: .9em; line-height: 1.5; }
.ti-detail:empty { display: none; }
.ti-bar { height: 12px; margin-top: 10px; border-radius: 99px; background: var(--ot-bg); box-shadow: inset 1px 2px 3px var(--ot-shadow); overflow: hidden; }
.ti-bar[hidden] { display: none; }
.ti-loader-meta { display: block; margin-top: 8px; color: var(--ot-muted); font-size: .8em; font-weight: 750; font-variant-numeric: tabular-nums; }
.ti-loader-meta:empty { display: none; }
.ti-bar i { display: block; height: 100%; width: var(--ti-progress, 0%); border-radius: inherit; background: linear-gradient(180deg, color-mix(in srgb, var(--ti-tone), #fff 30%), var(--ti-tone)); box-shadow: inset 0 2px 0 rgba(255,255,255,.45); transition: width .3s cubic-bezier(.22,1,.36,1); }
.ti-toasts { position: fixed; left: 50%; bottom: 16px; z-index: 2147483000; display: grid; gap: 8px; width: min(420px, calc(100% - 24px)); transform: translateX(-50%); }
.ti-toast { display: flex; align-items: center; gap: 8px; padding: 12px 8px 12px 16px; border: 1px solid var(--ot-border); border-radius: 18px; background: var(--ot-surface); color: var(--ot-text); box-shadow: 0 5px 0 -1px var(--ot-border), 0 14px 26px -12px var(--ot-shadow); font-weight: 750; overflow-wrap: anywhere; animation: ti-rise .25s cubic-bezier(.22,1,.36,1); }
.ti-dialog { width: min(440px, calc(100% - 24px)); padding: 24px; border: 1px solid var(--ot-border); border-radius: 26px; background: var(--ot-surface); color: var(--ot-text); box-shadow: 0 7px 0 -2px var(--ot-border), 0 24px 40px -18px var(--ot-shadow); overflow-wrap: anywhere; }
.ti-dialog::backdrop { background: rgb(27 22 25 / .5); }
.ti-dialog h2 { margin: 0 0 8px; font-size: 1.25rem; }
.ti-dialog p, .ti-dialog li { margin: 0; color: var(--ot-muted); line-height: 1.55; }
.ti-dialog ol, .ti-dialog ul { margin: 12px 0 0; padding-left: 22px; display: grid; gap: 8px; }
.ti-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
.ti-actions button { min-height: 46px; padding: 10px 18px; border-radius: 16px; border: 1px solid var(--ot-border); background: var(--ot-bg); color: var(--ot-text); font: inherit; font-weight: 800; box-shadow: 0 4px 0 var(--ot-border), inset 1px 2px 2px var(--ot-highlight); cursor: pointer; }
.ti-actions button.ti-primary { background: var(--ot-accent); color: var(--ot-on-accent); }
.ti-drop.ti-drop { --ti-tone: var(--ot-accent); position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10px; min-width: 0; margin: 12px 0; padding: 26px 20px; font-size: 15px; font-weight: 400; line-height: 1.4; letter-spacing: normal; text-transform: none; border: 2px dashed color-mix(in srgb, var(--ot-border), var(--ot-text) 18%); border-radius: 26px; background: var(--ot-surface); color: var(--ot-text); text-align: center; box-shadow: 0 5px 0 -1px var(--ot-border), inset 2px 3px 2px var(--ot-highlight); cursor: pointer; overflow-wrap: anywhere; transition: border-color .2s, background-color .2s, transform .2s cubic-bezier(.22,1,.36,1); }
.ti-drop:hover, .ti-drop:focus-within { border-color: var(--ti-tone); }
.ti-drop[data-dragging] { border-style: solid; border-color: var(--ti-tone); background: color-mix(in srgb, var(--ti-tone) 12%, var(--ot-surface)); transform: scale(1.01); }
.ti-drop[data-error] { --ti-tone: #e7826f; border-color: #e7826f; animation: ti-shake .4s ease-in-out; }
.ti-drop[data-disabled] { opacity: .6; cursor: not-allowed; }
.ti-drop input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: inherit; }
.ti-drop .ti-orb svg { stroke-width: 2.4; }
.ti-drop-label { display: block; font-weight: 850; font-size: 1.05em; line-height: 1.35; }
.ti-drop-hint { display: block; color: var(--ot-muted); font-size: .88em; line-height: 1.5; }
.ti-drop-button { position: relative; pointer-events: none; display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; padding: 10px 18px; border: 1px solid color-mix(in srgb, var(--ot-accent), #6e3b24 22%); border-radius: 15px; background: var(--ot-accent); color: var(--ot-on-accent); font-weight: 850; box-shadow: 0 4px 0 color-mix(in srgb, var(--ot-accent), #6e3b24 30%), inset 1px 2px 2px rgba(255,255,255,.4); }
.ti-drop-error { display: block; color: color-mix(in srgb, #e7826f, var(--ot-text) 45%); font-weight: 800; font-size: .9em; }
.ti-drop-error:empty, .ti-files:empty { display: none; }
.ti-files { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 4px; }
.ti-file { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 10px; max-width: 100%; padding: 6px; border: 1px solid var(--ot-border); border-radius: 20px; background: var(--ot-bg); font-size: .85em; font-weight: 750; box-shadow: 0 3px 0 var(--ot-border); animation: ti-rise .25s cubic-bezier(.22,1,.36,1); }
.ti-thumb { flex: 0 0 44px; width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; overflow: hidden; background: color-mix(in srgb, var(--ot-accent) 22%, var(--ot-surface)); color: color-mix(in srgb, var(--ot-accent), var(--ot-text) 60%); font-size: .7em; font-weight: 900; letter-spacing: .04em; box-shadow: inset 1px 2px 2px var(--ot-highlight); }
.ti-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ti-file > span:not(.ti-thumb) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ti-file small { color: var(--ot-muted); white-space: nowrap; }
.ti-file button { flex: 0 0 28px; width: 28px; height: 28px; min-height: 0; padding: 0; border: 0; border-radius: 50%; background: var(--ot-surface); color: var(--ot-muted); font: inherit; font-weight: 900; cursor: pointer; }
@keyframes ti-rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes ti-bounce { to { transform: translateY(-8px); } }
@keyframes ti-spin { to { transform: rotate(360deg); } }
@keyframes ti-draw { to { stroke-dashoffset: 0; } }
@keyframes ti-shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
@media (prefers-reduced-motion: reduce) { .ti-status, .ti-toast, .ti-dots i, .ti-ring, .ti-status[data-state="done"] .ti-orb svg, .ti-drop, .ti-file { animation: none; stroke-dashoffset: 0; transition: none; } }
${tableStyles}
`;

/**
 * Script fragment evaluated inside the SDK closure. It expects `config` and
 * `request` in scope and defines `ui`.
 */
export const uiKitScript = `
    const clip = (value, max) => typeof value === 'string' ? value.slice(0, max) : '';
    const icons = { done: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', error: '<svg viewBox="0 0 24 24"><path d="M12 7v6M12 17h.01"/></svg>' };
    function status(target, options = {}) {
      const host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!(host instanceof Element)) throw new TypeError('trickIt.ui.status needs a target element.');
      const card = document.createElement('div'); card.className = 'ti-status';
      const orb = document.createElement('span'); orb.className = 'ti-orb'; orb.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span'); copy.className = 'ti-copy';
      const title = document.createElement('strong'); title.className = 'ti-title';
      const detail = document.createElement('span'); detail.className = 'ti-detail';
      const bar = document.createElement('span'); bar.className = 'ti-bar'; bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.append(document.createElement('i'));
      const close = document.createElement('button'); close.type = 'button'; close.className = 'ti-close'; close.hidden = true;
      close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      close.addEventListener('click', () => dismiss());
      copy.append(title, detail, bar); card.append(orb, copy, close); host.append(card);
      let state = '';
      function dismiss() { card.hidden = true; if (typeof options.onDismiss === 'function') options.onDismiss(); }
      function update(next = {}) {
        close.setAttribute('aria-label', document.documentElement.lang === 'id' ? 'Tutup' : 'Close');
        // A new state (or new text) shows a dismissed card again; quiet re-renders (locale) do not.
        if (!next.quiet && ((next.state && next.state !== state) || ('title' in next && next.title !== title.textContent))) card.hidden = false;
        if (next.state && next.state !== state) {
          state = ['waiting', 'working', 'done', 'error'].includes(next.state) ? next.state : 'working';
          card.dataset.state = state;
          card.setAttribute('role', state === 'error' ? 'alert' : 'status');
          orb.innerHTML = state === 'waiting' ? '<span class="ti-dots"><i></i><i></i><i></i></span>' : state === 'working' ? '<span class="ti-ring"></span>' : icons[state];
          close.hidden = state === 'waiting' || state === 'working';
        }
        if ('title' in next) title.textContent = clip(next.title, 300);
        if ('detail' in next) detail.textContent = clip(next.detail, 1000);
        const value = Number(next.progress);
        const hasProgress = state === 'working' && next.progress !== undefined && next.progress !== null && Number.isFinite(value);
        if ('progress' in next || next.state) {
          bar.hidden = !hasProgress;
          if (hasProgress) { const percent = Math.max(0, Math.min(100, value)); card.style.setProperty('--ti-progress', percent + '%'); bar.setAttribute('aria-valuenow', String(Math.round(percent))); }
        }
        card.setAttribute('aria-busy', String(state === 'waiting' || state === 'working'));
        return controller;
      }
      const controller = Object.freeze({
        update, dismiss, element: card,
        wait: (title, detail) => update({ state: 'waiting', title, detail }),
        work: (title, detail, progress) => update({ state: 'working', title, detail, progress }),
        done: (title, detail) => update({ state: 'done', title, detail }),
        fail: (title, detail) => update({ state: 'error', title, detail }),
        remove: () => card.remove()
      });
      return update({ state: 'waiting', title: '', detail: '', ...options });
    }
    function localToast(message) {
      let stack = document.querySelector('.ti-toasts');
      if (!stack) { stack = document.createElement('div'); stack.className = 'ti-toasts'; stack.setAttribute('role', 'status'); stack.setAttribute('aria-live', 'polite'); document.body.append(stack); }
      // The same message replaces its earlier copy instead of stacking.
      for (const existing of Array.from(stack.children)) if (existing.firstElementChild?.textContent === message) existing.remove();
      const item = document.createElement('div'); item.className = 'ti-toast';
      const text = document.createElement('span'); text.textContent = message; text.style.flex = '1';
      const close = document.createElement('button'); close.type = 'button'; close.className = 'ti-close'; close.style.margin = '0';
      close.setAttribute('aria-label', document.documentElement.lang === 'id' ? 'Tutup' : 'Close');
      close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      close.addEventListener('click', () => item.remove());
      item.append(text, close); stack.append(item);
      while (stack.children.length > 3) stack.firstElementChild.remove();
      setTimeout(() => item.remove(), 4000);
    }
    function localDialog(options) {
      return new Promise(resolve => {
        const dialog = document.createElement('dialog'); dialog.className = 'ti-dialog';
        const heading = document.createElement('h2'); heading.textContent = options.title;
        dialog.append(heading);
        if (options.message) { const body = document.createElement('p'); body.textContent = options.message; dialog.append(body); }
        if (options.items.length) { const list = document.createElement(options.ordered ? 'ol' : 'ul'); for (const text of options.items) { const item = document.createElement('li'); item.textContent = text; list.append(item); } dialog.append(list); }
        const actions = document.createElement('div'); actions.className = 'ti-actions';
        const accept = document.createElement('button'); accept.type = 'button'; accept.className = 'ti-primary'; accept.textContent = options.confirmLabel || (options.kind === 'info' ? 'Got it' : 'Continue');
        const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
        if (options.kind === 'confirm') { const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = options.cancelLabel || 'Cancel'; cancel.onclick = () => finish(false); actions.append(cancel); }
        accept.onclick = () => finish(true); actions.append(accept); dialog.append(actions); document.body.append(dialog);
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        dialog.showModal();
      });
    }
    function toast(message, options = {}) {
      const payload = { message: clip(String(message ?? ''), 240), tone: ['info', 'success', 'error'].includes(options.tone) ? options.tone : 'info' };
      if (!payload.message) return Promise.resolve();
      if (!config.token) { localToast(payload.message); return Promise.resolve(); }
      return request('ui-toast', payload).then(() => undefined, () => localToast(payload.message));
    }
    // A busy host (another popup or a permission prompt is open) is not a reason to
    // open a modal inside the iframe: wait briefly, then give up with 'false'.
    async function hostDialog(payload) {
      for (let attempt = 0; attempt < 40; attempt++) {
        try { return (await request('ui-dialog', payload)) === true; }
        catch (error) {
          if (error?.code !== 'busy') return localDialog(payload);
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      return false;
    }
    // Centralized popups: rendered by the host, centred in the real viewport.
    function dialog(options = {}) {
      const items = Array.isArray(options.items) ? options.items.slice(0, 12).map(item => clip(String(item ?? ''), 300)).filter(Boolean) : [];
      const payload = { kind: options.kind === 'confirm' ? 'confirm' : 'info', title: clip(options.title, 120) || (options.kind === 'confirm' ? 'Continue?' : 'Note'), message: clip(options.message, 800), items, ordered: options.ordered === true, confirmLabel: clip(options.confirmLabel, 40), cancelLabel: clip(options.cancelLabel, 40), tone: options.tone === 'danger' ? 'danger' : 'default' };
      if (!config.token) return localDialog(payload);
      return hostDialog(payload);
    }
    const confirm = (options = {}) => dialog({ ...options, kind: 'confirm' });
    const info = (options = {}) => dialog({ ...options, kind: 'info' });
    const fileCopy = { en: { label: 'Drop a file here', labelMany: 'Drop files here', choose: 'Choose file', chooseMany: 'Choose files', upTo: 'up to', any: 'Any file', type: 'This file type is not supported.', size: 'This file is larger than', count: 'Too many files. Maximum:', remove: 'Remove' }, id: { label: 'Letakkan berkas di sini', labelMany: 'Letakkan berkas di sini', choose: 'Pilih berkas', chooseMany: 'Pilih berkas', upTo: 'maks.', any: 'Semua berkas', type: 'Jenis berkas ini tidak didukung.', size: 'Berkas ini lebih besar dari', count: 'Terlalu banyak berkas. Maksimal:', remove: 'Hapus' } };
    const formatBytes = bytes => bytes >= 1048576 ? (bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0) + ' MB' : bytes >= 1024 ? Math.round(bytes / 1024) + ' KB' : bytes + ' B';
    const loaderCopy = {
      en: { waiting: 'Ready to load', loading: 'Loading asset…', verifying: 'Checking asset integrity…', initializing: 'Preparing engine…', done: 'Asset ready', error: 'Could not load asset', failed: 'Check your connection and access permissions, then retry. Your input is preserved.' },
      id: { waiting: 'Siap memuat', loading: 'Memuat aset…', verifying: 'Memeriksa integritas aset…', initializing: 'Menyiapkan mesin…', done: 'Aset siap', error: 'Gagal memuat aset', failed: 'Periksa koneksi dan izin akses, lalu coba lagi. Input Anda tetap tersimpan.' }
    };
    // Inline, never a blocking popup. Only the host downloads and verifies pinned assets.
    function loader(target, options = {}) {
      const card = status(target);
      card.element.classList.add('ti-loader');
      const meta = document.createElement('span'); meta.className = 'ti-loader-meta';
      card.element.querySelector('.ti-copy').append(meta);
      let model = { phase: 'waiting', loaded: null, total: null, title: '', detail: '', ...options };
      let removed = false, busy = false, hideTimer = 0;
      const autoHide = options.autoHide !== false;
      function render(event) {
        if (removed) return;
        const copy = loaderCopy[document.documentElement.lang === 'id' ? 'id' : 'en'];
        const phase = model.phase;
        const measurable = ['loading', 'verifying'].includes(phase) && Number.isFinite(model.loaded) && Number.isFinite(model.total) && model.loaded >= 0 && model.total > 0;
        const loaded = measurable ? Math.min(model.loaded, model.total) : 0;
        const percent = measurable ? Math.floor(loaded / model.total * 100) : null;
        card.update({ state: phase === 'waiting' ? 'waiting' : phase === 'error' ? 'error' : phase === 'done' ? 'done' : 'working', title: model.title || copy[phase], detail: model.detail || (phase === 'error' ? copy.failed : ''), progress: percent, quiet: event instanceof Event });
        clearTimeout(hideTimer);
        if (phase === 'done' && autoHide) hideTimer = setTimeout(() => { if (!removed && model.phase === 'done') card.dismiss(); }, 2500);
        meta.textContent = measurable ? formatBytes(loaded) + ' / ' + formatBytes(model.total) + ' · ' + percent + '%' : '';
        if (measurable) card.element.querySelector('[role="progressbar"]').setAttribute('aria-label', model.title || copy[phase]);
      }
      function update(next = {}) {
        if (next.phase && !['waiting', 'loading', 'verifying', 'initializing', 'done', 'error'].includes(next.phase)) throw new TypeError('Unknown loader phase.');
        model = { ...model, ...next }; render(); return controller;
      }
      const controller = Object.freeze({
        element: card.element, update,
        done: (title = '', detail = '') => update({ phase: 'done', title, detail }),
        fail: (title = '', detail = '') => update({ phase: 'error', title, detail }),
        async asset(id) {
          if (removed) throw new Error('This loader was removed.');
          if (busy) throw Object.assign(new Error('This loader is already loading an asset.'), { code: 'busy' });
          busy = true;
          update({ phase: 'loading', loaded: null, total: null, title: options.title || '', detail: clip(id, 120) });
          try {
            const result = await request('asset', { id }, progress => update(progress));
            controller.done(); return result;
          } catch (error) { controller.fail(); throw error; }
          finally { busy = false; }
        },
        remove() { removed = true; clearTimeout(hideTimer); removeEventListener('trick-it:localechange', render); card.remove(); }
      });
      update(model); addEventListener('trick-it:localechange', render); return controller;
    }
    const typeLabel = rule => rule.startsWith('.') ? rule.slice(1).toUpperCase() : rule.endsWith('/*') ? rule.slice(0, -2).replace(/^./, c => c.toUpperCase()) : (rule.split('/')[1] || rule).replace('svg+xml', 'svg').replace(/^x-/, '').toUpperCase();
    function accepts(file, rules) {
      if (!rules.length) return true;
      const name = file.name.toLowerCase(); const type = (file.type || '').toLowerCase();
      return rules.some(rule => rule.startsWith('.') ? name.endsWith(rule) : rule.endsWith('/*') ? type.startsWith(rule.slice(0, -1)) : type === rule);
    }
    // Shared clay file picker: click or drag-and-drop, validated type/size/count, localized copy.
    function fileInput(target, options = {}) {
      const host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!(host instanceof Element)) throw new TypeError('trickIt.ui.fileInput needs a target element.');
      const copy = () => fileCopy[document.documentElement.lang === 'id' ? 'id' : 'en'];
      const rules = (Array.isArray(options.accept) ? options.accept : typeof options.accept === 'string' ? options.accept.split(',') : []).map(rule => String(rule).trim().toLowerCase()).filter(Boolean);
      const multiple = options.multiple === true; const maxFiles = multiple ? Math.max(1, Number(options.maxFiles) || 20) : 1;
      const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : 0;
      const zone = document.createElement('label'); zone.className = 'ti-drop';
      const input = document.createElement('input'); input.type = 'file'; input.multiple = multiple; if (rules.length) input.accept = rules.join(',');
      const orb = document.createElement('span'); orb.className = 'ti-orb'; orb.setAttribute('aria-hidden', 'true'); orb.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14"/></svg>';
      const label = document.createElement('span'); label.className = 'ti-drop-label';
      const hint = document.createElement('span'); hint.className = 'ti-drop-hint';
      const button = document.createElement('span'); button.className = 'ti-drop-button'; button.setAttribute('aria-hidden', 'true');
      const error = document.createElement('span'); error.className = 'ti-drop-error'; error.setAttribute('role', 'alert');
      const list = document.createElement('span'); list.className = 'ti-files';
      zone.append(input, orb, label, hint, button, error, list); host.append(zone);
      let files = [];
      function text() {
        const t = copy();
        label.textContent = clip(options.label, 120) || (multiple ? t.labelMany : t.label);
        const auto = (rules.length ? rules.map(typeLabel).map(v => v === 'JPG' ? 'JPEG' : v).filter((v, i, a) => a.indexOf(v) === i).join(', ') : t.any) + (maxBytes ? ' · ' + t.upTo + ' ' + formatBytes(maxBytes) : '');
        hint.textContent = clip(options.hint, 240) || auto;
        button.textContent = clip(options.buttonLabel, 40) || (multiple ? t.chooseMany : t.choose);
        input.setAttribute('aria-label', label.textContent + '. ' + hint.textContent);
        renderList();
      }
      let previews = [];
      function renderList() {
        for (const url of previews) URL.revokeObjectURL(url);
        previews = [];
        list.replaceChildren(...files.map((file, index) => {
          const chip = document.createElement('span'); chip.className = 'ti-file';
          const thumb = document.createElement('span'); thumb.className = 'ti-thumb'; thumb.setAttribute('aria-hidden', 'true');
          // Local preview only: blob URLs never leave the sandbox.
          if (options.preview !== false && ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/bmp'].includes(file.type)) {
            const url = URL.createObjectURL(file); previews.push(url);
            const image = document.createElement('img'); image.src = url; image.alt = ''; thumb.append(image);
          } else thumb.textContent = (file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1] || 'file').slice(0, 4).toUpperCase();
          chip.append(thumb);
          const name = document.createElement('span'); name.textContent = file.name;
          const size = document.createElement('small'); size.textContent = formatBytes(file.size);
          const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = input.disabled; remove.setAttribute('aria-label', copy().remove + ' ' + file.name);
          remove.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (input.disabled) return; files = files.filter((_, i) => i !== index); renderList(); options.onChange?.(files.slice()); });
          chip.append(name, size, remove); return chip;
        }));
      }
      function fail(message) {
        error.textContent = message; zone.removeAttribute('data-error'); void zone.offsetWidth; zone.setAttribute('data-error', '');
        options.onError?.(message);
      }
      function take(list) {
        if (input.disabled) return;
        const t = copy(); const incoming = Array.from(list || []);
        if (!incoming.length) return;
        error.textContent = ''; zone.removeAttribute('data-error');
        if (incoming.length > maxFiles || (multiple && files.length + incoming.length > maxFiles)) return fail(t.count + ' ' + maxFiles);
        const wrongType = incoming.find(file => !accepts(file, rules)); if (wrongType) return fail(wrongType.name + ': ' + t.type);
        const tooBig = maxBytes && incoming.find(file => file.size > maxBytes); if (tooBig) return fail(tooBig.name + ': ' + t.size + ' ' + formatBytes(maxBytes) + '.');
        files = multiple ? files.concat(incoming) : incoming.slice(0, 1);
        renderList(); options.onChange?.(files.slice());
      }
      input.addEventListener('change', () => { take(input.files); input.value = ''; });
      for (const name of ['dragenter', 'dragover']) zone.addEventListener(name, event => { if (input.disabled) return; event.preventDefault(); zone.setAttribute('data-dragging', ''); });
      for (const name of ['dragleave', 'dragend']) zone.addEventListener(name, () => zone.removeAttribute('data-dragging'));
      zone.addEventListener('drop', event => { event.preventDefault(); zone.removeAttribute('data-dragging'); if (!input.disabled) take(event.dataTransfer?.files); });
      addEventListener('trick-it:localechange', text);
      text();
      return Object.freeze({
        element: zone,
        get files() { return files.slice(); },
        clear() { files = []; error.textContent = ''; zone.removeAttribute('data-error'); renderList(); },
        setDisabled(value) { input.disabled = !!value; for (const button of list.querySelectorAll('button')) button.disabled = input.disabled; if (value) { zone.setAttribute('data-disabled', ''); zone.removeAttribute('data-dragging'); } else zone.removeAttribute('data-disabled'); },
        setError(message) { if (message) fail(clip(String(message), 300)); else { error.textContent = ''; zone.removeAttribute('data-error'); } },
        remove() { removeEventListener('trick-it:localechange', text); for (const url of previews) URL.revokeObjectURL(url); zone.remove(); }
      });
    }
${tableScript}
    const ui = Object.freeze({ status, loader, fileInput, table, toast, dialog, confirm, info });
`;
