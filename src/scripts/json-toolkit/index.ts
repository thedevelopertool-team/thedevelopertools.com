// =============================================================
// index.ts — Entry point: wires all modules together
// =============================================================

import { initSearch } from './search.ts';
import { initTree } from './tree.ts';
import { initCompare } from './compare.ts';
import { initTools } from './tools.ts';
import { initUi } from './ui.ts';

// Modules are initialised in dependency order:
// 1. Search (sets up open/close helpers used by UI)
// 2. Tree   (expand/collapse buttons)
// 3. Compare (pane A/B inputs + diff nav)
// 4. Tools  (input, copy, download)
// 5. UI     (tabs, dropdowns, fullscreen, keyboard, session restore, hash routing)
initSearch();
initTree();
initCompare();
initTools();
initUi();
