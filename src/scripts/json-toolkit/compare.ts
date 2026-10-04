// =============================================================
// compare.ts — Dual-pane compare with LCS diff engine
//
// DESIGN CHANGE: Edit button removed entirely.
// Both panes are always directly editable (textarea is always
// visible). The diff view sits below the textarea in each pane
// and updates live on every keystroke. No mode-toggle state needed.
// =============================================================

import {
  currentJson, setCurrentJson,
  diffItems, setDiffItems,
  currentDiffIdx, setCurrentDiffIdx,
  dom,
} from './state.ts';
import { escHtml } from './search.ts';
import { processInput } from './tools.ts';

// Sample JSON to pre-populate pane B on first load
const SAMPLE_DIFF_B = {
  "toolkit": "The Developer Tools (Pro Edition)",
  "version": "1.1.0",
  "private": true,
  "users": [
    {
      "id": 1,
      "name": "Alice Chen",
      "email": "alice.chen@enterprise.com",
      "role": "superadmin",
      "active": true,
      "address": { "city": "San Francisco", "country": "US", "zip": "94102", "state": "CA" },
      "tags": ["developer", "architect"],
      "metadata": null
    },
    {
      "id": 3,
      "name": "Charlie Davis",
      "email": "charlie@example.com",
      "role": "analyst",
      "active": true,
      "address": { "city": "Austin", "country": "US", "zip": "78701" },
      "tags": ["data"],
      "metadata": null
    }
  ],
  "pagination": { "total": 2, "page": 1, "perPage": 20 },
  "features": ["diff", "openapi", "codegen"]
};

// ── LCS Diff Engine ───────────────────────────────────────────
type DiffItem = { type: 'equal' | 'add' | 'delete' | 'modify'; valA?: string; valB?: string };

function computeLcsDiff(a: string[], b: string[]): DiffItem[] {
  const n = a.length;
  const m = b.length;
  const matrix: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (a[i].trim() === b[j].trim()) {
        matrix[i + 1][j + 1] = matrix[i][j] + 1;
      } else {
        matrix[i + 1][j + 1] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  const result: DiffItem[] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1].trim() === b[j - 1].trim()) {
      result.unshift({ type: 'equal', valA: a[i - 1], valB: b[j - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] >= matrix[i - 1][j])) {
      result.unshift({ type: 'add', valB: b[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || matrix[i][j - 1] < matrix[i - 1][j])) {
      result.unshift({ type: 'delete', valA: a[i - 1] });
      i--;
    }
  }
  return result;
}

// ── Highlight the currently active diff pair ──────────────────
function highlightActiveDiffItem(): void {
  document.querySelectorAll('.jt-diff-row.diff-active-focus').forEach(el => el.classList.remove('diff-active-focus'));
  if (currentDiffIdx >= 0 && currentDiffIdx < diffItems.length) {
    const match = diffItems[currentDiffIdx];
    if (match.lineA) match.lineA.classList.add('diff-active-focus');
    if (match.lineB) match.lineB.classList.add('diff-active-focus');
    if (match.lineA) match.lineA.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (match.lineB) match.lineB.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const counter = dom.diffCounter;
    if (counter) counter.textContent = `Diff ${currentDiffIdx + 1} of ${diffItems.length}`;
  }
}

// ── Render diff into the two diff-view divs ───────────────────
export function renderCompareDiff(): void {
  const { rawA, rawB, diffViewA, diffViewB, statDiffAdd, statDiffRem, statDiffMod, diffCounter } = dom;
  if (!rawA || !rawB || !diffViewA || !diffViewB) return;

  const textA = rawA.value;
  const textB = rawB.value;

  // Save B to session
  try { sessionStorage.setItem('jt-json-b', textB); } catch (_) {}

  let linesA: string[] = [];
  let linesB: string[] = [];
  try { linesA = JSON.stringify(JSON.parse(textA || '{}'), null, 2).split('\n'); }
  catch (_) { linesA = textA ? textA.split('\n') : []; }
  try { linesB = JSON.stringify(JSON.parse(textB || '{}'), null, 2).split('\n'); }
  catch (_) { linesB = textB ? textB.split('\n') : []; }

  const diff = computeLcsDiff(linesA, linesB);

  setDiffItems([]);
  setCurrentDiffIdx(-1);
  diffViewA.innerHTML = '';
  diffViewB.innerHTML = '';

  let addedCount = 0, removedCount = 0, modifiedCount = 0;
  let lineNumA = 1, lineNumB = 1;
  const newDiffItems: typeof diffItems = [];

  diff.forEach(item => {
    const rowA = document.createElement('div');
    rowA.className = 'jt-diff-row';
    const rowB = document.createElement('div');
    rowB.className = 'jt-diff-row';

    if (item.type === 'equal') {
      rowA.innerHTML = `<span class="jt-diff-line-num">${lineNumA++}</span><span class="jt-diff-symbol"> </span><span class="jt-diff-code">${escHtml(item.valA || '')}</span>`;
      rowB.innerHTML = `<span class="jt-diff-line-num">${lineNumB++}</span><span class="jt-diff-symbol"> </span><span class="jt-diff-code">${escHtml(item.valB || '')}</span>`;
    } else if (item.type === 'delete') {
      rowA.classList.add('diff-del');
      rowA.innerHTML = `<span class="jt-diff-line-num">${lineNumA++}</span><span class="jt-diff-symbol">-</span><span class="jt-diff-code">${escHtml(item.valA || '')}</span>`;
      rowB.classList.add('diff-empty');
      rowB.innerHTML = `<span class="jt-diff-line-num"> </span><span class="jt-diff-symbol"> </span><span class="jt-diff-code"> </span>`;
      removedCount++;
      newDiffItems.push({ lineA: rowA, lineB: rowB });
    } else if (item.type === 'add') {
      rowA.classList.add('diff-empty');
      rowA.innerHTML = `<span class="jt-diff-line-num"> </span><span class="jt-diff-symbol"> </span><span class="jt-diff-code"> </span>`;
      rowB.classList.add('diff-add');
      rowB.innerHTML = `<span class="jt-diff-line-num">${lineNumB++}</span><span class="jt-diff-symbol">+</span><span class="jt-diff-code">${escHtml(item.valB || '')}</span>`;
      addedCount++;
      newDiffItems.push({ lineA: rowA, lineB: rowB });
    } else if (item.type === 'modify') {
      rowA.classList.add('diff-del');
      rowA.innerHTML = `<span class="jt-diff-line-num">${lineNumA++}</span><span class="jt-diff-symbol">~</span><span class="jt-diff-code">${escHtml(item.valA || '')}</span>`;
      rowB.classList.add('diff-add');
      rowB.innerHTML = `<span class="jt-diff-line-num">${lineNumB++}</span><span class="jt-diff-symbol">~</span><span class="jt-diff-code">${escHtml(item.valB || '')}</span>`;
      modifiedCount++;
      newDiffItems.push({ lineA: rowA, lineB: rowB });
    }

    diffViewA.appendChild(rowA);
    diffViewB.appendChild(rowB);
  });

  setDiffItems(newDiffItems);

  if (statDiffAdd) statDiffAdd.textContent = `+${addedCount} added`;
  if (statDiffRem) statDiffRem.textContent = `-${removedCount} removed`;
  if (statDiffMod) statDiffMod.textContent = `~${modifiedCount} changed`;

  const total = newDiffItems.length;
  if (total > 0) {
    setCurrentDiffIdx(0);
    highlightActiveDiffItem();
  } else {
    if (diffCounter) diffCounter.textContent = '0 differences';
  }
}

// ── Initialise the compare workspace ─────────────────────────
export function initCompareWorkspace(): void {
  const { rawA, rawB } = dom;
  if (rawA) rawA.value = currentJson;
  if (rawB && !rawB.value.trim()) {
    rawB.value = JSON.stringify(SAMPLE_DIFF_B, null, 2);
  }
  renderCompareDiff();
}

// ── Wire up compare event listeners ──────────────────────────
export function initCompare(): void {
  const { rawA, rawB, btnDiffNext, btnDiffPrev, fileInputA, fileInputB } = dom;

  btnDiffNext?.addEventListener('click', () => {
    if (diffItems.length === 0) return;
    setCurrentDiffIdx((currentDiffIdx + 1) % diffItems.length);
    highlightActiveDiffItem();
  });

  btnDiffPrev?.addEventListener('click', () => {
    if (diffItems.length === 0) return;
    setCurrentDiffIdx((currentDiffIdx - 1 + diffItems.length) % diffItems.length);
    highlightActiveDiffItem();
  });

  // Pane A textarea — always editable, no Edit button needed
  rawA?.addEventListener('input', () => {
    setCurrentJson(rawA.value);
    const mainInput = dom.input;
    if (mainInput) mainInput.value = rawA.value;
    processInput(rawA.value);
    renderCompareDiff();
  });

  // Pane B textarea — always editable, no Edit button needed
  rawB?.addEventListener('input', () => renderCompareDiff());

  // Import A
  document.getElementById('btn-import-a')?.addEventListener('click', () => fileInputA?.click());
  fileInputA?.addEventListener('change', () => {
    const file = fileInputA.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const text = e.target?.result as string;
      if (rawA) { rawA.value = text; setCurrentJson(text); }
      const mainInput = dom.input;
      if (mainInput) mainInput.value = text;
      processInput(text);
      renderCompareDiff();
    };
    reader.readAsText(file);
    fileInputA.value = '';
  });

  // Import B
  document.getElementById('btn-import-b')?.addEventListener('click', () => fileInputB?.click());
  fileInputB?.addEventListener('change', () => {
    const file = fileInputB.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const text = e.target?.result as string;
      if (rawB) rawB.value = text;
      renderCompareDiff();
    };
    reader.readAsText(file);
    fileInputB.value = '';
  });

  // Format A
  document.getElementById('btn-format-a')?.addEventListener('click', () => {
    if (!rawA) return;
    try {
      rawA.value = JSON.stringify(JSON.parse(rawA.value), null, 2);
      setCurrentJson(rawA.value);
      processInput(rawA.value);
      renderCompareDiff();
    } catch (_) {}
  });

  // Format B
  document.getElementById('btn-format-b')?.addEventListener('click', () => {
    if (!rawB) return;
    try {
      rawB.value = JSON.stringify(JSON.parse(rawB.value), null, 2);
      renderCompareDiff();
    } catch (_) {}
  });

  // Clear A
  document.getElementById('btn-clear-a')?.addEventListener('click', () => {
    if (rawA) rawA.value = '';
    const mainInput = dom.input;
    if (mainInput) mainInput.value = '';
    processInput('');
    renderCompareDiff();
  });

  // Clear B
  document.getElementById('btn-clear-b')?.addEventListener('click', () => {
    if (rawB) rawB.value = '';
    renderCompareDiff();
  });

  // Sample B button
  document.getElementById('btn-compare-sample-b')?.addEventListener('click', () => {
    if (rawB) rawB.value = JSON.stringify(SAMPLE_DIFF_B, null, 2);
    renderCompareDiff();
  });
}
