import { readFileContent } from '../scanner/fileScanner.js';
import { resolve, dirname, extname } from 'node:path';
import type { ScannedFile, DeadCodeResult, DeadExport } from '../types.js';

// ---------------------------------------------------------------------------
// Dead Code Analyzer
//
// Improved strategy (v2):
//  1. Scan all TS/JS files for exported symbols, tracking them as
//     { absFilePath, symbol } tuples.
//  2. Collect all imports, resolving specifiers to absolute paths so that
//     cross-file symbol matching is accurate.
//  3. Track star-imports (import * as X from '...') — any export from that
//     file is considered consumed.
//  4. Skip `import type { Foo }` default imports (the default import regex
//     was previously matching the word after `import type`).
//  5. Any export whose (absFilePath, symbol) pair is never matched by an
//     import is flagged as potentially dead.
//
// Limitations:
//  - Dynamic imports (require(), import()) are not fully tracked.
//  - Re-exports (export * from) are treated as consumed.
//  - Public API entry points (index.ts) exports are always excluded.
// ---------------------------------------------------------------------------

type ExportType = DeadExport['exportType'];

interface ExportRecord {
  absPath: string;
  relativePath: string;
  symbol: string;
  line: number;
  exportType: ExportType;
}

// Patterns for detecting exports in JS/TS
const EXPORT_PATTERNS: Array<{ re: RegExp; type: ExportType }> = [
  { re: /^export\s+(?:async\s+)?function\s+(\w+)/, type: 'function' },
  { re: /^export\s+(?:default\s+)?class\s+(\w+)/, type: 'class' },
  { re: /^export\s+(?:const|let|var)\s+(\w+)/, type: 'variable' },
  { re: /^export\s+type\s+(\w+)/, type: 'type' },
  { re: /^export\s+interface\s+(\w+)/, type: 'interface' },
  { re: /^export\s+enum\s+(\w+)/, type: 'enum' },
  { re: /^export\s+abstract\s+class\s+(\w+)/, type: 'class' },
];

// Named imports (including `import type { Foo }`)
const NAMED_IMPORT_RE = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
// Default import — must NOT be preceded by "type" keyword
// e.g. `import Foo from '...'` but NOT `import type Foo from '...'` (that's a type-only default import)
const DEFAULT_IMPORT_RE = /import\s+(?!type\s+\{)(?:type\s+)?(\w+)\s+from\s+['"]([^'"]+)['"]/g;
// Star import: import * as X from '...'
const STAR_IMPORT_RE = /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g;
// Re-export: export * from / export { X } from
const REEXPORT_RE = /export\s+(?:\*|\{[^}]+\})\s+from/;

const SUPPORTED_LANGUAGES = new Set(['TypeScript', 'JavaScript']);

// Extensions to try when resolving bare import specifiers
const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

/** Files named index.* are entry points — exports there are always considered used */
function isEntryPoint(relativePath: string): boolean {
  const base = relativePath.split('/').pop() ?? '';
  return /^index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base);
}

/**
 * Resolve an import specifier to an absolute file path.
 * Returns null if the specifier is not relative (i.e. an npm package).
 */
function resolveSpecifier(specifier: string, fromFile: string): string | null {
  if (!specifier.startsWith('.')) return null; // npm package — skip

  const base = resolve(dirname(fromFile), specifier);

  // If it already has an extension (or is exact), return as-is
  if (extname(base) !== '') return base;

  // Try appending common extensions
  for (const ext of TS_EXTENSIONS) {
    const candidate = base + ext;
    // We can't check fs existence here (sync check would slow things down);
    // return the .ts variant as the canonical key — callers normalise by absPath
    if (ext === '.ts' || ext === '.tsx') return candidate;
  }

  return base + '.ts'; // best guess
}

function extractExports(content: string, file: ScannedFile): ExportRecord[] {
  const lines = content.split('\n');
  const records: ExportRecord[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] ?? '').trim();

    // Skip re-exports
    if (REEXPORT_RE.test(line)) continue;

    for (const { re, type } of EXPORT_PATTERNS) {
      const match = re.exec(line);
      if (match?.[1] !== undefined) {
        records.push({
          absPath: file.path,
          relativePath: file.relativePath,
          symbol: match[1],
          line: i + 1,
          exportType: type,
        });
        break;
      }
    }
  }

  return records;
}

interface ImportedRef {
  /** Resolved absolute path of the source file, or null for npm packages */
  absPath: string | null;
  symbol: string;
}

function extractImportedRefs(content: string, fromFile: string): ImportedRef[] {
  const refs: ImportedRef[] = [];

  let match: RegExpExecArray | null;

  // Named imports
  NAMED_IMPORT_RE.lastIndex = 0;
  while ((match = NAMED_IMPORT_RE.exec(content)) !== null) {
    const names = match[1] ?? '';
    const specifier = match[2] ?? '';
    const absPath = resolveSpecifier(specifier, fromFile);
    for (const part of names.split(',')) {
      // Handle aliased imports: Foo as F — track original exported name
      const original = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (original && original.length > 0) {
        refs.push({ absPath, symbol: original });
      }
    }
  }

  // Default imports — `import Foo from '...'`
  // Skip `import type Foo from` — that's a type-only default import, symbol
  // must still be tracked because it corresponds to an `export default class Foo`
  DEFAULT_IMPORT_RE.lastIndex = 0;
  while ((match = DEFAULT_IMPORT_RE.exec(content)) !== null) {
    const name = match[1];
    const specifier = match[2] ?? '';
    if (name !== undefined && name.length > 0 && name !== 'type') {
      const absPath = resolveSpecifier(specifier, fromFile);
      refs.push({ absPath, symbol: name });
    }
  }

  return refs;
}

/** Returns the set of absolute paths that are star-imported from */
function extractStarImportedPaths(content: string, fromFile: string): Set<string> {
  const paths = new Set<string>();
  STAR_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STAR_IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1] ?? '';
    const abs = resolveSpecifier(specifier, fromFile);
    if (abs !== null) paths.add(abs);
  }
  return paths;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeDeadCode(
  files: ScannedFile[],
  contentCache?: Map<string, string>,
): Promise<DeadCodeResult> {
  const tsJsFiles = files.filter((f) => SUPPORTED_LANGUAGES.has(f.language));

  if (tsJsFiles.length === 0) {
    return { deadExports: [], totalExports: 0, deadRatio: 0 };
  }

  // Phase 1: collect all exports + cache file contents
  const allExports: ExportRecord[] = [];
  const fileContents = new Map<string, string>();

  for (const file of tsJsFiles) {
    const content = await readFileContent(file.path, contentCache);
    if (content === null) continue;
    fileContents.set(file.path, content);

    if (isEntryPoint(file.relativePath)) continue;

    const exports = extractExports(content, file);
    allExports.push(...exports);
  }

  // Phase 2: collect all imported refs (with resolved paths) + star-import paths
  const importedRefs: ImportedRef[] = [];
  const starImportedPaths = new Set<string>();

  for (const [absFilePath, content] of fileContents) {
    const refs = extractImportedRefs(content, absFilePath);
    importedRefs.push(...refs);

    for (const p of extractStarImportedPaths(content, absFilePath)) {
      starImportedPaths.add(p);
    }
  }

  // Build lookup: "absPath:symbol" → imported?
  // For path-resolved imports, key is `${resolvedAbsPath}:${symbol}`
  // For unresolved (npm packages), fall back to symbol-only matching
  const importedByPathSymbol = new Set<string>();
  const importedBySymbolOnly = new Set<string>();

  for (const ref of importedRefs) {
    if (ref.absPath !== null) {
      importedByPathSymbol.add(`${ref.absPath}:${ref.symbol}`);
    } else {
      importedBySymbolOnly.add(ref.symbol);
    }
  }

  // Phase 3: find exports never imported
  const deadExports: DeadExport[] = allExports
    .filter((e) => {
      // If the file is star-imported, all its exports are considered used
      if (starImportedPaths.has(e.absPath)) return false;

      const pathSymbolKey = `${e.absPath}:${e.symbol}`;
      if (importedByPathSymbol.has(pathSymbolKey)) return false;
      if (importedBySymbolOnly.has(e.symbol)) return false;
      return true;
    })
    .map((e) => ({
      path: e.relativePath,
      symbol: e.symbol,
      line: e.line,
      exportType: e.exportType,
    }));

  const totalExports = allExports.length;
  const deadRatio =
    totalExports === 0 ? 0 : Math.round((deadExports.length / totalExports) * 1000) / 10;

  return { deadExports, totalExports, deadRatio };
}

/** Exported for testing */
export { resolveSpecifier };
