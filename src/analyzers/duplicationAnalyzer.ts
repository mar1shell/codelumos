import { createHash } from 'node:crypto';
import { readFileContent } from '../scanner/fileScanner.js';
import type { ScannedFile, DuplicationResult, DuplicateBlock } from '../types.js';

// ---------------------------------------------------------------------------
// Token-based duplication detection using rolling window hashing
//
// Algorithm:
//  1. Normalize each line (strip leading/trailing whitespace, collapse internal
//     whitespace to single spaces, remove pure-comment lines).
//  2. Slide a window of MIN_LINES lines over the file, hash each window.
//  3. Group identical hashes across all files.
//  4. Report groups with 2+ occurrences as duplicate blocks.
// ---------------------------------------------------------------------------

const DEFAULT_MIN_LINES = 6;
const DEFAULT_MIN_TOKENS = 20; // ignore windows with too little content

/** Normalize a line for comparison: strip whitespace, remove comments */
function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\/\/.*$/, '')   // strip JS/TS/Go single-line comments
    .replace(/#.*$/, '')       // strip Python/Shell comments
    .trim();
}

/** Hash a window of normalized lines */
function hashWindow(lines: string[]): string {
  return createHash('sha1').update(lines.join('\n')).digest('hex');
}

interface WindowEntry {
  path: string;
  startLine: number;
  hash: string;
  tokenCount: number;
}

function extractWindows(
  content: string,
  filePath: string,
  minLines: number,
): WindowEntry[] {
  const rawLines = content.split('\n');
  const normalized = rawLines.map(normalizeLine).filter((l) => l.length > 0);

  const entries: WindowEntry[] = [];

  if (normalized.length < minLines) return entries;

  for (let i = 0; i <= normalized.length - minLines; i++) {
    const window = normalized.slice(i, i + minLines);
    const tokenCount = window.join(' ').split(' ').length;
    if (tokenCount < DEFAULT_MIN_TOKENS) continue;

    entries.push({
      path: filePath,
      startLine: i + 1,
      hash: hashWindow(window),
      tokenCount,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeDuplication(
  files: ScannedFile[],
  minLines: number = DEFAULT_MIN_LINES,
  contentCache?: Map<string, string>,
): Promise<DuplicationResult> {
  const allWindows: WindowEntry[] = [];

  for (const file of files) {
    // Only analyze text-based code files, skip markup/config
    const skip = new Set(['JSON', 'YAML', 'TOML', 'XML', 'Markdown', 'HTML', 'Dotenv']);
    if (skip.has(file.language)) continue;

    const content = await readFileContent(file.path, contentCache);
    if (content === null) continue;

    const windows = extractWindows(content, file.relativePath, minLines);
    allWindows.push(...windows);
  }

  // Group windows by hash
  const hashMap = new Map<string, WindowEntry[]>();
  for (const w of allWindows) {
    const existing = hashMap.get(w.hash);
    if (existing === undefined) {
      hashMap.set(w.hash, [w]);
    } else {
      existing.push(w);
    }
  }

  // Filter to only duplicated entries (2+ occurrences in different files or locations)
  const blocks: DuplicateBlock[] = [];
  let duplicatedLines = 0;

  for (const [hash, entries] of hashMap) {
    if (entries.length < 2) continue;

    // Deduplicate: ensure at least 2 different locations
    const unique = new Map<string, WindowEntry>();
    for (const e of entries) {
      const key = `${e.path}:${e.startLine}`;
      if (!unique.has(key)) unique.set(key, e);
    }

    if (unique.size < 2) continue;

    const occurrences = [...unique.values()].map((e) => ({
      path: e.path,
      startLine: e.startLine,
    }));

    blocks.push({ hash, lines: minLines, occurrences });
    // Count duplicated lines (non-originals)
    duplicatedLines += minLines * (occurrences.length - 1);
  }

  // Sort blocks by occurrence count descending
  blocks.sort((a, b) => b.occurrences.length - a.occurrences.length);

  const totalLines = files.reduce((acc, f) => {
    // Rough estimate — will be overridden by LOC data in the scorer
    return acc + f.sizeBytes / 30;
  }, 0);

  const duplicationRate =
    totalLines === 0 ? 0 : Math.round((duplicatedLines / totalLines) * 1000) / 10;

  return {
    blocks,
    duplicatedLines,
    totalLines: Math.round(totalLines),
    duplicationRate: Math.min(duplicationRate, 100),
  };
}

/** Override the total lines with accurate LOC data */
export function recalcDuplicationRate(
  result: DuplicationResult,
  accurateTotalLines: number,
): DuplicationResult {
  const rate =
    accurateTotalLines === 0
      ? 0
      : Math.round((result.duplicatedLines / accurateTotalLines) * 1000) / 10;

  return {
    ...result,
    totalLines: accurateTotalLines,
    duplicationRate: Math.min(rate, 100),
  };
}
