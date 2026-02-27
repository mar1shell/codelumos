import { bench, describe } from 'vitest';

// Define the regex as it is in the source code
const STAR_IMPORT_RE = /import\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g;

// Create a large sample content with many imports to make the benchmark meaningful
const generateContent = (lines: number) => {
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

const content = generateContent(100);

// The unoptimized implementation (as described in the task issue)
function extractStarImportedPathsUnoptimized(content: string): Set<string> {
  const paths = new Set<string>();
  // Issue: Redundant regex compilation inside the function
  const re = new RegExp(STAR_IMPORT_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const specifier = match[1] ?? '';
    // Mock resolveSpecifier logic for benchmark purity
    if (specifier) paths.add(specifier);
  }
  return paths;
}

// The optimized implementation (as currently in the codebase)
function extractStarImportedPathsOptimized(content: string): Set<string> {
  const paths = new Set<string>();
  // Optimization: Reuse the global regex instance
  STAR_IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = STAR_IMPORT_RE.exec(content)) !== null) {
    const specifier = match[1] ?? '';
    if (specifier) paths.add(specifier);
  }
  return paths;
}

describe('Star Import Regex Performance', () => {
  bench('Unoptimized (New RegExp per call)', () => {
    extractStarImportedPathsUnoptimized(content);
  });

  bench('Optimized (Global RegExp reuse)', () => {
    extractStarImportedPathsOptimized(content);
  });
});
