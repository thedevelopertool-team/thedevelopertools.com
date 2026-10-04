// =============================================================
// ui.ts — Tab switching, dropdowns, fullscreen, keyboard shortcuts
// =============================================================

import {
  activeTab, setActiveTab,
  isValid, parsedData,
  searchQuery,
  dom,
} from './state.ts';
import { runTool, processInput } from './tools.ts';
import { initCompareWorkspace } from './compare.ts';
import { executeSearch } from './search.ts';

// ── Dropdown: fixed positioning ───────────────────────────────
function positionDropdown(btn: HTMLButtonElement, menu: HTMLElement): void {
  const rect = btn.getBoundingClientRect();
  menu.style.top  = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
}

export function closeAllDropdowns(): void {
  const { ddConvertMenu, ddConvertBtn, ddConvertWrap, ddTypesMenu, ddTypesBtn, ddTypesWrap } = dom;
  if (ddConvertMenu) ddConvertMenu.hidden = true;
  ddConvertBtn?.setAttribute('aria-expanded', 'false');
  ddConvertWrap?.classList.remove('open');
  if (ddTypesMenu) ddTypesMenu.hidden = true;
  ddTypesBtn?.setAttribute('aria-expanded', 'false');
  ddTypesWrap?.classList.remove('open');
}

// ── Hash routing ──────────────────────────────────────────────
const VALID_TABS = [
  'formatter','viewer','validator','minifier','compare',
  'csv','yaml','xml',
  'typescript','zod','schema','openapi','go','pydantic','java','kotlin'
];

export function getHashTab(): string {
  const h = window.location.hash.replace('#','');
  return VALID_TABS.includes(h) ? h : 'formatter';
}

function setHashTab(tab: string): void {
  history.replaceState(null, '', `#${tab}`);
}

// ── Tab switching ─────────────────────────────────────────────
const CONVERT_TABS = ['csv','yaml','xml'];
const TYPE_TABS    = ['typescript','zod','schema','openapi','go','pydantic','java','kotlin'];

const TAB_TITLES: Record<string, string> = {
  csv:'CSV', yaml:'YAML', xml:'XML',
  typescript:'TypeScript', zod:'Zod', schema:'JSON Schema',
  openapi:'OpenAPI 3.0', go:'Go Structs', pydantic:'Pydantic v2',
  java:'Java POJO', kotlin:'Kotlin'
};

export function switchTab(tabName: string): void {
  setActiveTab(tabName);
  setHashTab(tabName);
  closeAllDropdowns();

  const { stdWorkspace, cmpWorkspace, primaryTabs, panels,
          ddConvertBtn, ddConvertLbl, ddTypesBtn, ddTypesLbl, ddItems } = dom;

  if (tabName === 'compare') {
    if (stdWorkspace) stdWorkspace.hidden = true;
    if (cmpWorkspace) cmpWorkspace.hidden = false;
    initCompareWorkspace();
    return;
  }

  if (stdWorkspace) stdWorkspace.hidden = false;
  if (cmpWorkspace) cmpWorkspace.hidden = true;

  primaryTabs.forEach(t => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', String(isActive));
  });

  if (CONVERT_TABS.includes(tabName)) {
    ddConvertBtn?.classList.add('active');
    if (ddConvertLbl) ddConvertLbl.textContent = `Convert: ${TAB_TITLES[tabName] || tabName.toUpperCase()}`;
  } else {
    ddConvertBtn?.classList.remove('active');
    if (ddConvertLbl) ddConvertLbl.textContent = 'Convert';
  }

  if (TYPE_TABS.includes(tabName)) {
    ddTypesBtn?.classList.add('active');
    if (ddTypesLbl) ddTypesLbl.textContent = `Types: ${TAB_TITLES[tabName] || tabName}`;
  } else {
    ddTypesBtn?.classList.remove('active');
    if (ddTypesLbl) ddTypesLbl.textContent = 'Types & Code';
  }

  ddItems.forEach(item => item.classList.toggle('active', item.dataset.tab === tabName));
  panels.forEach(p => { p.hidden = !p.id.endsWith(tabName); });

  if (isValid && parsedData !== undefined) runTool(tabName);
  if (searchQuery.trim()) executeSearch(searchQuery);
}

// ── Fullscreen ─────────────────────────────────────────────────
function toggleFullscreen(): void {
  const root = dom.root;
  const isFull = root.classList.toggle('jt-fullscreen');
  document.body.style.overflow = isFull ? 'hidden' : '';
  document.querySelectorAll('.icon-expand').forEach(el => ((el as HTMLElement).style.display = isFull ? 'none' : 'block'));
  document.querySelectorAll('.icon-compress').forEach(el => ((el as HTMLElement).style.display = isFull ? 'block' : 'none'));
}

// ── Session persistence ────────────────────────────────────────
function loadFromSession(): void {
  try {
    const saved = sessionStorage.getItem('jt-json');
    const input = dom.input;
    if (saved && input) { input.value = saved; processInput(saved); }
    const savedB = sessionStorage.getItem('jt-json-b');
    const rawB   = dom.rawB;
    if (savedB && rawB) rawB.value = savedB;
  } catch (_) {}
}

// ── Wire up all UI events ──────────────────────────────────────
export function initUi(): void {
  const { ddConvertBtn, ddConvertMenu, ddConvertWrap,
          ddTypesBtn, ddTypesMenu, ddTypesWrap,
          primaryTabs, ddItems, searchBar, searchInput } = dom;

  // Dropdowns
  ddConvertBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    const isClosed = ddConvertMenu?.hidden;
    closeAllDropdowns();
    if (isClosed && ddConvertMenu) {
      ddConvertMenu.hidden = false;
      positionDropdown(ddConvertBtn, ddConvertMenu);
      ddConvertBtn.setAttribute('aria-expanded', 'true');
      ddConvertWrap?.classList.add('open');
    }
  });

  ddTypesBtn?.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    const isClosed = ddTypesMenu?.hidden;
    closeAllDropdowns();
    if (isClosed && ddTypesMenu) {
      ddTypesMenu.hidden = false;
      positionDropdown(ddTypesBtn, ddTypesMenu);
      ddTypesBtn.setAttribute('aria-expanded', 'true');
      ddTypesWrap?.classList.add('open');
    }
  });

  // Close dropdowns on outside click, except when clicking inside search
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as Node;
    if (searchInput && searchInput.contains(target)) return;
    closeAllDropdowns();
  });

  // Tabs
  primaryTabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab!)));
  ddItems.forEach(item => item.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation();
    switchTab(item.dataset.tab!);
  }));
  document.getElementById('btn-exit-compare')?.addEventListener('click', () => switchTab('formatter'));

  // Fullscreen
  document.getElementById('btn-fullscreen-main')?.addEventListener('click', toggleFullscreen);
  document.getElementById('btn-fullscreen-compare')?.addEventListener('click', toggleFullscreen);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!(searchBar as HTMLElement)?.hidden) {
        (window as any).__jtCloseSearch?.();
        return;
      }
      closeAllDropdowns();
      if (dom.root.classList.contains('jt-fullscreen')) toggleFullscreen();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      if (activeTab !== 'compare') {
        e.preventDefault();
        (window as any).__jtOpenSearch?.();
      }
    }
  });

  // Hash routing
  const startTab = getHashTab();
  switchTab(startTab);
  loadFromSession();

  window.addEventListener('hashchange', () => {
    const tab = getHashTab();
    if (tab !== activeTab) switchTab(tab);
  });
}
