import { describe, it, expect } from 'vitest';
import { renderJson } from '../../src/reporters/jsonReporter.js';
import type { AuditReport } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Mock Data
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

describe('jsonReporter', () => {
  it('serializes the report to a valid JSON string', () => {
    const json = renderJson(MOCK_REPORT);
    const parsed = JSON.parse(json);

    // Should match the original object structure
    expect(parsed).toEqual(JSON.parse(JSON.stringify(MOCK_REPORT)));
  });

  it('uses 2-space indentation', () => {
    const json = renderJson(MOCK_REPORT);

    // Check for indentation structure (2 spaces)
    // A simple check is to look for a line that starts with 2 spaces but not 4
    // or just check that it contains newlines and spaces
    expect(json).toContain('\n  "timestamp":');
    expect(json).toContain('\n  "loc": {');
    expect(json).toContain('\n    "totals": {');
  });

  it('handles empty/edge case values correctly', () => {
    const emptyReport = { ...MOCK_REPORT, loc: { ...MOCK_REPORT.loc, files: [] } };
    const json = renderJson(emptyReport);
    const parsed = JSON.parse(json);
    expect(parsed.loc.files).toEqual([]);
  });
});
