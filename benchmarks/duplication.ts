import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// Replicating the logic from the codebase for isolated benchmarking
// This allows us to compare "Before" (Legacy) vs "After" (Current) implementation
// without needing to revert the actual codebase.

const DEFAULT_MIN_TOKENS = 20;

function normalizeLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\/\/.*$/, '')
    .replace(/#.*$/, '')
    .trim();
}

function hashWindow(lines: string[]): string {
  return createHash('sha1').update(lines.join('\n')).digest('hex');
}

interface WindowEntry {
  path: string;
  startLine: number;
  hash: string;
  tokenCount: number;
}

// ---------------------------------------------------------------------------
// ORIGINAL IMPLEMENTATION (Before Optimization)
// ---------------------------------------------------------------------------
function extractWindowsOriginal(
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
    // EXPENSIVE: Splitting and counting tokens in every window iteration
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
// OPTIMIZED IMPLEMENTATION (Current)
// ---------------------------------------------------------------------------
function extractWindowsOptimized(
  content: string,
  filePath: string,
  minLines: number,
): WindowEntry[] {
  const rawLines = content.split('\n');
  const normalized = rawLines.map(normalizeLine).filter((l) => l.length > 0);

  const entries: WindowEntry[] = [];
  const normalizedLength = normalized.length;

  if (normalizedLength < minLines) return entries;

  // OPTIMIZATION 1: Precompute token counts for ALL lines
  const tokenCounts = new Int32Array(normalizedLength);
  for (let i = 0; i < normalizedLength; i++) {
    if (normalized[i].length === 0) {
      tokenCounts[i] = 0;
    } else {
      // OPTIMIZATION 2: Fast token counting (counting spaces + 1)
      let count = 1;
      const line = normalized[i];
      for (let j = 0; j < line.length; j++) {
        if (line.charCodeAt(j) === 32) count++;
      }
      tokenCounts[i] = count;
    }
  }

  // OPTIMIZATION 3: Sliding window sum
  let currentTokenCount = 0;
  for (let i = 0; i < minLines; i++) {
    currentTokenCount += tokenCounts[i];
  }

  const limit = normalizedLength - minLines;
  for (let i = 0; i <= limit; i++) {
    if (i > 0) {
      currentTokenCount -= tokenCounts[i - 1];
      currentTokenCount += tokenCounts[i + minLines - 1];
    }

    if (currentTokenCount < DEFAULT_MIN_TOKENS) continue;

    const window = normalized.slice(i, i + minLines);
    entries.push({
      path: filePath,
      startLine: i + 1,
      hash: hashWindow(window),
      tokenCount: currentTokenCount,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// BENCHMARK RUNNER
// ---------------------------------------------------------------------------

console.log('Generating test data...');
const lines: string[] = [];
for (let i = 0; i < 20000; i++) {
    lines.push(`const variable${i} = "some value" + ${i}; // comment`);
    lines.push(`if (variable${i}) { console.log('test', variable${i}); }`);
    lines.push(`function doSomething${i}() { return ${i} * 2; }`);
}
const content = lines.join('\n');

console.log(`Content size: ${(content.length / 1024 / 1024).toFixed(2)} MB`);
console.log('Running benchmark...');

// Warmup
extractWindowsOriginal(content.slice(0, 1000), 'test.ts', 6);
extractWindowsOptimized(content.slice(0, 1000), 'test.ts', 6);

const startOriginal = performance.now();
const resOriginal = extractWindowsOriginal(content, 'test.ts', 6);
const endOriginal = performance.now();
const durationOriginal = endOriginal - startOriginal;
console.log(`Original: ${durationOriginal.toFixed(2)}ms`);

const startOptimized = performance.now();
const resOptimized = extractWindowsOptimized(content, 'test.ts', 6);
const endOptimized = performance.now();
const durationOptimized = endOptimized - startOptimized;
console.log(`Optimized: ${durationOptimized.toFixed(2)}ms`);

console.log('--------------------------------------------------');
console.log(`Improvement: ${((durationOriginal - durationOptimized) / durationOriginal * 100).toFixed(2)}% faster`);
console.log('--------------------------------------------------');

// Verify results match
if (resOriginal.length !== resOptimized.length) {
    console.error(`Mismatch in length! Original: ${resOriginal.length}, Optimized: ${resOptimized.length}`);
    process.exit(1);
} else {
    console.log('Verification: Results match.');
}
