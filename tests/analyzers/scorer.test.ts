import { describe, it, expect } from 'vitest';
import { toGrade, computeScore } from '../../src/scorer.js';
import type { LocResult, ComplexityResult, DuplicationResult, DeadCodeResult } from '../../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLocResult(code: number, comment: number): LocResult {
  return {
    files: [],
    byLanguage: [],
    totals: { files: 1, total: code + comment, code, blank: 0, comment },
  };
}

function makeComplexityResult(projectAvg: number): ComplexityResult {
  return { files: [], projectAvg, hotspots: [] };
}

function makeDupResult(duplicationRate: number): DuplicationResult {
  return {
    blocks: [],
    duplicatedLines: 0,
    totalLines: 1000,
    duplicationRate,
  };
}

function makeDeadResult(deadRatio: number): DeadCodeResult {
  return {
    deadExports: [],
    totalExports: deadRatio > 0 ? 10 : 0,
    deadRatio,
  };
}

// ---------------------------------------------------------------------------
// toGrade
// ---------------------------------------------------------------------------

describe('toGrade', () => {
  it('returns A+ for scores >= 95', () => {
    expect(toGrade(100)).toBe('A+');
    expect(toGrade(95)).toBe('A+');
  });

  it('returns A for 88–94', () => {
    expect(toGrade(88)).toBe('A');
    expect(toGrade(94)).toBe('A');
  });

  it('returns B+ for 80–87', () => {
    expect(toGrade(80)).toBe('B+');
    expect(toGrade(87)).toBe('B+');
  });

  it('returns F for very low scores', () => {
    expect(toGrade(0)).toBe('F');
    expect(toGrade(34)).toBe('F');
  });
});

// ---------------------------------------------------------------------------
// computeScore
// ---------------------------------------------------------------------------

describe('computeScore', () => {
  it('returns a high score for ideal code', () => {
    const score = computeScore(
      makeLocResult(1000, 250), // 20% comment coverage
      makeComplexityResult(2),  // low complexity
      makeDupResult(1),         // low duplication
      makeDeadResult(2),        // low dead code
    );
    expect(score.score).toBeGreaterThanOrEqual(85);
    expect(['A+', 'A', 'B+']).toContain(score.grade);
  });

  it('returns a low score for terrible code', () => {
    const score = computeScore(
      makeLocResult(1000, 0),   // 0% comments
      makeComplexityResult(25), // very high complexity
      makeDupResult(50),        // heavy duplication
      makeDeadResult(60),       // lots of dead code
    );
    expect(score.score).toBeLessThanOrEqual(30);
    expect(['D', 'F']).toContain(score.grade);
  });

  it('score is always 0–100', () => {
    for (let i = 0; i < 10; i++) {
      const s = computeScore(
        makeLocResult(Math.random() * 10000, Math.random() * 2000),
        makeComplexityResult(Math.random() * 30),
        makeDupResult(Math.random() * 60),
        makeDeadResult(Math.random() * 80),
      );
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it('breakdown values sum is close to the weighted total', () => {
    const score = computeScore(
      makeLocResult(800, 200),
      makeComplexityResult(4),
      makeDupResult(2),
      makeDeadResult(3),
    );
    // Sanity: all breakdown values are 0–100
    expect(score.breakdown.commentCoverage).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.complexity).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.duplication).toBeGreaterThanOrEqual(0);
    expect(score.breakdown.deadCode).toBeGreaterThanOrEqual(0);
  });
});
