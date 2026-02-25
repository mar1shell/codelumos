import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { CliOptions } from './types.js';

// ---------------------------------------------------------------------------
// .codelumos.json config file support
//
// Walks up the directory tree from `startDir` looking for a
// `.codelumos.json` file.  Any options found there are used as defaults;
// explicit CLI flags always take precedence.
// ---------------------------------------------------------------------------

/** Subset of CliOptions that can be specified in the rc file */
export interface RcConfig {
  format?: CliOptions['format'];
  ignore?: string[];
  minScore?: number;
  noColor?: boolean;
  verbose?: boolean;
  complexityThreshold?: number;
  duplicationMinLines?: number;
  output?: string;
}

const RC_FILENAME = '.codelumos.json';

/**
 * Walk up from `startDir` until a `.codelumos.json` is found or we reach
 * the filesystem root.  Returns the parsed config, or `{}` if none found.
 */
export function findAndLoadRc(startDir: string): RcConfig {
  let dir = resolve(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = resolve(dir, RC_FILENAME);
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as RcConfig;
        }
      } catch {
        // Malformed JSON — skip silently
      }
      break;
    }

    const parent = dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  return {};
}

/**
 * Merge rc defaults with explicit CLI opts.
 * CLI values always win; rc values fill in only when the CLI left the field
 * at its default / undefined.
 *
 * @param cliOpts   Options as parsed from CLI arguments (may contain undefined for optional fields)
  * @param rc        Config loaded from .codelumos.json
 * @param cliFlags  Set of flag names that were explicitly provided on the CLI
 */
export function mergeConfig(
  cliOpts: CliOptions,
  rc: RcConfig,
  cliFlags: Set<string>,
): CliOptions {
  const merged: CliOptions = {
    format:              cliFlags.has('format')              ? cliOpts.format              : (rc.format              ?? cliOpts.format),
    ignore:              cliFlags.has('ignore')              ? cliOpts.ignore              : (rc.ignore              ?? cliOpts.ignore),
    noColor:             cliFlags.has('noColor')             ? cliOpts.noColor             : (rc.noColor             ?? cliOpts.noColor),
    verbose:             cliFlags.has('verbose')             ? cliOpts.verbose             : (rc.verbose             ?? cliOpts.verbose),
    complexityThreshold: cliFlags.has('complexityThreshold') ? cliOpts.complexityThreshold : (rc.complexityThreshold ?? cliOpts.complexityThreshold),
    duplicationMinLines: cliFlags.has('duplicationMinLines') ? cliOpts.duplicationMinLines : (rc.duplicationMinLines ?? cliOpts.duplicationMinLines),
  };

  // Optional fields — only set if defined
  const output = cliFlags.has('output') ? cliOpts.output : (rc.output ?? cliOpts.output);
  if (output !== undefined) merged.output = output;

  const minScore = cliFlags.has('minScore') ? cliOpts.minScore : (rc.minScore ?? cliOpts.minScore);
  if (minScore !== undefined) merged.minScore = minScore;

  return merged;
}
