/**
 * Shared sandbox table with an integrated control pane.
 * Injected by the host, not bundled into individual tools.
 * All consumer values are assigned as text, never parsed as markup.
 */
export const tableStyles = `
.ti-grid { min-width: 0; width: 100%; display: grid; gap: 12px; color: var(--ot-text); font: inherit; }
.ti-grid[hidden], .ti-grid-scroll[hidden], .ti-grid-empty[hidden] { display: none; }
.ti-grid-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; min-width: 0; }
.ti-grid-toolbar input, .ti-grid-toolbar select { box-sizing: border-box; display: block; width: 100%; height: 44px; min-height: 44px; padding: 8px 12px; margin: 0; border: 1px solid var(--ot-border); border-radius: 13px; background: var(--ot-bg); color: var(--ot-text); font: inherit; font-size: 13px; }
.ti-grid-search { flex: 1 1 190px; min-width: 0; }
.ti-grid-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
.ti-grid-select { min-width: 0; width: 85px; }
.ti-grid-select select { padding-right: 6px; }
.ti-grid-columns { position: relative; }
.ti-grid-columns summary { display: flex; align-items: center; justify-content: center; min-height: 44px; gap: 7px; padding: 9px 12px; border: 1px solid var(--ot-border); border-radius: 13px; background: var(--ot-bg); color: var(--ot-text); cursor: pointer; font-size: 13px; font-weight: 800; user-select: none; list-style: none; }
.ti-grid-columns summary::-webkit-details-marker { display: none; }
.ti-grid-columns summary::after { content: '▾'; font-size: 11px; }
.ti-grid-columns[open] summary { border-color: var(--ot-accent); }
.ti-grid-column-list { position: absolute; top: calc(100% + 6px); right: 0; z-index: 5; display: grid; gap: 5px; width: max-content; min-width: 180px; max-width: min(270px, calc(100vw - 40px)); max-height: 250px; overflow: auto; padding: 10px; border: 1px solid var(--ot-border); border-radius: 15px; background: var(--ot-surface); box-shadow: 0 10px 24px var(--ot-shadow); }
.ti-grid-column-list label { display: flex; align-items: center; gap: 10px; margin: 0; padding: 8px; border-radius: 9px; cursor: pointer; color: var(--ot-text); font: inherit; font-size: 13px; font-weight: 650; overflow-wrap: anywhere; }
.ti-grid-column-list label:hover { background: var(--ot-bg); }
.ti-grid-column-list input { flex: 0 0 18px; width: 18px; height: 18px; min-height: 18px; padding: 0; accent-color: var(--ot-accent); }
.ti-grid-density { min-width: 105px; }
.ti-grid-scroll { max-width: 100%; min-width: 0; overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; border: 1px solid var(--ot-border); border-radius: 16px; }
.ti-grid-scroll table { width: 100%; min-width: max-content; border-collapse: collapse; font: inherit; font-size: 13px; background: var(--ot-surface); }
.ti-grid-scroll th, .ti-grid-scroll td { padding: 11px 13px; border-bottom: 1px solid var(--ot-border); vertical-align: middle; text-align: left; color: var(--ot-text); }
.ti-grid[data-density="compact"] th, .ti-grid[data-density="compact"] td { padding: 7px 10px; }
.ti-grid-scroll th { position: sticky; top: 0; z-index: 1; white-space: nowrap; background: var(--ot-bg); color: var(--ot-muted); font-size: 12px; font-weight: 800; }
.ti-grid-scroll tbody tr:last-child td { border-bottom: 0; }
.ti-grid-scroll tbody tr:hover { background: color-mix(in srgb, var(--ot-accent) 10%, var(--ot-surface)); }
.ti-grid-sort { display: inline-flex; align-items: center; justify-content: flex-start; gap: 6px; width: auto; min-height: 34px; padding: 0; margin: 0; border: none; background: transparent; box-shadow: none; color: inherit; font: inherit; font-weight: inherit; text-align: left; cursor: pointer; }
.ti-grid-sort-indicator { color: var(--ot-muted); font-size: 11px; }
.ti-grid-cell { display: inline-block; max-width: 220px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ti-grid-copy { display: inline-grid; place-items: center; width: 34px; min-width: 34px; height: 34px; min-height: 34px; padding: 0; margin-left: 6px; vertical-align: middle; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--ot-muted); box-shadow: none; cursor: pointer; }
.ti-grid-copy:hover, .ti-grid-copy:focus-visible { background: var(--ot-bg); border-color: var(--ot-border); color: var(--ot-text); }
.ti-grid-copy svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.ti-grid-footer { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; color: var(--ot-muted); font-size: 12px; }
.ti-grid-pages { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.ti-grid-pages button { width: auto; min-width: 44px; min-height: 44px; padding: 7px 12px; margin: 0; border: 1px solid var(--ot-border); border-radius: 12px; background: var(--ot-bg); color: var(--ot-text); font: inherit; font-size: 13px; font-weight: 750; cursor: pointer; }
.ti-grid-pages button:disabled { cursor: not-allowed; opacity: .5; }
.ti-grid-empty { padding: 32px 18px; border: 1px dashed var(--ot-border); border-radius: 15px; background: var(--ot-surface); color: var(--ot-muted); text-align: center; font-size: 13px; }
.ti-grid button:focus-visible, .ti-grid input:focus-visible, .ti-grid select:focus-visible, .ti-grid summary:focus-visible { outline: 3px solid var(--ot-accent); outline-offset: 2px; }
@media (max-width: 540px) { .ti-grid-toolbar { align-items: stretch; } .ti-grid-search { flex-basis: 100%; } .ti-grid-tools { width: 100%; } .ti-grid-density { flex: 1 1 105px; } .ti-grid-footer { justify-content: center; text-align: center; } .ti-grid-scroll th, .ti-grid-scroll td { padding: 9px 10px; } .ti-grid-cell { max-width: 155px; } }
`;

export const tableScript = `
    const tableCopy = {
      en: { search: 'Search records', columns: 'Columns', rows: 'Rows', density: 'Density', comfortable: 'Comfortable', compact: 'Compact', copy: 'Copy', page: 'Page', of: 'of', showing: 'Showing', noResults: 'No matching rows.', previous: 'Previous page', next: 'Next page', sortAsc: 'Sort ascending', sortDesc: 'Sort descending' },
      id: { search: 'Cari data', columns: 'Kolom', rows: 'Baris', density: 'Kerapatan', comfortable: 'Normal', compact: 'Ringkas', copy: 'Salin', page: 'Halaman', of: 'dari', showing: 'Menampilkan', noResults: 'Tidak ada baris yang cocok.', previous: 'Halaman sebelumnya', next: 'Halaman berikutnya', sortAsc: 'Urut naik', sortDesc: 'Urut turun' }
    };
    function table(target, options = {}) {
      const host = typeof target === 'string' ? document.querySelector(target) : target;
      if (!(host instanceof Element)) throw new TypeError('trickIt.ui.table needs a target element.');
      const make = (tag, cls) => { const node = document.createElement(tag); if (cls) node.className = cls; return node; };
      const copy = () => tableCopy[document.documentElement.lang === 'id' ? 'id' : 'en'];
      const root = make('div', 'ti-grid');
      root.dataset.density = options.density === 'compact' ? 'compact' : 'comfortable';
      const toolbar = make('div', 'ti-grid-toolbar');
      const search = make('input', 'ti-grid-search');
      search.type = 'search'; search.autocomplete = 'off';
      const tools = make('div', 'ti-grid-tools');
      const sizeWrap = make('div', 'ti-grid-select');
      const size = make('select'); sizeWrap.append(size);
      const columnMenu = make('details', 'ti-grid-columns');
      const columnSummary = make('summary');
      const columnList = make('div', 'ti-grid-column-list');
      columnMenu.append(columnSummary, columnList);
      const densityWrap = make('div', 'ti-grid-density');
      const density = make('select');
      for (const value of ['comfortable', 'compact']) { const opt = make('option'); opt.value = value; density.append(opt); }
      density.value = root.dataset.density; densityWrap.append(density);
      tools.append(sizeWrap, columnMenu, densityWrap);
      toolbar.append(search, tools);
      const scroll = make('div', 'ti-grid-scroll');
      const element = make('table'); const caption = make('caption');
      caption.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap';
      element.append(caption);
      const head = make('thead'), body = make('tbody');
      element.append(head, body); scroll.append(element);
      const empty = make('div', 'ti-grid-empty'); empty.hidden = true;
      const footer = make('div', 'ti-grid-footer');
      const count = make('span');
      count.setAttribute('role', 'status');
      const pages = make('div', 'ti-grid-pages');
      const prev = make('button'); prev.type = 'button'; prev.textContent = '‹';
      const number = make('span');
      const next = make('button'); next.type = 'button'; next.textContent = '›';
      pages.append(prev, number, next); footer.append(count, pages);
      root.append(toolbar, scroll, empty, footer); host.append(root);
      let rows = Array.isArray(options.rows) ? options.rows.slice() : [];
      let columns = Array.isArray(options.columns) ? options.columns.slice() : [];
      const sizes = (Array.isArray(options.pageSizes) ? options.pageSizes : [10, 25, 50, 100]).filter(value => Number.isSafeInteger(value) && value > 0 && value <= 500);
      const pageSizes = [...new Set(sizes.length ? sizes : [10, 25, 50, 100])].sort((a,b) => a-b);
      let pageSize = pageSizes.includes(options.pageSize) ? options.pageSize : pageSizes[0];
      for (const value of pageSizes) { const opt = make('option'); opt.value = String(value); opt.textContent = String(value); size.append(opt); }
      size.value = String(pageSize);
      let query = '', page = 1, sortKey = '', direction = 'asc';
      let visible = new Set(columns.filter(col => col.visible !== false).map(col => col.key));
      if (!visible.size && columns.length) visible.add(columns[0].key);
      let removed = false;
      const display = value => value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      function localized() {
        const t = copy();
        search.placeholder = t.search; search.setAttribute('aria-label', t.search);
        size.setAttribute('aria-label', t.rows);
        density.setAttribute('aria-label', t.density);
        density.options[0].textContent = t.comfortable; density.options[1].textContent = t.compact;
        columnSummary.textContent = t.columns + ' (' + visible.size + ')';
        prev.setAttribute('aria-label', t.previous);
        next.setAttribute('aria-label', t.next);
        caption.textContent = typeof options.caption === 'string' ? options.caption : t.rows;
        render();
      }
      function normalizedColumns() {
        return columns.filter(col => col && typeof col.key === 'string' && col.key && visible.has(col.key));
      }
      function renderColumnToggles() {
        columnList.replaceChildren();
        for (const col of columns) {
          if (!col || typeof col.key !== 'string') continue;
          const label = make('label'), checkbox = make('input');
          checkbox.type = 'checkbox'; checkbox.checked = visible.has(col.key);
          checkbox.setAttribute('aria-label', String(col.label || col.key));
          checkbox.addEventListener('change', () => {
            if (!checkbox.checked && visible.size === 1) { checkbox.checked = true; return; }
            if (checkbox.checked) visible.add(col.key); else visible.delete(col.key);
            page = 1; render();
          });
          const name = make('span'); name.textContent = String(col.label || col.key);
          label.append(checkbox, name); columnList.append(label);
        }
      }
      function render() {
        if (removed) return;
        const t = copy(), shown = normalizedColumns();
        columnSummary.textContent = t.columns + ' (' + shown.length + ')';
        head.replaceChildren();
        const heading = make('tr');
        for (const col of shown) {
          const th = make('th'); th.scope = 'col';
          if (col.sortable === false) th.textContent = String(col.label || col.key);
          else {
            const button = make('button', 'ti-grid-sort'); button.type = 'button';
            const label = make('span'); label.textContent = String(col.label || col.key);
            const arrow = make('span', 'ti-grid-sort-indicator');
            arrow.textContent = sortKey === col.key ? (direction === 'asc' ? '▲' : '▼') : '↕';
            button.append(label, arrow);
            button.setAttribute('aria-label', (sortKey === col.key && direction === 'asc' ? t.sortDesc : t.sortAsc) + ': ' + (col.label || col.key));
            if (sortKey === col.key) th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
            button.addEventListener('click', () => { direction = sortKey === col.key && direction === 'asc' ? 'desc' : 'asc'; sortKey = col.key; page = 1; render(); });
            th.append(button);
          }
          heading.append(th);
        }
        head.append(heading);
        const find = query.trim().toLocaleLowerCase();
        const searched = find ? rows.filter(row => columns.some(col => col && col.searchable !== false && display(row?.[col.key]).toLocaleLowerCase().includes(find))) : rows.slice();
        if (sortKey) {
          const mult = direction === 'asc' ? 1 : -1;
          searched.sort((a,b) => {
            const av = a?.[sortKey], bv = b?.[sortKey];
            if (av == null || bv == null) return (av == null ? (bv == null ? 0 : -1) : 1) * mult;
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
            return display(av).localeCompare(display(bv), document.documentElement.lang || 'en', { numeric: true, sensitivity: 'base' }) * mult;
          });
        }
        const pageCount = Math.max(1, Math.ceil(searched.length / pageSize));
        page = Math.max(1, Math.min(page, pageCount));
        const first = (page - 1) * pageSize;
        body.replaceChildren();
        for (const row of searched.slice(first, first + pageSize)) {
          const tr = make('tr');
          for (const col of shown) {
            const td = make('td');
            const raw = row?.[col.key];
            const value = display(typeof col.format === 'function' ? col.format(raw, row) : raw);
            const span = make('span', 'ti-grid-cell');
            span.textContent = value; span.title = clip(value, 300);
            td.append(span);
            if (typeof options.onCopy === 'function' && col.copyable !== false) {
              const button = make('button', 'ti-grid-copy');
              button.type = 'button'; button.title = t.copy;
              button.setAttribute('aria-label', t.copy + ' ' + (col.label || col.key) + ': ' + clip(value, 80));
              button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
              button.addEventListener('click', () => options.onCopy(raw, col.key, row));
              td.append(button);
            }
            tr.append(td);
          }
          body.append(tr);
        }
        const emptyRows = searched.length === 0;
        empty.hidden = !emptyRows; scroll.hidden = emptyRows;
        empty.textContent = t.noResults;
        const start = emptyRows ? 0 : first + 1;
        count.textContent = t.showing + ' ' + start + '–' + Math.min(first + pageSize, searched.length) + ' ' + t.of + ' ' + searched.length;
        number.textContent = t.page + ' ' + page + ' ' + t.of + ' ' + pageCount;
        prev.disabled = page <= 1; next.disabled = page >= pageCount;
      }
      search.addEventListener('input', () => { query = search.value; page = 1; render(); });
      size.addEventListener('change', () => { pageSize = Number(size.value); page = 1; render(); });
      density.addEventListener('change', () => { root.dataset.density = density.value; });
      prev.addEventListener('click', () => { if (page > 1) { page--; render(); } });
      next.addEventListener('click', () => { page++; render(); });
      const controller = Object.freeze({
        element: root,
        get page() { return page; },
        update(next = {}) {
          if ('rows' in next) rows = Array.isArray(next.rows) ? next.rows.slice() : [];
          if ('columns' in next) {
            const previous = visible;
            columns = Array.isArray(next.columns) ? next.columns.slice() : [];
            visible = new Set(columns.filter(col => col && typeof col.key === 'string' && (previous.has(col.key) || (col.visible !== false && !previous.size))).map(col => col.key));
            if (!visible.size && columns.length) visible.add(columns[0].key);
            if (!columns.some(col => col.key === sortKey)) sortKey = '';
            renderColumnToggles();
          }
          if ('caption' in next) options.caption = next.caption;
          if ('onCopy' in next) options.onCopy = next.onCopy;
          page = 1; localized(); return controller;
        },
        setPage(next) { if (Number.isSafeInteger(next)) { page = next; render(); } return controller; },
        remove() { removed = true; removeEventListener('trick-it:localechange', localized); root.remove(); }
      });
      renderColumnToggles();
      addEventListener('trick-it:localechange', localized);
      localized();
      return controller;
    }
`;
