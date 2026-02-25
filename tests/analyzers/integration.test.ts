import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { scanDirectory } from '../../src/scanner/fileScanner.js';
import { analyzeLocForFiles } from '../../src/analyzers/locAnalyzer.js';
import { analyzeComplexity } from '../../src/analyzers/complexityAnalyzer.js';
import { analyzeDuplication } from '../../src/analyzers/duplicationAnalyzer.js';
import { analyzeDeadCode } from '../../src/analyzers/deadCodeAnalyzer.js';
import { analyzeDependencies } from '../../src/analyzers/dependencyAnalyzer.js';

const SIMPLE = resolve(import.meta.dirname ?? '', '../fixtures/simple');
const COMPLEX = resolve(import.meta.dirname ?? '', '../fixtures/complex');

// ---------------------------------------------------------------------------
// LOC integration
// ---------------------------------------------------------------------------

describe('analyzeLocForFiles (integration)', () => {
  it('counts lines across simple fixture', async () => {
    const { files } = await scanDirectory(SIMPLE);
    const result = await analyzeLocForFiles(files);
    expect(result.totals.total).toBeGreaterThan(0);
    expect(result.totals.files).toBe(files.length);
    expect(result.totals.total).toBe(
      result.totals.code + result.totals.blank + result.totals.comment,
    );
  });

  it('detects comments in TypeScript file', async () => {
    const { files } = await scanDirectory(SIMPLE);
    const result = await analyzeLocForFiles(files);
    const tsFiles = result.files.filter((f) => f.language === 'TypeScript');
    const totalComment = tsFiles.reduce((s, f) => s + f.comment, 0);
    expect(totalComment).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Complexity integration
// ---------------------------------------------------------------------------

describe('analyzeComplexity (integration)', () => {
  it('detects high complexity in processor.ts', async () => {
    const { files } = await scanDirectory(COMPLEX);
    const result = await analyzeComplexity(files, 5);
    expect(result.hotspots.length).toBeGreaterThan(0);
    const hotFile = result.hotspots.find((h) => h.path.includes('processor'));
    expect(hotFile).toBeDefined();
    expect(hotFile?.maxComplexity).toBeGreaterThan(5);
  });

  it('returns 0 project avg when no functions found', async () => {
    // Pass an empty file list
    const result = await analyzeComplexity([], 10);
    expect(result.projectAvg).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Duplication integration
// ---------------------------------------------------------------------------

describe('analyzeDuplication (integration)', () => {
  it('detects the duplicated block in fileA and fileB', async () => {
    const { files } = await scanDirectory(COMPLEX);
    const result = await analyzeDuplication(files, 5);
    expect(result.blocks.length).toBeGreaterThan(0);
    // At least one block should reference both fileA and fileB
    const xFileBlock = result.blocks.find((b) => {
      const paths = b.occurrences.map((o) => o.path);
      return paths.some((p) => p.includes('fileA')) && paths.some((p) => p.includes('fileB'));
    });
    expect(xFileBlock).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Dead code integration
// ---------------------------------------------------------------------------

describe('analyzeDeadCode (integration)', () => {
  it('runs without errors on the simple fixture', async () => {
    const { files } = await scanDirectory(SIMPLE);
    const result = await analyzeDeadCode(files);
    expect(typeof result.totalExports).toBe('number');
    expect(typeof result.deadRatio).toBe('number');
    expect(result.deadRatio).toBeGreaterThanOrEqual(0);
    expect(result.deadRatio).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// Dependency integration
// ---------------------------------------------------------------------------

describe('analyzeDependencies (integration)', () => {
  it('parses package.json from simple fixture', async () => {
    const { files } = await scanDirectory(SIMPLE);
    const result = await analyzeDependencies(files);
    const npmManifest = result.manifests.find((m) => m.kind === 'npm');
    expect(npmManifest).toBeDefined();
    expect(npmManifest?.dependencies.length).toBeGreaterThanOrEqual(2);
    expect(npmManifest?.devDependencies.length).toBeGreaterThanOrEqual(2);
  });
});
