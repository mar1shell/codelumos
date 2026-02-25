import type {
  AuditReport,
  LocResult,
  ComplexityResult,
  DuplicationResult,
  DeadCodeResult,
  FileScore,
  ProjectScore,
  HealthGrade,
} from './types.js';

// ---------------------------------------------------------------------------
// Health Scoring
//
// Score: 0–100.  Grade thresholds:
//   A+  95–100
//   A   88–94
//   B+  80–87
//   B   70–79
//   C+  60–69
//   C   50–59
//   D   35–49
//   F   0–34
//
// Project score breakdown (weights sum to 100):
//   Comment coverage   20 pts  – target ≥ 20%
//   Complexity         30 pts  – target avg < 5, max per file < 10
//   Duplication        30 pts  – target < 3%
//   Dead code          20 pts  – target < 5%
// ---------------------------------------------------------------------------

export function toGrade(score: number): HealthGrade {
  if (score >= 95) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C+';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'F';
}

// ---------------------------------------------------------------------------
// Sub-scores (each returns 0–100)
// ---------------------------------------------------------------------------

/** Comment coverage score. Ideal ≥ 20 %. Penalises below 5 % heavily. */
function commentCoverageScore(loc: LocResult): number {
  const { code, comment } = loc.totals;
  if (code === 0) return 100;
  const pct = (comment / (code + comment)) * 100;
  if (pct >= 20) return 100;
  if (pct >= 10) return 70 + (pct - 10) * 3;
  if (pct >= 5) return 40 + (pct - 5) * 6;
  return Math.max(0, pct * 8);
}

/** Complexity score. Avg < 5 → 100. Penalises exponentially. */
function complexityScore(complexity: ComplexityResult): number {
  if (complexity.files.length === 0) return 100;
  const avg = complexity.projectAvg;
  if (avg <= 3) return 100;
  if (avg <= 5) return 90 - (avg - 3) * 5;
  if (avg <= 10) return 80 - (avg - 5) * 8;
  if (avg <= 20) return 40 - (avg - 10) * 2;
  return Math.max(0, 20 - avg);
}

/** Duplication score. < 3 % → 100. > 30 % → 0. */
function duplicationScore(dup: DuplicationResult): number {
  const rate = dup.duplicationRate;
  if (rate <= 3) return 100;
  if (rate <= 10) return 100 - (rate - 3) * 7;
  if (rate <= 20) return 51 - (rate - 10) * 3;
  if (rate <= 30) return 21 - (rate - 20) * 2;
  return 0;
}

/** Dead code score. < 5 % → 100. > 50 % → 0. */
function deadCodeScore(dead: DeadCodeResult): number {
  if (dead.totalExports === 0) return 100;
  const rate = dead.deadRatio;
  if (rate <= 5) return 100;
  if (rate <= 20) return 100 - (rate - 5) * 3;
  if (rate <= 50) return 55 - (rate - 20) * 1.5;
  return Math.max(0, 10 - rate);
}

// ---------------------------------------------------------------------------
// Per-file scoring
// ---------------------------------------------------------------------------

function scoreFile(
  relativePath: string,
  locInfo: { comment: number; code: number } | undefined,
  maxComplexity: number,
  isDuplicated: boolean,
): FileScore {
  const penalties: string[] = [];
  let score = 100;

  // Comment coverage
  const code = locInfo?.code ?? 0;
  const comment = locInfo?.comment ?? 0;
  if (code > 0) {
    const pct = (comment / (code + comment)) * 100;
    if (pct < 5) {
      penalties.push('Very low comment coverage');
      score -= 20;
    } else if (pct < 10) {
      penalties.push('Low comment coverage');
      score -= 10;
    }
  }

  // Complexity
  if (maxComplexity >= 20) {
    penalties.push(`Critical complexity (${maxComplexity})`);
    score -= 30;
  } else if (maxComplexity >= 10) {
    penalties.push(`High complexity (${maxComplexity})`);
    score -= 15;
  } else if (maxComplexity >= 7) {
    penalties.push(`Moderate complexity (${maxComplexity})`);
    score -= 5;
  }

  // Duplication
  if (isDuplicated) {
    penalties.push('Contains duplicated blocks');
    score -= 10;
  }

  const clamped = Math.max(0, Math.min(100, score));

  return { path: relativePath, score: clamped, grade: toGrade(clamped), penalties };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeScore(
  loc: LocResult,
  complexity: ComplexityResult,
  duplication: DuplicationResult,
  deadCode: DeadCodeResult,
): ProjectScore {
  // Sub-scores
  const commentPts = commentCoverageScore(loc);
  const complexPts = complexityScore(complexity);
  const dupPts = duplicationScore(duplication);
  const deadPts = deadCodeScore(deadCode);

  // Weighted project score
  const score = Math.round(
    commentPts * 0.2 + complexPts * 0.3 + dupPts * 0.3 + deadPts * 0.2,
  );

  // All three result sets key files by relativePath (not absolute path).
  // We normalise here explicitly so any future change in upstream data
  // doesn't silently break the per-file lookups.
  const normPath = (p: string): string => p.replace(/\\/g, '/');

  // Build a fast lookup for loc per file (keyed by normalised relative path)
  const locByFile = new Map(
    loc.files.map((f) => [normPath(f.path), { code: f.code, comment: f.comment }]),
  );

  // Build a fast lookup for max complexity per file (keyed by normalised relative path)
  const complexByFile = new Map(
    complexity.files.map((f) => [normPath(f.path), f.maxComplexity]),
  );

  // Build a set of files that have at least one duplicated block
  const duplicatedFiles = new Set<string>();
  for (const block of duplication.blocks) {
    for (const occ of block.occurrences) {
      duplicatedFiles.add(normPath(occ.path));
    }
  }

  // Score every file that appears in at least one result
  const allPaths = new Set([
    ...loc.files.map((f) => normPath(f.path)),
    ...complexity.files.map((f) => normPath(f.path)),
  ]);

  const fileScores: FileScore[] = [];
  for (const p of allPaths) {
    fileScores.push(
      scoreFile(
        p,
        locByFile.get(p),
        complexByFile.get(p) ?? 0,
        duplicatedFiles.has(p),
      ),
    );
  }

  fileScores.sort((a, b) => a.score - b.score);

  const worstFiles = fileScores.slice(0, 10);

  return {
    score: Math.max(0, Math.min(100, score)),
    grade: toGrade(score),
    breakdown: {
      commentCoverage: Math.round(commentPts),
      complexity: Math.round(complexPts),
      duplication: Math.round(dupPts),
      deadCode: Math.round(deadPts),
    },
    fileScores,
    worstFiles,
  };
}

/** Convenience: attach score to a full report */
export function attachScore(report: Omit<AuditReport, 'score'>): AuditReport {
  const score = computeScore(
    report.loc,
    report.complexity,
    report.duplication,
    report.deadCode,
  );
  return { ...report, score };
}
