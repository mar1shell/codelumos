import { readFile, stat, open } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import fg from 'fast-glob';
import type { Ignore as IgnoreInstance } from 'ignore';
// ignore is a CJS package — the callable factory is at .default.default in ESM
import _ignore from 'ignore';
const createIgnore = (_ignore as unknown as { default: () => IgnoreInstance }).default;
import { detectLanguage } from './languageMap.js';
import type { ScannedFile } from '../types.js';

// ---------------------------------------------------------------------------
// Binary detection – check first 8 KB for null bytes
// ---------------------------------------------------------------------------
const SAMPLE_BYTES = 8192;

async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const fd = await open(filePath, 'r');
    const buf = Buffer.alloc(SAMPLE_BYTES);
    const { bytesRead } = await fd.read(buf, 0, SAMPLE_BYTES, 0);
    await fd.close();
    for (let i = 0; i < bytesRead; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return true; // treat unreadable files as binary
  }
}

// ---------------------------------------------------------------------------
// Gitignore loading
// ---------------------------------------------------------------------------

function loadIgnoreRules(rootDir: string, extraPatterns: string[]): IgnoreInstance {
  const ig = createIgnore();

  // Always ignore these
  ig.add([
    'node_modules/',
    '.git/',
    'dist/',
    'build/',
    'coverage/',
    '.next/',
    '.nuxt/',
    '__pycache__/',
    '*.pyc',
    '*.pyo',
    '.DS_Store',
    'Thumbs.db',
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.lock',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ]);

  // Load .gitignore if present
  const gitignorePath = resolve(rootDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    try {
      const content = readFileSync(gitignorePath, 'utf8');
      ig.add(content);
    } catch {
      // silently ignore read errors
    }
  }

  if (extraPatterns.length > 0) {
    ig.add(extraPatterns);
  }

  return ig;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** Extra glob patterns to ignore */
  ignore?: string[];
  /** Called with (scanned, total) as files are processed */
  onProgress?: (scanned: number, total: number) => void;
  /** Maximum file size in bytes to include (default: 2 MB) */
  maxFileSizeBytes?: number;
}

export interface ScanResult {
  files: ScannedFile[];
  skippedBinary: number;
  skippedTooBig: number;
  skippedIgnored: number;
  skippedUnknown: number;
}

const DEFAULT_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function scanDirectory(
  rootDir: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const resolvedRoot = resolve(rootDir);
  const maxSize = options.maxFileSizeBytes ?? DEFAULT_MAX_SIZE;
  const ig = loadIgnoreRules(resolvedRoot, options.ignore ?? []);

  // Discover all files (fast-glob returns forward-slash paths)
  const allPaths = await fg('**/*', {
    cwd: resolvedRoot,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    absolute: false,
  });

  // Apply ignore rules
  const filteredPaths = ig.filter(allPaths);
  const skippedIgnored = allPaths.length - filteredPaths.length;

  const files: ScannedFile[] = [];
  let skippedBinary = 0;
  let skippedTooBig = 0;
  let skippedUnknown = 0;
  let scanned = 0;

  for (const relPath of filteredPaths) {
    const absPath = resolve(resolvedRoot, relPath);

    // Size check
    let sizeBytes = 0;
    try {
      const info = await stat(absPath);
      sizeBytes = info.size;
    } catch {
      continue;
    }

    if (sizeBytes > maxSize) {
      skippedTooBig++;
      scanned++;
      options.onProgress?.(scanned, filteredPaths.length);
      continue;
    }

    // Binary check
    if (await isBinaryFile(absPath)) {
      skippedBinary++;
      scanned++;
      options.onProgress?.(scanned, filteredPaths.length);
      continue;
    }

    // Detect language
    // Fast-path: check if we can detect from filename before reading
    let language = detectLanguage(absPath);

    if (language === 'Unknown') {
      // Need shebang line detection
      let firstLine: string | undefined;
      try {
        const fd = await open(absPath, 'r');
        const buf = Buffer.alloc(256);
        const { bytesRead } = await fd.read(buf, 0, 256, 0);
        await fd.close();
        let endIdx = buf.indexOf(10); // '\n'
        if (endIdx === -1) endIdx = bytesRead;
        firstLine = buf.toString('utf8', 0, endIdx);
      } catch {
        scanned++;
        options.onProgress?.(scanned, filteredPaths.length);
        continue;
      }
      language = detectLanguage(absPath, firstLine);
    }

    // Skip files we cannot classify — no useful analysis can be done on them
    if (language === 'Unknown') {
      skippedUnknown++;
      scanned++;
      options.onProgress?.(scanned, filteredPaths.length);
      continue;
    }

    files.push({
      path: absPath,
      relativePath: relative(resolvedRoot, absPath),
      language,
      sizeBytes,
    });

    scanned++;
    options.onProgress?.(scanned, filteredPaths.length);
  }

  return { files, skippedBinary, skippedTooBig, skippedIgnored, skippedUnknown };
}

/** Read a file's content, returning null on error */
export async function readFileContent(
  filePath: string,
  cache?: Map<string, string>,
): Promise<string | null> {
  if (cache !== undefined) {
    const cached = cache.get(filePath);
    if (cached !== undefined) return cached;
  }
  try {
    const content = await readFile(filePath, 'utf8');
    cache?.set(filePath, content);
    return content;
  } catch {
    return null;
  }
}

/**
 * Preload every file's content into a shared cache.
 * Pass the returned Map to each analyzer to avoid redundant disk reads.
 */
export async function preloadContents(
  files: ScannedFile[],
): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  await Promise.all(
    files.map(async (f) => {
      try {
        const content = await readFile(f.path, 'utf8');
        cache.set(f.path, content);
      } catch {
        // skip unreadable files — analyzers will get null
      }
    }),
  );
  return cache;
}
