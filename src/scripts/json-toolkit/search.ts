// =============================================================
// search.ts — Live JSON search engine
//
// BUG FIX: updateSearchMatchFocus() previously called
// txtArea.focus() + setSelectionRange() on every keystroke,
// stealing focus away from the search input. This is now fixed:
// focus/selection is ONLY changed when the user explicitly
// navigates (Next / Prev buttons or Enter key).
// =============================================================

import {
  activeTab,
  searchQuery, setSearchQuery,
  searchMatches, setSearchMatches,
  currentMatchIdx, setCurrentMatchIdx,
  dom,
} from './state.ts';

// ── Helpers ───────────────────────────────────────────────────
export function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Clear all <mark> highlights ───────────────────────────────
export function clearSearchHighlights(): void {
  document.querySelectorAll('mark.jt-search-match').forEach(el => {
    const parent = el.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
      parent.normalize();
    }
  });
}

// ── Highlight matching text inside a single DOM node ──────────
function highlightTextInNode(element: HTMLElement, term: string): void {
  const text = element.textContent || '';
  const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
  const parts = text.split(regex);
  element.innerHTML = '';
  parts.forEach(part => {
    if (part.toLowerCase() === term) {
      const mark = document.createElement('mark');
      mark.className = 'jt-search-match';
      mark.textContent = part;
      element.appendChild(mark);
    } else if (part) {
      element.appendChild(document.createTextNode(part));
    }
  });
}

// ── Tree-view search ──────────────────────────────────────────
function searchInTreeView(term: string): void {
  const treeCont = document.getElementById('out-viewer');
  if (!treeCont) return;

  const elements = treeCont.querySelectorAll<HTMLElement>('[data-search-key], [data-search-val]');
  elements.forEach(el => {
    const rawText = el.textContent || '';
    if (rawText.toLowerCase().includes(term)) {
      // Expand all ancestor collapsed nodes
      let parent = el.parentElement;
      while (parent && parent !== treeCont) {
        if (parent.classList.contains('jt-tree-children')) {
          parent.classList.remove('collapsed');
          const parentNode = parent.parentElement;
          if (parentNode) {
            const toggle = parentNode.querySelector(':scope > .jt-tree-row > .jt-tree-toggle');
            if (toggle) toggle.classList.add('open');
            const badge = parentNode.querySelector(':scope > .jt-tree-row [data-role="badge"]') as HTMLElement | null;
            const inlineClose = parentNode.querySelector(':scope > .jt-tree-row [data-role="inline-close"]') as HTMLElement | null;
            if (badge) badge.style.display = 'none';
            if (inlineClose) inlineClose.style.display = 'none';
          }
        }
        parent = parent.parentElement;
      }
      highlightTextInNode(el, term);
    }
  });

  setSearchMatches(Array.from(treeCont.querySelectorAll<HTMLElement>('mark.jt-search-match')));
}

// ── Code-view search (builds index into textarea value) ───────
function searchInCodeView(term: string): void {
  const activePanel = document.querySelector('.jt-panel:not([hidden])');
  const txtArea = activePanel?.querySelector<HTMLTextAreaElement>('textarea');
  if (!txtArea) return;

  const val = txtArea.value;
  const lower = val.toLowerCase();
  let idx = lower.indexOf(term);
  const indices: number[] = [];
  while (idx !== -1) {
    indices.push(idx);
    idx = lower.indexOf(term, idx + term.length);
  }

  // Store positions as dataset on lightweight placeholder divs
  setSearchMatches(indices.map(pos => {
    const dummy = document.createElement('div');
    dummy.dataset.pos = String(pos);
    dummy.dataset.len = String(term.length);
    return dummy;
  }));
}

// ── Update counter + scroll/select the active match ──────────
// @param navigate — true when called from Next/Prev (may move textarea focus)
//                  false when called from live typing (NEVER moves focus)
export function updateSearchMatchFocus(navigate = false): void {
  const total = searchMatches.length;
  const counter = dom.searchCounter;

  if (total === 0) {
    if (counter) counter.textContent = '0 matches';
    return;
  }

  if (counter) counter.textContent = `${currentMatchIdx + 1} of ${total}`;

  if (activeTab === 'viewer') {
    searchMatches.forEach((m, idx) => m.classList.toggle('active', idx === currentMatchIdx));
    const activeMatch = searchMatches[currentMatchIdx];
    if (activeMatch) activeMatch.scrollIntoView({ block: 'center', behavior: 'smooth' });
  } else if (navigate) {
    // Only change textarea focus when user explicitly navigates — NEVER during live typing
    const activePanel = document.querySelector('.jt-panel:not([hidden])');
    const txtArea = activePanel?.querySelector<HTMLTextAreaElement>('textarea');
    const match = searchMatches[currentMatchIdx];
    if (txtArea && match) {
      const pos = Number(match.dataset.pos);
      const len = Number(match.dataset.len);
      txtArea.focus();
      txtArea.setSelectionRange(pos, pos + len);
      // Immediately return focus to search input after selection (UX: user keeps typing)
      requestAnimationFrame(() => dom.searchInput?.focus());
    }
  }
}

// ── Main search entry point ───────────────────────────────────
export function executeSearch(query: string): void {
  setSearchQuery(query);
  clearSearchHighlights();
  setSearchMatches([]);
  setCurrentMatchIdx(-1);

  const trimmed = query.trim().toLowerCase();
  const clearBtn = dom.searchClear;
  if (clearBtn) clearBtn.hidden = !query;

  const counter  = dom.searchCounter;
  const navBtns  = dom.searchNavBtns;

  if (!trimmed) {
    if (counter)  counter.hidden  = true;
    if (navBtns)  navBtns.hidden  = true;
    return;
  }

  if (activeTab === 'viewer') {
    searchInTreeView(trimmed);
  } else {
    searchInCodeView(trimmed);
  }

  const total = searchMatches.length;
  if (counter) counter.hidden = false;
  if (navBtns) navBtns.hidden = total === 0;

  if (total > 0) {
    setCurrentMatchIdx(0);
    // navigate=false: don't steal focus from search input during live typing
    updateSearchMatchFocus(false);
  } else {
    if (counter) counter.textContent = '0 matches';
  }
}

// ── Wire up search event listeners ───────────────────────────
export function initSearch(): void {
  const { searchInput, searchClear, btnSearchPrev, btnSearchNext,
          searchToggleBtn, searchBar, searchCloseBtn } = dom;

  // Live typing — fix: pass navigate=false so focus is never stolen
  searchInput?.addEventListener('input', () => {
    executeSearch(searchInput.value);
  });

  // Clear button
  searchClear?.addEventListener('click', () => {
    searchInput.value = '';
    executeSearch('');
    searchInput.focus();
  });

  // Navigate: Next
  btnSearchNext?.addEventListener('click', () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIdx((currentMatchIdx + 1) % searchMatches.length);
    updateSearchMatchFocus(true); // navigate=true → may move selection
  });

  // Navigate: Prev
  btnSearchPrev?.addEventListener('click', () => {
    if (searchMatches.length === 0) return;
    setCurrentMatchIdx((currentMatchIdx - 1 + searchMatches.length) % searchMatches.length);
    updateSearchMatchFocus(true);
  });

  // Enter / Shift+Enter in search input
  searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) btnSearchPrev?.click();
      else btnSearchNext?.click();
    }
  });

  // Search toggle open/close
  function openSearch(): void {
    if (!searchBar) return;
    searchBar.hidden = false;
    searchBar.removeAttribute('aria-hidden');
    searchToggleBtn?.classList.add('active');
    searchToggleBtn?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      searchInput?.focus();
      if (searchInput?.value) searchInput.select();
    });
  }

  function closeSearch(): void {
    if (!searchBar) return;
    searchBar.hidden = true;
    searchBar.setAttribute('aria-hidden', 'true');
    searchToggleBtn?.classList.remove('active');
    searchToggleBtn?.setAttribute('aria-expanded', 'false');
    if (searchQuery) {
      searchInput.value = '';
      executeSearch('');
    }
  }

  // Expose open/close for ui.ts keyboard shortcuts
  (window as any).__jtOpenSearch  = openSearch;
  (window as any).__jtCloseSearch = closeSearch;
  (window as any).__jtSearchBarEl = searchBar;

  searchToggleBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    if (searchBar?.hidden) openSearch(); else closeSearch();
  });

  searchCloseBtn?.addEventListener('click', () => closeSearch());

  // Stop click inside search bar from propagating to the document click handler
  searchBar?.addEventListener('click', (e: MouseEvent) => e.stopPropagation());
}
