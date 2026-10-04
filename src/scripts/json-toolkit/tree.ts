// =============================================================
// tree.ts — Hierarchical JSON Tree Viewer
// =============================================================

import { parsedData, dom } from './state.ts';
import { escHtml } from './search.ts';

// ── Render a primitive value with syntax colouring ────────────
export function renderPrimitive(v: unknown): string {
  if (v === null)           return `<span class="jt-val-null" data-search-val="null">null</span>`;
  if (typeof v === 'string') return `<span class="jt-val-string" data-search-val="${escHtml(v)}">"${escHtml(v)}"</span>`;
  if (typeof v === 'number') return `<span class="jt-val-number" data-search-val="${v}">${v}</span>`;
  if (typeof v === 'boolean')return `<span class="jt-val-boolean" data-search-val="${v}">${v}</span>`;
  return `<span data-search-val="${escHtml(String(v))}">${escHtml(String(v))}</span>`;
}

// ── Recursively build a tree node element ─────────────────────
export function buildTreeNode(value: unknown, key: string | number | null, depth: number): HTMLElement {
  const nodeEl = document.createElement('div');
  nodeEl.className = 'jt-tree-node';

  if (typeof value === 'object' && value !== null) {
    const isArr = Array.isArray(value);
    const entries = isArr
      ? (value as unknown[]).map((v, i) => [i, v] as [number, unknown])
      : Object.entries(value as Record<string, unknown>);

    const countText = `${entries.length} ${entries.length === 1 ? (isArr ? 'item' : 'key') : (isArr ? 'items' : 'keys')}`;
    const isCollapsed = depth > 0;

    const row = document.createElement('div');
    row.className = 'jt-tree-row clickable';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    const toggle = document.createElement('span');
    toggle.className = 'jt-tree-toggle' + (!isCollapsed ? ' open' : '');
    toggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`;

    const label = document.createElement('span');
    let keyHtml = '';
    if (key !== null) {
      if (typeof key === 'number') {
        keyHtml = `<span class="jt-tree-index">${key}</span><span class="jt-tree-colon">:</span> `;
      } else {
        keyHtml = `<span class="jt-tree-key" data-search-key="${escHtml(String(key))}">${escHtml(String(key))}</span><span class="jt-tree-colon">:</span> `;
      }
    }
    const openBracket  = isArr ? '[' : '{';
    const closeBracket = isArr ? ']' : '}';
    const previewBadge = `<span class="jt-tree-badge" data-role="badge" style="display:${isCollapsed ? 'inline-flex' : 'none'}">${countText}</span>`;
    const inlineClose  = `<span class="jt-tree-bracket" data-role="inline-close" style="display:${isCollapsed ? 'inline' : 'none'}">${closeBracket}</span>`;
    label.innerHTML = `${keyHtml}<span class="jt-tree-bracket">${openBracket}</span>${previewBadge}${inlineClose}`;

    row.appendChild(toggle);
    row.appendChild(label);
    nodeEl.appendChild(row);

    const childrenCont = document.createElement('div');
    childrenCont.className = 'jt-tree-children' + (isCollapsed ? ' collapsed' : '');

    entries.forEach(([k, v]) => childrenCont.appendChild(buildTreeNode(v, k, depth + 1)));

    const closeRow = document.createElement('div');
    closeRow.className = 'jt-tree-close-row';
    closeRow.innerHTML = `<span class="jt-tree-bracket">${closeBracket}</span>`;
    childrenCont.appendChild(closeRow);
    nodeEl.appendChild(childrenCont);

    function toggleNode(): void {
      const nowCollapsed = childrenCont.classList.toggle('collapsed');
      toggle.classList.toggle('open', !nowCollapsed);
      const badgeEl      = label.querySelector('[data-role="badge"]')       as HTMLElement | null;
      const inlineCloseEl = label.querySelector('[data-role="inline-close"]') as HTMLElement | null;
      if (badgeEl)      badgeEl.style.display      = nowCollapsed ? 'inline-flex' : 'none';
      if (inlineCloseEl) inlineCloseEl.style.display = nowCollapsed ? 'inline'     : 'none';
    }

    row.addEventListener('click', (e: MouseEvent) => { e.stopPropagation(); toggleNode(); });
    row.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNode(); }
    });

  } else {
    const row = document.createElement('div');
    row.className = 'jt-tree-row';

    const spacer = document.createElement('span');
    spacer.className = 'jt-tree-spacer';

    const content = document.createElement('span');
    let keyHtml = '';
    if (key !== null) {
      if (typeof key === 'number') {
        keyHtml = `<span class="jt-tree-index">${key}</span><span class="jt-tree-colon">:</span> `;
      } else {
        keyHtml = `<span class="jt-tree-key" data-search-key="${escHtml(String(key))}">${escHtml(String(key))}</span><span class="jt-tree-colon">:</span> `;
      }
    }
    content.innerHTML = `${keyHtml}${renderPrimitive(value)}`;
    row.appendChild(spacer);
    row.appendChild(content);
    nodeEl.appendChild(row);
  }

  return nodeEl;
}

// ── Run the tree viewer ───────────────────────────────────────
export function runViewer(): void {
  const container = document.getElementById('out-viewer');
  if (!container || parsedData === null) return;
  container.innerHTML = '';
  const tree = buildTreeNode(parsedData, null, 0);
  tree.classList.add('jt-tree-root');
  container.appendChild(tree);
}

// ── Wire up Expand All / Collapse All buttons ─────────────────
export function initTree(): void {
  document.getElementById('btn-expand-all')?.addEventListener('click', () => {
    document.querySelectorAll('.jt-tree-children').forEach(el => el.classList.remove('collapsed'));
    document.querySelectorAll('.jt-tree-toggle').forEach(el => el.classList.add('open'));
    document.querySelectorAll('[data-role="badge"]').forEach(el => ((el as HTMLElement).style.display = 'none'));
    document.querySelectorAll('[data-role="inline-close"]').forEach(el => ((el as HTMLElement).style.display = 'none'));
  });

  document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
    document.querySelectorAll('.jt-tree-children').forEach((el, idx) => {
      if (idx === 0) el.classList.remove('collapsed');
      else           el.classList.add('collapsed');
    });
    document.querySelectorAll('.jt-tree-toggle').forEach((el, idx) => {
      if (idx === 0) el.classList.add('open');
      else           el.classList.remove('open');
    });
    document.querySelectorAll('[data-role="badge"]').forEach((el, idx) => {
      (el as HTMLElement).style.display = idx === 0 ? 'none' : 'inline-flex';
    });
    document.querySelectorAll('[data-role="inline-close"]').forEach((el, idx) => {
      (el as HTMLElement).style.display = idx === 0 ? 'none' : 'inline';
    });
  });
}
