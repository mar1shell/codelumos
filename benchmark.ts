
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

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

function extractWindowsOptimized(
  content: string,
  filePath: string,
  minLines: number,
): WindowEntry[] {
  const rawLines = content.split('\n');
  const normalized = rawLines.map(normalizeLine).filter((l) => l.length > 0);

  const entries: WindowEntry[] = [];
  const N = normalized.length;

  if (N < minLines) return entries;

  // Precompute token counts
  const lineTokenCounts = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    // split(' ') is faster than regex if we know it's normalized single spaces
    // But since normalized uses .replace(/\s+/g, ' '), it has single spaces.
    // However, if there are no spaces, it returns [str], length 1.
    lineTokenCounts[i] = normalized[i].split(' ').length;
  }

  // Calculate initial window token count
  let currentTokenCount = 0;
  for (let i = 0; i < minLines; i++) {
    currentTokenCount += lineTokenCounts[i];
  }

  for (let i = 0; i <= N - minLines; i++) {
    // For subsequent iterations, update the sliding window
    if (i > 0) {
      currentTokenCount -= lineTokenCounts[i - 1];
      currentTokenCount += lineTokenCounts[i + minLines - 1];
    }

    if (currentTokenCount < DEFAULT_MIN_TOKENS) continue;

    // Only slice when needed
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

// Generate large content
const lines = [];
for (let i = 0; i < 20000; i++) {
    // Make sure we have enough tokens to trigger hashing often
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
console.log(`Original: ${(endOriginal - startOriginal).toFixed(2)}ms, found ${resOriginal.length} windows`);

const startOptimized = performance.now();
const resOptimized = extractWindowsOptimized(content, 'test.ts', 6);
const endOptimized = performance.now();
console.log(`Optimized: ${(endOptimized - startOptimized).toFixed(2)}ms, found ${resOptimized.length} windows`);

// Verify results match
if (resOriginal.length !== resOptimized.length) {
    console.error(`Mismatch in length! Original: ${resOriginal.length}, Optimized: ${resOptimized.length}`);
} else {
    // Check a few samples
    let mismatch = false;
    for(let i=0; i<resOriginal.length; i+=100) {
        if (resOriginal[i]?.hash !== resOptimized[i]?.hash || resOriginal[i]?.tokenCount !== resOptimized[i]?.tokenCount) {
             console.error('Mismatch in content at index ' + i);
             console.log('Original', resOriginal[i]);
             console.log('Optimized', resOptimized[i]);
             mismatch = true;
             break;
        }
    }
    if (!mismatch) console.log('Results match.');
}
