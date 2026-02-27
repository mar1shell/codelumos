
import { renderHtml } from './src/reporters/htmlReporter';
import { AuditReport } from './src/types';
import fs from 'fs';
import path from 'path';

const MOCK_REPORT: AuditReport = {
  timestamp: '2023-01-01T00:00:00.000Z',
  rootDir: '/test/project',
  durationMs: 123,
  loc: {
    files: [],
    byLanguage: [
        { language: 'TypeScript', files: 10, total: 1000, code: 800, blank: 100, comment: 100 },
        { language: 'JavaScript', files: 5, total: 500, code: 400, blank: 50, comment: 50 }
    ],
    totals: {
      files: 15,
      total: 1500,
      code: 1200,
      blank: 150,
      comment: 150,
    },
  },
  complexity: {
    files: [],
    projectAvg: 1.5,
    hotspots: [
        { path: 'src/bad.ts', language: 'TypeScript', functions: [], maxComplexity: 25, avgComplexity: 10 }
    ],
  },
  duplication: {
    blocks: [],
    duplicatedLines: 0,
    totalLines: 1500,
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
      complexity: 90,
      duplication: 100,
      deadCode: 100,
    },
    fileScores: [],
    worstFiles: [],
  },
};

const html = renderHtml(MOCK_REPORT);
fs.writeFileSync('report.html', html);
console.log('Report generated: report.html');
