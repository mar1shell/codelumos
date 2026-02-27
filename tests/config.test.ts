import { describe, it, expect } from 'vitest';
import { mergeConfig, RcConfig } from '../src/config.js';
import { CliOptions } from '../src/types.js';

describe('mergeConfig', () => {
  const defaultCliOpts: CliOptions = {
    format: 'terminal',
    ignore: [],
    noColor: false,
    verbose: false,
    complexityThreshold: 10,
    duplicationMinLines: 6,
  };

  it('returns default CLI options when RC is empty and no flags are set', () => {
    const rc: RcConfig = {};
    const cliFlags = new Set<string>();

    const result = mergeConfig(defaultCliOpts, rc, cliFlags);

    expect(result).toEqual(defaultCliOpts);
  });

  it('uses RC values when no CLI flags are set', () => {
    const rc: RcConfig = {
      format: 'json',
      verbose: true,
      complexityThreshold: 20,
    };
    const cliFlags = new Set<string>();

    const result = mergeConfig(defaultCliOpts, rc, cliFlags);

    expect(result.format).toBe('json');
    expect(result.verbose).toBe(true);
    expect(result.complexityThreshold).toBe(20);
    // Should keep defaults for undefined RC values
    expect(result.duplicationMinLines).toBe(defaultCliOpts.duplicationMinLines);
  });

  it('prioritizes explicit CLI flags over RC values', () => {
    const rc: RcConfig = {
      format: 'json',
      verbose: true,
    };

    const cliOpts: CliOptions = {
      ...defaultCliOpts,
      format: 'html', // User provided --format html
      verbose: false, // User default or explicit flag? Logic depends on cliFlags set
    };

    const cliFlags = new Set<string>(['format']);

    const result = mergeConfig(cliOpts, rc, cliFlags);

    expect(result.format).toBe('html'); // CLI flag present, takes precedence over RC 'json'
    expect(result.verbose).toBe(true);  // CLI flag NOT present, takes from RC 'true'
  });

  it('handles optional fields correctly', () => {
    const rc: RcConfig = {
      output: 'report.json',
      minScore: 80,
    };
    const cliFlags = new Set<string>();

    const result = mergeConfig(defaultCliOpts, rc, cliFlags);

    expect(result.output).toBe('report.json');
    expect(result.minScore).toBe(80);
  });

  it('explicit CLI flags for optional fields override RC', () => {
    const rc: RcConfig = {
      output: 'report.json',
      minScore: 80,
    };
    const cliOpts: CliOptions = {
      ...defaultCliOpts,
      output: 'cli-output.txt',
      minScore: 90,
    };
    const cliFlags = new Set<string>(['output', 'minScore']);

    const result = mergeConfig(cliOpts, rc, cliFlags);

    expect(result.output).toBe('cli-output.txt');
    expect(result.minScore).toBe(90);
  });

  it('merges ignore arrays correctly (replacing, not concatenating)', () => {
    const rc: RcConfig = {
      ignore: ['node_modules'],
    };
    const cliOpts: CliOptions = {
      ...defaultCliOpts,
      ignore: ['dist'],
    };

    // Case 1: CLI flag set
    let cliFlags = new Set<string>(['ignore']);
    let result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.ignore).toEqual(['dist']);

    // Case 2: CLI flag NOT set
    cliFlags = new Set<string>();
    result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.ignore).toEqual(['node_modules']);
  });
});
