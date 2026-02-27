import { describe, it, expect } from 'vitest';
import { renderHtml } from '../../src/reporters/htmlReporter.js';
import type { AuditReport } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Mock Data (reused from jsonReporter.test.ts)
// ---------------------------------------------------------------------------

const MOCK_REPORT: AuditReport = {
  timestamp: '2023-01-01T00:00:00.000Z',
  rootDir: '/test/project',
  durationMs: 123,
  loc: {
    files: [],
    byLanguage: [],
    totals: {
      files: 5,
      total: 100,
      code: 80,
      blank: 10,
      comment: 10,
    },
  },
  complexity: {
    files: [],
    projectAvg: 1.5,
    hotspots: [],
  },
  duplication: {
    blocks: [],
    duplicatedLines: 0,
    totalLines: 100,
    duplicationRate: 0,
  },
  deadCode: {
    deadExports: [],
    totalExports: 10,
    deadRatio: 0,
  },
  dependencies: {
    manifests: [],
    totalDependencies: 0,
    totalDevDependencies: 0,
    missingLockFiles: [],
  },
  score: {
    score: 95,
    grade: 'A+',
    breakdown: {
      commentCoverage: 100,
      complexity: 100,
      duplication: 100,
      deadCode: 100,
    },
    fileScores: [],
    worstFiles: [],
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('htmlReporter', () => {
  it('generates an HTML string', () => {
    const html = renderHtml(MOCK_REPORT);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Code Audit — project');
    expect(html).toContain('Health Score');
  });

  it('includes print styles', () => {
    const html = renderHtml(MOCK_REPORT);

    // Verify our changes are present
    expect(html).toContain('@media print');
    expect(html).toContain('break-inside:avoid');
  });
});
