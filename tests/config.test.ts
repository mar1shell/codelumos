import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';
import { findAndLoadRc, mergeConfig, type RcConfig } from '../src/config.js';
import type { CliOptions } from '../src/types.js';

// Mock fs module
const mockFs = {
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
};

vi.mock('node:fs', () => ({
  existsSync: (path: string) => mockFs.existsSync(path),
  readFileSync: (path: string, encoding: string) => mockFs.readFileSync(path, encoding),
}));

describe('findAndLoadRc', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty object if no config file found', () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = findAndLoadRc('/some/path');
    expect(result).toEqual({});
  });

  it('loads config from the start directory', () => {
    const startDir = resolve('/app');
    const configPath = resolve(startDir, '.codelumos.json');
    const configContent = JSON.stringify({ ignore: ['node_modules'] });

    mockFs.existsSync.mockImplementation((path) => path === configPath);
    mockFs.readFileSync.mockImplementation((path) => {
      if (path === configPath) return configContent;
      throw new Error('File not found');
    });

    const result = findAndLoadRc(startDir);
    expect(result).toEqual({ ignore: ['node_modules'] });
  });

  it('walks up the directory tree to find config', () => {
    const startDir = resolve('/app/subdir/deep');
    const rootDir = resolve('/app');
    const configPath = resolve(rootDir, '.codelumos.json');
    const configContent = JSON.stringify({ verbose: true });

    mockFs.existsSync.mockImplementation((path) => path === configPath);
    mockFs.readFileSync.mockReturnValue(configContent);

    const result = findAndLoadRc(startDir);
    expect(result).toEqual({ verbose: true });
  });

  it('stops at filesystem root if no config found', () => {
     // Mock existsSync to always return false so it hits the break condition at root
     mockFs.existsSync.mockReturnValue(false);
     const result = findAndLoadRc('/some/path');
     expect(result).toEqual({});
  });

  it('handles malformed JSON gracefully', () => {
    const startDir = resolve('/app');
    const configPath = resolve(startDir, '.codelumos.json');

    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('{ invalid json ');

    const result = findAndLoadRc(startDir);
    expect(result).toEqual({});
  });
});

describe('mergeConfig', () => {
  const defaults: CliOptions = {
    format: 'terminal',
    ignore: [],
    noColor: false,
    verbose: false,
    complexityThreshold: 10,
    duplicationMinLines: 5,
  };

  it('uses CLI flags when provided, ignoring RC', () => {
    const cliOpts = { ...defaults, verbose: true };
    const rc: RcConfig = { verbose: false };
    const cliFlags = new Set(['verbose']);

    const result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.verbose).toBe(true);
  });

  it('uses RC value when CLI flag is not provided', () => {
    const cliOpts = { ...defaults, verbose: false };
    const rc: RcConfig = { verbose: true };
    const cliFlags = new Set<string>();

    const result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.verbose).toBe(true);
  });

  it('uses CLI default when RC value is missing', () => {
    const cliOpts = { ...defaults, verbose: false };
    const rc: RcConfig = {};
    const cliFlags = new Set<string>();

    const result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.verbose).toBe(false);
  });

  it('correctly merges optional fields like output', () => {
    const cliOpts = { ...defaults, output: undefined };
    const rc: RcConfig = { output: 'report.json' };
    const cliFlags = new Set<string>();

    const result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.output).toBe('report.json');
  });

  it('correctly merges optional fields like minScore', () => {
    const cliOpts = { ...defaults, minScore: undefined };
    const rc: RcConfig = { minScore: 80 };
    const cliFlags = new Set<string>();

    const result = mergeConfig(cliOpts, rc, cliFlags);
    expect(result.minScore).toBe(80);
  });
});
