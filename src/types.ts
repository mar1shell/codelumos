// ---------------------------------------------------------------------------
// Core domain types for codeaudit
// ---------------------------------------------------------------------------

/** A single file found by the scanner */
export interface ScannedFile {
  /** Absolute path to the file */
  path: string;
  /** Path relative to the scanned root */
  relativePath: string;
  /** Detected language name (e.g. "TypeScript", "Python") */
  language: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Raw file content (populated lazily by analyzers) */
  content?: string;
}

// ---------------------------------------------------------------------------
// LOC
// ---------------------------------------------------------------------------

export interface LocFileResult {
  path: string;
  language: string;
  total: number;
  code: number;
  blank: number;
  comment: number;
}

export interface LocLanguageSummary {
  language: string;
  files: number;
  total: number;
  code: number;
  blank: number;
  comment: number;
}

export interface LocResult {
  files: LocFileResult[];
  byLanguage: LocLanguageSummary[];
  totals: {
    files: number;
    total: number;
    code: number;
    blank: number;
    comment: number;
  };
}

// ---------------------------------------------------------------------------
// Complexity
// ---------------------------------------------------------------------------

export interface ComplexityFunctionResult {
  name: string;
  line: number;
  complexity: number;
}

export interface ComplexityFileResult {
  path: string;
  language: string;
  functions: ComplexityFunctionResult[];
  /** Max complexity across all functions in this file */
  maxComplexity: number;
  /** Average complexity across all functions */
  avgComplexity: number;
}

export interface ComplexityResult {
  files: ComplexityFileResult[];
  /** Project-wide average complexity */
  projectAvg: number;
  /** Files whose max complexity exceeds the warning threshold */
  hotspots: ComplexityFileResult[];
}

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

export interface DuplicateBlock {
  /** Hash identifying the duplicated content */
  hash: string;
  /** Number of lines in the block */
  lines: number;
  /** All occurrences of this block */
  occurrences: Array<{ path: string; startLine: number }>;
}

export interface DuplicationResult {
  blocks: DuplicateBlock[];
  /** Total duplicated lines */
  duplicatedLines: number;
  /** Total lines analyzed */
  totalLines: number;
  /** Duplication percentage 0–100 */
  duplicationRate: number;
}

// ---------------------------------------------------------------------------
// Dead Code
// ---------------------------------------------------------------------------

export interface DeadExport {
  path: string;
  symbol: string;
  line: number;
  exportType: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum' | 'unknown';
}

export interface DeadCodeResult {
  deadExports: DeadExport[];
  totalExports: number;
  deadRatio: number;
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type DependencyKind = 'npm' | 'pip' | 'go' | 'unknown';

export interface DependencyManifest {
  kind: DependencyKind;
  path: string;
  hasLockFile: boolean;
  dependencies: string[];
  devDependencies: string[];
}

export interface DependencyResult {
  manifests: DependencyManifest[];
  totalDependencies: number;
  totalDevDependencies: number;
  missingLockFiles: string[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export type HealthGrade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

export interface FileScore {
  path: string;
  score: number;
  grade: HealthGrade;
  penalties: string[];
}

export interface ProjectScore {
  score: number;
  grade: HealthGrade;
  breakdown: {
    commentCoverage: number;
    complexity: number;
    duplication: number;
    deadCode: number;
  };
  fileScores: FileScore[];
  /** Files with lowest scores */
  worstFiles: FileScore[];
}

// ---------------------------------------------------------------------------
// Full audit report
// ---------------------------------------------------------------------------

export interface AuditReport {
  /** ISO timestamp */
  timestamp: string;
  /** Resolved root directory */
  rootDir: string;
  /** Duration in milliseconds */
  durationMs: number;
  loc: LocResult;
  complexity: ComplexityResult;
  duplication: DuplicationResult;
  deadCode: DeadCodeResult;
  dependencies: DependencyResult;
  score: ProjectScore;
}

// ---------------------------------------------------------------------------
// CLI options
// ---------------------------------------------------------------------------

export type OutputFormat = 'terminal' | 'json' | 'html';

export interface CliOptions {
  format: OutputFormat;
  output?: string;
  ignore: string[];
  minScore?: number;
  noColor: boolean;
  verbose: boolean;
  /** Complexity threshold above which a function is flagged */
  complexityThreshold: number;
  /** Minimum block size (lines) to consider for duplication */
  duplicationMinLines: number;
}
