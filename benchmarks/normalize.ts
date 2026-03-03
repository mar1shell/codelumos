import { performance } from 'node:perf_hooks';

function normalizeLineOriginal(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\/\/.*$/, '')   // strip JS/TS/Go single-line comments
    .replace(/#.*$/, '')       // strip Python/Shell comments
    .trim();
}

function normalizeLineOptimized(line: string): string {
  let normalized = line.trim();
  if (normalized.length === 0) return '';
  if (normalized.includes('//')) normalized = normalized.replace(/\/\/.*$/, '');
  if (normalized.includes('#')) normalized = normalized.replace(/#.*$/, '');
  return normalized.replace(/\s+/g, ' ').trim();
}

const lines: string[] = [];
for (let i = 0; i < 200000; i++) {
    lines.push(`  const variable${i} = "some value" + ${i};  `);
    lines.push(`  if (variable${i}) { console.log('test', variable${i}); }  `);
    lines.push(`  function doSomething${i}() { return ${i} * 2; }  `);
    lines.push(`  // this is a comment ${i}  `);
    lines.push(`  # this is another comment ${i}  `);
}

console.log('Running benchmark...');

const startOriginal = performance.now();
let countOrig = 0;
for (const line of lines) {
  if (normalizeLineOriginal(line).length > 0) countOrig++;
}
const endOriginal = performance.now();
console.log(`Original: ${(endOriginal - startOriginal).toFixed(2)}ms`);

const startOptimized = performance.now();
let countOpt = 0;
for (const line of lines) {
  if (normalizeLineOptimized(line).length > 0) countOpt++;
}
const endOptimized = performance.now();
console.log(`Optimized: ${(endOptimized - startOptimized).toFixed(2)}ms`);

console.log(`Improvement: ${((endOriginal - startOriginal - (endOptimized - startOptimized)) / (endOriginal - startOriginal) * 100).toFixed(2)}% faster`);
