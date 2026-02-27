import { describe, it, expect } from 'vitest';
import { renderTerminal } from '../../src/reporters/terminalReporter.js';
import type { AuditReport, CliOptions } from '../../src/types.js';

const MOCK_REPORT: AuditReport = {
  timestamp: '2023-01-01T00:00:00.000Z',
  rootDir: '/test/project',
  durationMs: 123,
  loc: {
    files: [
      { path: '/test/project/src/index.ts', language: 'TypeScript', total: 50, code: 40, blank: 5, comment: 5 },
      { path: '/test/project/src/utils.ts', language: 'TypeScript', total: 30, code: 25, blank: 2, comment: 3 },
    ],
    byLanguage: [
      { language: 'TypeScript', files: 2, total: 80, code: 65, blank: 7, comment: 8 },
    ],
    totals: {
      files: 2,
      total: 80,
      code: 65,
      blank: 7,
      comment: 8,
    },
  },
  complexity: {
    files: [],
    projectAvg: 1.5,
    hotspots: [
      {
        path: '/test/project/src/complex.ts',
        language: 'TypeScript',
        maxComplexity: 25,
        avgComplexity: 5,
        functions: [
          { name: 'complexFunc', line: 10, complexity: 25 },
          { name: 'simpleFunc', line: 50, complexity: 2 },
        ],
      },
    ],
  },
  duplication: {
    blocks: [
      {
        hash: 'abc',
        lines: 10,
        occurrences: [
          { path: '/test/project/src/a.ts', startLine: 10 },
          { path: '/test/project/src/b.ts', startLine: 10 },
        ],
      },
    ],
    duplicatedLines: 20,
    totalLines: 100,
    duplicationRate: 20,
  },
  deadCode: {
    deadExports: [
      { path: '/test/project/src/dead.ts', symbol: 'unusedVar', line: 5, exportType: 'variable' },
    ],
    totalExports: 10,
    deadRatio: 10,
  },
  dependencies: {
    manifests: [
      {
        kind: 'npm',
        path: '/test/project/package.json',
        hasLockFile: false,
        dependencies: ['react'],
        devDependencies: ['typescript'],
      },
    ],
    totalDependencies: 1,
    totalDevDependencies: 1,
    missingLockFiles: ['/test/project/package.json'],
  },
  score: {
    score: 85,
    grade: 'B',
    breakdown: {
      commentCoverage: 80,
      complexity: 70,
      duplication: 90,
      deadCode: 95,
    },
    fileScores: [],
    worstFiles: [
      { path: '/test/project/src/bad.ts', score: 50, grade: 'F', penalties: ['High Complexity'] },
    ],
  },
};

const DEFAULT_OPTIONS: CliOptions = {
  format: 'terminal',
  ignore: [],
  noColor: true,
  verbose: false,
  complexityThreshold: 10,
  duplicationMinLines: 5,
};

describe('terminalReporter', () => {
  it('renders the report structure correctly', () => {
    const output = renderTerminal(MOCK_REPORT, DEFAULT_OPTIONS);

    expect(output).toContain('Code Audit Report');
    expect(output).toContain('Health Score');
    expect(output).toContain('Lines of Code');
    expect(output).toContain('Complexity');
    expect(output).toContain('Duplication');
    expect(output).toContain('Dead Code');
    expect(output).toContain('Dependencies');
    expect(output).toContain('Files Needing Attention'); // worst files
  });

  it('renders stats correctly', () => {
    const output = renderTerminal(MOCK_REPORT, DEFAULT_OPTIONS);
    expect(output).toContain('85/100'); // score
    expect(output).toContain('B'); // grade
    expect(output).toContain('TypeScript'); // language
  });

  it('renders complexity hotspots', () => {
    const output = renderTerminal(MOCK_REPORT, DEFAULT_OPTIONS);
    expect(output).toContain('src/complex.ts');
    expect(output).toContain('25'); // max complexity
  });

  it('renders duplication details', () => {
    const output = renderTerminal(MOCK_REPORT, DEFAULT_OPTIONS);
    expect(output).toContain('20% of 100 total lines');
  });

  it('renders dependency warnings', () => {
    const output = renderTerminal(MOCK_REPORT, DEFAULT_OPTIONS);
    expect(output).toContain('Missing lock files');
    expect(output).toContain('/test/project/package.json');
  });

  it('renders detailed info in verbose mode', () => {
    const output = renderTerminal(MOCK_REPORT, { ...DEFAULT_OPTIONS, verbose: true });

    // Complexity details
    expect(output).toContain('Top complex functions:');
    expect(output).toContain('complexFunc');

    // Duplication details
    expect(output).toContain('10-line block');
    expect(output).toContain('src/a.ts:10');

    // Dead code details
    expect(output).toContain('unusedVar');
  });

  it('hides detailed info in non-verbose mode', () => {
    const output = renderTerminal(MOCK_REPORT, { ...DEFAULT_OPTIONS, verbose: false });

    expect(output).not.toContain('Top complex functions:');
    expect(output).not.toContain('complexFunc');
    expect(output).not.toContain('10-line block');
    expect(output).not.toContain('unusedVar');
  });
});
