// =============================================================
// tools.ts — All JSON processing tools
// Format, Validate, Minify, Convert, and all Code Generators
// =============================================================

import {
  currentJson, setCurrentJson,
  parsedData, setParsedData,
  isValid, setIsValid,
  activeTab,
  indentSize, setIndentSize,
  searchQuery,
  dom,
} from './state.ts';
import { escHtml } from './search.ts';
import { runViewer } from './tree.ts';
import { executeSearch } from './search.ts';

// ── Helpers ───────────────────────────────────────────────────
function toPascalCase(s: string): string {
  return s.replace(/(^|[-_\s])([a-z0-9])/gi, (_, __, c) => c.toUpperCase());
}
function toCamelCase(s: string): string {
  const p = toPascalCase(s);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

// ── Status display ────────────────────────────────────────────
export function describeJson(d: unknown): string {
  if (Array.isArray(d)) return `array [${d.length}]`;
  if (d === null) return 'null';
  if (typeof d === 'object') return `object {${Object.keys(d as object).length} keys}`;
  return typeof d;
}

function extractShortError(msg: string): string {
  const m = msg.match(/at position (\d+)/);
  if (m) return `position ${m[1]}`;
  const lc = msg.match(/line (\d+) column (\d+)/i);
  if (lc) return `line ${lc[1]}, col ${lc[2]}`;
  return msg.slice(0, 50);
}

export function showStatus(kind: 'idle' | 'valid' | 'error', data?: unknown): void {
  const { statusIdle, statusValid, statusError, validDetail, errorSummary } = dom;
  if (statusIdle)  statusIdle.hidden  = kind !== 'idle';
  if (statusValid) statusValid.hidden = kind !== 'valid';
  if (statusError) statusError.hidden = kind !== 'error';
  if (kind === 'valid' && data !== undefined && validDetail) {
    validDetail.textContent = `Valid JSON · ${describeJson(data)}`;
  }
  if (kind === 'error' && typeof data === 'string' && errorSummary) {
    errorSummary.textContent = 'Syntax error — ' + extractShortError(data);
  }
}

export function clearOutputs(): void {
  const outIds = [
    'out-formatter','out-minifier','out-csv','out-yaml','out-xml',
    'out-typescript','out-zod','out-schema','out-openapi','out-go',
    'out-pydantic','out-java','out-kotlin'
  ];
  outIds.forEach(id => {
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (el) el.value = '';
  });
  const viewer = document.getElementById('out-viewer');
  if (viewer) viewer.innerHTML = '<div class="jt-panel-empty">Paste JSON on the left to explore the interactive tree.</div>';
  const validator = document.getElementById('out-validator');
  if (validator) validator.innerHTML = '<div class="jt-panel-empty">Paste JSON on the left to validate syntax.</div>';
}

// ── Save to session ───────────────────────────────────────────
export function saveToSession(json: string): void {
  try { sessionStorage.setItem('jt-json', json); } catch (_) {}
}

// ── Main processing pipeline ──────────────────────────────────
export function processInput(raw: string): void {
  setCurrentJson(raw);
  saveToSession(raw);

  if (!raw.trim()) {
    showStatus('idle');
    setParsedData(null);
    setIsValid(false);
    clearOutputs();
    return;
  }

  try {
    setParsedData(JSON.parse(raw));
    setIsValid(true);
    showStatus('valid', parsedData);
    if (activeTab !== 'compare') runTool(activeTab);
    if (searchQuery.trim()) executeSearch(searchQuery);
  } catch (e: unknown) {
    setIsValid(false);
    setParsedData(null);
    const msg = (e instanceof Error) ? e.message : String(e);
    showStatus('error', msg);
    clearOutputs();
    if (activeTab === 'validator') runValidator();
  }
}

// ── Tool router ───────────────────────────────────────────────
export function runTool(tab: string): void {
  if (!isValid || parsedData === undefined) return;
  switch (tab) {
    case 'formatter':  runFormatter();  break;
    case 'viewer':     runViewer();     break;
    case 'validator':  runValidator();  break;
    case 'minifier':   runMinifier();   break;
    case 'csv':        runCsv();        break;
    case 'yaml':       runYaml();       break;
    case 'xml':        runXml();        break;
    case 'typescript': runTypeScript(); break;
    case 'zod':        runZod();        break;
    case 'schema':     runSchema();     break;
    case 'openapi':    runOpenApi();    break;
    case 'go':         runGo();         break;
    case 'pydantic':   runPydantic();   break;
    case 'java':       runJava();       break;
    case 'kotlin':     runKotlin();     break;
  }
}

// ═══════════════════════════════════════════════════════════
// 1. FORMATTER
// ═══════════════════════════════════════════════════════════
export function runFormatter(): void {
  const indent = indentSize === 'tab' ? '\t' : Number(indentSize);
  const out = document.getElementById('out-formatter') as HTMLTextAreaElement;
  if (out && parsedData !== null) out.value = JSON.stringify(parsedData, null, indent);
}

// ═══════════════════════════════════════════════════════════
// 2. VALIDATOR
// ═══════════════════════════════════════════════════════════
function parseErrorPosition(msg: string, raw: string): { line: number | null, col: number | null } {
  const posMatch = msg.match(/position (\d+)/);
  if (posMatch) {
    const pos    = Number(posMatch[1]);
    const before = raw.slice(0, pos);
    const line   = (before.match(/\n/g) || []).length + 1;
    const lastNl = before.lastIndexOf('\n');
    const col    = lastNl === -1 ? pos + 1 : pos - lastNl;
    return { line, col };
  }
  const lcMatch = msg.match(/line (\d+) column (\d+)/i);
  if (lcMatch) return { line: Number(lcMatch[1]), col: Number(lcMatch[2]) };
  return { line: null, col: null };
}

export function runValidator(): void {
  const container = document.getElementById('out-validator');
  if (!container) return;
  if (isValid && parsedData !== null) {
    const desc     = describeJson(parsedData);
    const keyCount = (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData))
      ? Object.keys(parsedData as object).length : null;
    container.innerHTML = `
      <div class="jt-valid-card">
        <div class="jt-valid-card-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div>
          <div style="font-weight:600;font-size:14px;margin-bottom:8px">Valid JSON Syntax</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="jt-error-badge">Type: ${desc}</span>
            <span class="jt-error-badge">Size: ${currentJson.length.toLocaleString()} chars</span>
            ${keyCount !== null ? `<span class="jt-error-badge">Top-level keys: ${keyCount}</span>` : ''}
          </div>
        </div>
      </div>`;
  } else {
    let errorMsg = 'Invalid JSON';
    try { JSON.parse(currentJson); } catch (e: unknown) {
      errorMsg = (e instanceof Error) ? e.message : String(e);
    }
    const { line, col } = parseErrorPosition(errorMsg, currentJson);
    container.innerHTML = `
      <div class="jt-error-card">
        <div class="jt-error-card-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Syntax Error
        </div>
        <div class="jt-error-card-msg">${escHtml(errorMsg)}</div>
        ${(line || col) ? `<div class="jt-error-meta">
          ${line ? `<span class="jt-error-badge">Line ${line}</span>` : ''}
          ${col  ? `<span class="jt-error-badge">Column ${col}</span>` : ''}
        </div>` : ''}
      </div>`;
  }
}

// ═══════════════════════════════════════════════════════════
// 3. MINIFIER
// ═══════════════════════════════════════════════════════════
export function runMinifier(): void {
  const out  = document.getElementById('out-minifier') as HTMLTextAreaElement;
  const stat = document.getElementById('stat-minifier');
  if (!out || parsedData === null) return;
  const minified = JSON.stringify(parsedData);
  out.value = minified;
  if (stat) {
    const saved = currentJson.length - minified.length;
    stat.textContent = `${minified.length} chars · saved ${saved >= 0 ? saved : 0} bytes`;
  }
}

// ═══════════════════════════════════════════════════════════
// 4. JSON → CSV
// ═══════════════════════════════════════════════════════════
function runCsv(): void {
  const out  = document.getElementById('out-csv') as HTMLTextAreaElement;
  const data = parsedData;
  if (!out) return;
  if (!Array.isArray(data) || data.length === 0) {
    out.value = '# Note: CSV conversion requires a top-level JSON array of objects.\n# Example: [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]';
    return;
  }
  const headers: string[] = [];
  data.forEach(row => {
    if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
      Object.keys(row as object).forEach(k => { if (!headers.includes(k)) headers.push(k); });
    }
  });
  const csvEscape = (val: unknown): string => {
    const s = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const rows: string[] = [headers.map(csvEscape).join(',')];
  data.forEach(row => {
    if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
      const r = row as Record<string, unknown>;
      rows.push(headers.map(h => csvEscape(r[h])).join(','));
    }
  });
  out.value = rows.join('\n');
}

// ═══════════════════════════════════════════════════════════
// 5. JSON → YAML
// ═══════════════════════════════════════════════════════════
function toYaml(val: unknown, depth: number): string {
  const indent = '  '.repeat(depth);
  if (val === null)            return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number')  return String(val);
  if (typeof val === 'string') {
    if (/[\n:{}[\],#&*?|<>=!%@`'"\\]/.test(val) || val.trim() !== val || val === '') {
      return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return val;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val.map(item => {
      const rendered = toYaml(item, depth + 1);
      return typeof item === 'object' && item !== null
        ? `${indent}- ${rendered.trimStart()}`
        : `${indent}- ${rendered}`;
    }).join('\n');
  }
  if (typeof val === 'object' && val !== null) {
    const obj  = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys.map(k => {
      const v       = obj[k];
      const yamlKey = /[:\#\[\]\{\}&*?|<>=!%@`]/.test(k) ? `"${k}"` : k;
      if (typeof v === 'object' && v !== null) return `${indent}${yamlKey}:\n${toYaml(v, depth + 1)}`;
      return `${indent}${yamlKey}: ${toYaml(v, depth + 1)}`;
    }).join('\n');
  }
  return String(val);
}

function runYaml(): void {
  const out = document.getElementById('out-yaml') as HTMLTextAreaElement;
  if (out && parsedData !== null) out.value = toYaml(parsedData, 0);
}

// ═══════════════════════════════════════════════════════════
// 6. JSON → XML
// ═══════════════════════════════════════════════════════════
function escXml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return `${word}_item`;
}
function toXml(val: unknown, tag: string, depth: number): string {
  const indent  = '  '.repeat(depth);
  const safeTag = tag.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  if (val === null || val === undefined) return `${indent}<${safeTag} xsi:nil="true"/>`;
  if (typeof val !== 'object') return `${indent}<${safeTag}>${escXml(String(val))}</${safeTag}>`;
  if (Array.isArray(val)) {
    const itemTag = singularize(safeTag);
    return val.map(item => toXml(item, itemTag, depth)).join('\n');
  }
  const obj      = val as Record<string, unknown>;
  const children = Object.entries(obj).map(([k, v]) => toXml(v, k, depth + 1)).join('\n');
  return `${indent}<${safeTag}>\n${children}\n${indent}</${safeTag}>`;
}
function runXml(): void {
  const out = document.getElementById('out-xml') as HTMLTextAreaElement;
  if (out && parsedData !== null) out.value = `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(parsedData, 'root', 0)}`;
}

// ═══════════════════════════════════════════════════════════
// 7. JSON → TYPESCRIPT INTERFACES
// ═══════════════════════════════════════════════════════════
function inferTsType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'null';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'boolean')return 'boolean';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'unknown[]';
    const types    = [...new Set(val.map(item => inferTsType(item, name + 'Item', output)))];
    const itemType = types.length === 1 ? types[0] : types.join(' | ');
    return itemType.includes(' | ') ? `(${itemType})[]` : `${itemType}[]`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj   = val as Record<string, unknown>;
    const lines = Object.keys(obj).map(k => {
      const tsType  = inferTsType(obj[k], toPascalCase(k), output);
      const validKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `  ${validKey}: ${tsType};`;
    });
    output.push(`export interface ${name} {\n${lines.join('\n')}\n}`);
    return name;
  }
  return 'unknown';
}
function runTypeScript(): void {
  const out = document.getElementById('out-typescript') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const interfaces: string[] = [];
  inferTsType(parsedData, 'RootObject', interfaces);
  out.value = interfaces.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// 8. JSON → ZOD SCHEMA
// ═══════════════════════════════════════════════════════════
function inferZodType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'z.null()';
  if (typeof val === 'string') return 'z.string()';
  if (typeof val === 'number') return 'z.number()';
  if (typeof val === 'boolean')return 'z.boolean()';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'z.array(z.unknown())';
    const types    = [...new Set(val.map(item => inferZodType(item, name + 'Item', output)))];
    const itemType = types.length === 1 ? types[0] : `z.union([${types.join(', ')}])`;
    return `z.array(${itemType})`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj        = val as Record<string, unknown>;
    const lines      = Object.keys(obj).map(k => {
      const zodType  = inferZodType(obj[k], toPascalCase(k), output);
      const validKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `  ${validKey}: ${zodType},`;
    });
    const schemaName = `${name}Schema`;
    output.push(`export const ${schemaName} = z.object({\n${lines.join('\n')}\n});`);
    return schemaName;
  }
  return 'z.unknown()';
}
function runZod(): void {
  const out = document.getElementById('out-zod') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const schemas: string[] = [];
  const rootSchema = inferZodType(parsedData, 'Root', schemas);
  schemas.push(`export const RootSchema = ${rootSchema};`);
  out.value = `import { z } from 'zod';\n\n` + schemas.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// 9. JSON SCHEMA (DRAFT-07)
// ═══════════════════════════════════════════════════════════
function inferJsonSchema(val: unknown): Record<string, unknown> {
  if (val === null)            return { type: 'null' };
  if (typeof val === 'string') return { type: 'string' };
  if (typeof val === 'number') return Number.isInteger(val) ? { type: 'integer' } : { type: 'number' };
  if (typeof val === 'boolean')return { type: 'boolean' };
  if (Array.isArray(val)) {
    if (val.length === 0) return { type: 'array' };
    const itemSchemas = val.map(item => inferJsonSchema(item));
    const types = [...new Set(itemSchemas.map(s => s['type']))];
    return { type: 'array', items: types.length === 1 ? itemSchemas[0] : { oneOf: itemSchemas } };
  }
  if (typeof val === 'object' && val !== null) {
    const obj  = val as Record<string, unknown>;
    const keys = Object.keys(obj);
    const properties: Record<string, unknown> = {};
    keys.forEach(k => { properties[k] = inferJsonSchema(obj[k]); });
    return { type: 'object', properties, required: keys.filter(k => obj[k] !== null && obj[k] !== undefined) };
  }
  return {};
}
function runSchema(): void {
  const out = document.getElementById('out-schema') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  out.value = JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema#', ...inferJsonSchema(parsedData) }, null, 2);
}

// ═══════════════════════════════════════════════════════════
// 10. OPENAPI 3.0
// ═══════════════════════════════════════════════════════════
function runOpenApi(): void {
  const out = document.getElementById('out-openapi') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  out.value = toYaml({ openapi: '3.0.3', info: { title: 'Generated API Schema', version: '1.0.0' }, paths: {}, components: { schemas: { RootResponse: inferJsonSchema(parsedData) } } }, 0);
}

// ═══════════════════════════════════════════════════════════
// 11. GO STRUCTS
// ═══════════════════════════════════════════════════════════
function inferGoType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'any';
  if (typeof val === 'string') return 'string';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int64' : 'float64';
  if (typeof val === 'boolean')return 'bool';
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]any';
    return `[]${inferGoType(val[0], name + 'Item', output)}`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj   = val as Record<string, unknown>;
    const lines = Object.keys(obj).map(k => {
      const fieldName = toPascalCase(k);
      return `\t${fieldName} ${inferGoType(obj[k], fieldName, output)} \`json:"${k}"\``;
    });
    output.push(`type ${name} struct {\n${lines.join('\n')}\n}`);
    return name;
  }
  return 'any';
}
function runGo(): void {
  const out = document.getElementById('out-go') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const structs: string[] = [];
  inferGoType(parsedData, 'Root', structs);
  out.value = `package main\n\n` + structs.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// 12. PYTHON PYDANTIC V2
// ═══════════════════════════════════════════════════════════
function inferPydanticType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'Optional[Any] = None';
  if (typeof val === 'string') return 'str';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float';
  if (typeof val === 'boolean')return 'bool';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'List[Any]';
    return `List[${inferPydanticType(val[0], name + 'Item', output)}]`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj   = val as Record<string, unknown>;
    const lines = Object.keys(obj).map(k => {
      const fieldName = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `field_${k}`;
      const typeStr   = inferPydanticType(obj[k], toPascalCase(k), output);
      return fieldName !== k
        ? `    ${fieldName}: ${typeStr} = Field(alias="${k}")`
        : `    ${k}: ${typeStr}`;
    });
    output.push(`class ${name}(BaseModel):\n${lines.length ? lines.join('\n') : '    pass'}`);
    return name;
  }
  return 'Any';
}
function runPydantic(): void {
  const out = document.getElementById('out-pydantic') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const models: string[] = [];
  inferPydanticType(parsedData, 'RootModel', models);
  out.value = `from typing import List, Optional, Any, Dict\nfrom pydantic import BaseModel, Field\n\n\n` + models.join('\n\n\n');
}

// ═══════════════════════════════════════════════════════════
// 13. JAVA POJO (JACKSON)
// ═══════════════════════════════════════════════════════════
function inferJavaType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'Object';
  if (typeof val === 'string') return 'String';
  if (typeof val === 'number') return Number.isInteger(val) ? 'Long' : 'Double';
  if (typeof val === 'boolean')return 'Boolean';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'List<Object>';
    return `List<${inferJavaType(val[0], name + 'Item', output)}>`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj          = val as Record<string, unknown>;
    const fieldDefs    = Object.keys(obj).map(k => {
      const javaType = inferJavaType(obj[k], toPascalCase(k), output);
      const varName  = toCamelCase(k);
      return `    @JsonProperty("${k}")\n    private ${javaType} ${varName};`;
    });
    const gettersSetters = Object.keys(obj).map(k => {
      const javaType   = inferJavaType(obj[k], toPascalCase(k), []);
      const varName    = toCamelCase(k);
      const methodName = toPascalCase(k);
      return `    public ${javaType} get${methodName}() { return this.${varName}; }\n    public void set${methodName}(${javaType} ${varName}) { this.${varName} = ${varName}; }`;
    });
    output.push(`public class ${name} {\n${fieldDefs.join('\n\n')}\n\n${gettersSetters.join('\n\n')}\n}`);
    return name;
  }
  return 'Object';
}
function runJava(): void {
  const out = document.getElementById('out-java') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const classes: string[] = [];
  inferJavaType(parsedData, 'Root', classes);
  out.value = `import com.fasterxml.jackson.annotation.JsonProperty;\nimport java.util.List;\n\n` + classes.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// 14. KOTLIN DATA CLASSES
// ═══════════════════════════════════════════════════════════
function inferKotlinType(val: unknown, name: string, output: string[]): string {
  if (val === null)            return 'Any?';
  if (typeof val === 'string') return 'String';
  if (typeof val === 'number') return Number.isInteger(val) ? 'Long' : 'Double';
  if (typeof val === 'boolean')return 'Boolean';
  if (Array.isArray(val)) {
    if (val.length === 0) return 'List<Any>';
    return `List<${inferKotlinType(val[0], name + 'Item', output)}>`;
  }
  if (typeof val === 'object' && val !== null) {
    const obj   = val as Record<string, unknown>;
    const lines = Object.keys(obj).map(k => {
      const fieldName = toCamelCase(k);
      const ktType    = inferKotlinType(obj[k], toPascalCase(k), output);
      return `    @SerialName("${k}")\n    val ${fieldName}: ${ktType}`;
    });
    output.push(`@Serializable\ndata class ${name}(\n${lines.join(',\n')}\n)`);
    return name;
  }
  return 'Any';
}
function runKotlin(): void {
  const out = document.getElementById('out-kotlin') as HTMLTextAreaElement;
  if (!out || parsedData === null) return;
  const classes: string[] = [];
  inferKotlinType(parsedData, 'Root', classes);
  out.value = `import kotlinx.serialization.Serializable\nimport kotlinx.serialization.SerialName\n\n` + classes.join('\n\n');
}

// ═══════════════════════════════════════════════════════════
// SHARED COPY / DOWNLOAD HELPERS
// ═══════════════════════════════════════════════════════════
function setupCopy(btnId: string, getContent: () => string): void {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const text = getContent();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const span = btn.querySelector('span');
      const orig = span?.textContent ?? 'Copy';
      if (span) span.textContent = 'Copied!';
      setTimeout(() => { if (span) span.textContent = orig; }, 1500);
    } catch (_) {}
  });
}

function setupDownload(btnId: string, filename: string, getContent: () => string, mime = 'text/plain'): void {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const text = getContent();
    if (!text) return;
    const blob = new Blob([text], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  });
}

const getOut = (id: string) => () => (document.getElementById(id) as HTMLTextAreaElement)?.value ?? '';

export function initTools(): void {
  // Indent buttons
  dom.indentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.indentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setIndentSize(btn.dataset.indent === 'tab' ? 'tab' : Number(btn.dataset.indent));
      if (isValid) runFormatter();
    });
  });

  document.getElementById('btn-format-input')?.addEventListener('click', () => {
    const input = dom.input;
    if (isValid && parsedData !== null && input) {
      const indent = indentSize === 'tab' ? '\t' : Number(indentSize);
      input.value = JSON.stringify(parsedData, null, indent);
      processInput(input.value);
    }
  });

  // Input listeners
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const input = dom.input;
  input?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => processInput(input.value), 160);
  });

  // Sample / Clear / Load file
  const SAMPLE_JSON = {"toolkit":"The Developer Tools","version":"1.0.0","private":true,"users":[{"id":1,"name":"Alice Chen","email":"alice@example.com","role":"admin","active":true,"address":{"city":"New York","country":"US","zip":"10001"},"tags":["developer"],"metadata":{"source":"import","verified":true}},{"id":2,"name":"Bob Smith","email":"bob@example.com","role":"viewer","active":false,"address":{"city":"New York","country":"US","zip":"10001"},"tags":["writer"],"metadata":{"source":"import","verified":true}}],"pagination":{"total":2,"page":1,"perPage":10}};

  document.getElementById('btn-sample')?.addEventListener('click', () => {
    if (input) { input.value = JSON.stringify(SAMPLE_JSON, null, 2); processInput(input.value); }
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    if (input) input.value = '';
    processInput('');
    try { sessionStorage.removeItem('jt-json'); } catch (_) {}
  });

  const fileInput = dom.fileInput;
  document.getElementById('btn-load-file')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      const text = e.target?.result as string;
      if (input) input.value = text;
      processInput(text);
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  // Drag & drop
  const dropZone = dom.dropZone;
  dropZone?.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone?.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget as Node)) dropZone.classList.remove('dragging'); });
  dropZone?.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('dragging');
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: ProgressEvent<FileReader>) => {
      const text = ev.target?.result as string;
      if (input) input.value = text;
      processInput(text);
    };
    reader.readAsText(file);
  });

  // Copy buttons
  setupCopy('btn-copy-formatter',  getOut('out-formatter'));
  setupCopy('btn-copy-minifier',   getOut('out-minifier'));
  setupCopy('btn-copy-csv',        getOut('out-csv'));
  setupCopy('btn-copy-yaml',       getOut('out-yaml'));
  setupCopy('btn-copy-xml',        getOut('out-xml'));
  setupCopy('btn-copy-typescript', getOut('out-typescript'));
  setupCopy('btn-copy-zod',        getOut('out-zod'));
  setupCopy('btn-copy-schema',     getOut('out-schema'));
  setupCopy('btn-copy-openapi',    getOut('out-openapi'));
  setupCopy('btn-copy-go',         getOut('out-go'));
  setupCopy('btn-copy-pydantic',   getOut('out-pydantic'));
  setupCopy('btn-copy-java',       getOut('out-java'));
  setupCopy('btn-copy-kotlin',     getOut('out-kotlin'));

  // Download buttons
  setupDownload('btn-dl-formatter',  'formatted.json', getOut('out-formatter'),  'application/json');
  setupDownload('btn-dl-minifier',   'minified.json',  getOut('out-minifier'),   'application/json');
  setupDownload('btn-dl-csv',        'data.csv',       getOut('out-csv'),        'text/csv');
  setupDownload('btn-dl-yaml',       'data.yaml',      getOut('out-yaml'),       'text/yaml');
  setupDownload('btn-dl-xml',        'data.xml',       getOut('out-xml'),        'application/xml');
  setupDownload('btn-dl-typescript', 'types.ts',       getOut('out-typescript'), 'text/typescript');
  setupDownload('btn-dl-zod',        'schema.ts',      getOut('out-zod'),        'text/typescript');
  setupDownload('btn-dl-schema',     'schema.json',    getOut('out-schema'),     'application/json');
  setupDownload('btn-dl-openapi',    'openapi.yaml',   getOut('out-openapi'),    'text/yaml');
  setupDownload('btn-dl-go',         'types.go',       getOut('out-go'));
  setupDownload('btn-dl-pydantic',   'models.py',      getOut('out-pydantic'));
  setupDownload('btn-dl-java',       'Root.java',      getOut('out-java'));
  setupDownload('btn-dl-kotlin',     'Root.kt',        getOut('out-kotlin'));
}
