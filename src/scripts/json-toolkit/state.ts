// =============================================================
// state.ts — Shared mutable state + DOM element references
// Single source of truth for all modules.
// =============================================================

// ── Workspace State ───────────────────────────────────────────
export let currentJson: string = '';
export let parsedData: unknown = null;
export let isValid: boolean = false;
export let activeTab: string = 'formatter';
export let indentSize: number | string = 2;

// ── Search State ──────────────────────────────────────────────
export let searchQuery: string = '';
export let searchMatches: HTMLElement[] = [];
export let currentMatchIdx: number = -1;

// ── Compare Diff State ────────────────────────────────────────
export let diffItems: { lineA?: HTMLElement; lineB?: HTMLElement }[] = [];
export let currentDiffIdx: number = -1;

// ── State Setters (so modules can mutate shared state) ────────
export function setCurrentJson(v: string)       { currentJson = v; }
export function setParsedData(v: unknown)        { parsedData = v; }
export function setIsValid(v: boolean)           { isValid = v; }
export function setActiveTab(v: string)          { activeTab = v; }
export function setIndentSize(v: number | string){ indentSize = v; }
export function setSearchQuery(v: string)        { searchQuery = v; }
export function setSearchMatches(v: HTMLElement[]){ searchMatches = v; }
export function setCurrentMatchIdx(v: number)    { currentMatchIdx = v; }
export function setDiffItems(v: { lineA?: HTMLElement; lineB?: HTMLElement }[]) { diffItems = v; }
export function setCurrentDiffIdx(v: number)     { currentDiffIdx = v; }

// ── DOM References ────────────────────────────────────────────
// Lazily accessed so this module can be imported before DOMContentLoaded.
// All getters cast to the expected type; callers guard for null where needed.

export const dom = {
  get root()           { return document.getElementById('json-toolkit')            as HTMLElement; },
  get stdWorkspace()   { return document.getElementById('jt-standard-workspace')   as HTMLElement; },
  get cmpWorkspace()   { return document.getElementById('jt-compare-workspace')    as HTMLElement; },

  // Input col
  get input()          { return document.getElementById('jt-input')                as HTMLTextAreaElement; },
  get fileInput()      { return document.getElementById('jt-file-input')           as HTMLInputElement; },
  get dropZone()       { return document.getElementById('jt-drop-zone')            as HTMLDivElement; },
  get statusIdle()     { return document.getElementById('jt-status-idle')          as HTMLElement; },
  get statusValid()    { return document.getElementById('jt-status-valid')         as HTMLElement; },
  get statusError()    { return document.getElementById('jt-status-error')         as HTMLElement; },
  get validDetail()    { return document.getElementById('jt-valid-detail')         as HTMLElement; },
  get errorSummary()   { return document.getElementById('jt-error-summary')        as HTMLElement; },

  // Tabs
  get primaryTabs()    { return document.querySelectorAll<HTMLButtonElement>('.jt-tab:not(.jt-dropdown-trigger)'); },
  get panels()         { return document.querySelectorAll<HTMLElement>('.jt-panel'); },
  get indentBtns()     { return document.querySelectorAll<HTMLButtonElement>('.jt-indent-btn'); },

  // Dropdowns
  get ddConvertBtn()   { return document.getElementById('btn-dd-convert')          as HTMLButtonElement; },
  get ddConvertMenu()  { return document.getElementById('menu-convert')            as HTMLElement; },
  get ddConvertWrap()  { return document.getElementById('dd-convert')              as HTMLElement; },
  get ddConvertLbl()   { return document.getElementById('label-dd-convert')        as HTMLElement; },
  get ddTypesBtn()     { return document.getElementById('btn-dd-types')            as HTMLButtonElement; },
  get ddTypesMenu()    { return document.getElementById('menu-types')              as HTMLElement; },
  get ddTypesWrap()    { return document.getElementById('dd-types')                as HTMLElement; },
  get ddTypesLbl()     { return document.getElementById('label-dd-types')          as HTMLElement; },
  get ddItems()        { return document.querySelectorAll<HTMLButtonElement>('.jt-dropdown-item'); },

  // Search bar
  get searchToggleBtn(){ return document.getElementById('btn-search-toggle')       as HTMLButtonElement; },
  get searchBar()      { return document.getElementById('jt-search-bar')           as HTMLElement; },
  get searchInput()    { return document.getElementById('jt-search-input')         as HTMLInputElement; },
  get searchClear()    { return document.getElementById('btn-search-clear')        as HTMLButtonElement; },
  get searchCounter()  { return document.getElementById('jt-search-count')         as HTMLElement; },
  get searchNavBtns()  { return document.getElementById('jt-search-nav-btns')      as HTMLElement; },
  get btnSearchPrev()  { return document.getElementById('btn-search-prev')         as HTMLButtonElement; },
  get btnSearchNext()  { return document.getElementById('btn-search-next')         as HTMLButtonElement; },
  get searchCloseBtn() { return document.getElementById('btn-search-close')        as HTMLButtonElement; },

  // Compare pane
  get rawA()           { return document.getElementById('jt-raw-a')               as HTMLTextAreaElement; },
  get rawB()           { return document.getElementById('jt-raw-b')               as HTMLTextAreaElement; },
  get diffViewA()      { return document.getElementById('jt-diff-view-a')         as HTMLElement; },
  get diffViewB()      { return document.getElementById('jt-diff-view-b')         as HTMLElement; },
  get statDiffAdd()    { return document.getElementById('stat-diff-added')         as HTMLElement; },
  get statDiffRem()    { return document.getElementById('stat-diff-removed')       as HTMLElement; },
  get statDiffMod()    { return document.getElementById('stat-diff-modified')      as HTMLElement; },
  get diffCounter()    { return document.getElementById('jt-diff-counter')         as HTMLElement; },
  get btnDiffPrev()    { return document.getElementById('btn-diff-prev')           as HTMLButtonElement; },
  get btnDiffNext()    { return document.getElementById('btn-diff-next')           as HTMLButtonElement; },
  get fileInputA()     { return document.getElementById('jt-file-a')              as HTMLInputElement; },
  get fileInputB()     { return document.getElementById('jt-file-b')              as HTMLInputElement; },
};
