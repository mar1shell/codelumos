// Simple benchmark script using standard performance.now()
const { performance } = require('node:perf_hooks');

// Define the regex as it is in the source code
const STAR_IMPORT_RE = /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g;

// Create a large sample content with many imports to make the benchmark meaningful
const generateContent = (lines) => {
  const imports = [];
  for (let i = 0; i < lines; i++) {
    if (i % 10 === 0) {
      imports.push(`import * as Lib${i} from './lib/module${i}';`);
    } else {
      imports.push(`const x${i} = ${i};`);
    }
  }
  return imports.join('\n');
};

const content = generateContent(10000); // 10,000 lines
const ITERATIONS = 1000;

// The unoptimized implementation (as described in the task issue)
function extractStarImportedPathsUnoptimized(content) {
  const paths = new Set();
  // Issue: Redundant regex compilation inside the function
  const re = new RegExp(STAR_IMPORT_RE.source, 'g');
  let match;
  while ((match = re.exec(content)) !== null) {
    const specifier = match[1] ?? '';
    if (specifier) paths.add(specifier);
  }
  return paths;
}

// The optimized implementation (as currently in the codebase)
function extractStarImportedPathsOptimized(content) {
  const paths = new Set();
  // Optimization: Reuse the global regex instance
  STAR_IMPORT_RE.lastIndex = 0;
  let match;
  while ((match = STAR_IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1] ?? '';
    if (specifier) paths.add(specifier);
  }
  return paths;
}

console.log(`Running benchmark with ${content.length} bytes of content over ${ITERATIONS} iterations...`);

const startUnoptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  extractStarImportedPathsUnoptimized(content);
}
const endUnoptimized = performance.now();
const timeUnoptimized = endUnoptimized - startUnoptimized;

const startOptimized = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  extractStarImportedPathsOptimized(content);
}
const endOptimized = performance.now();
const timeOptimized = endOptimized - startOptimized;

console.log(`Unoptimized: ${timeUnoptimized.toFixed(2)}ms`);
console.log(`Optimized:   ${timeOptimized.toFixed(2)}ms`);
console.log(`Difference:  ${(timeUnoptimized - timeOptimized).toFixed(2)}ms`);
console.log(`Improvement: ${(timeUnoptimized / timeOptimized).toFixed(2)}x`);
