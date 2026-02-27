import { describe, it, expect } from 'vitest';
import { resolveSpecifier } from '../../src/analyzers/deadCodeAnalyzer.js';
import { resolve } from 'node:path';

describe('resolveSpecifier', () => {
  const fromFile = resolve('/src/analyzers/testFile.ts');

  it('should return null for npm packages', () => {
    expect(resolveSpecifier('react', fromFile)).toBeNull();
    expect(resolveSpecifier('lodash/fp', fromFile)).toBeNull();
    expect(resolveSpecifier('@types/node', fromFile)).toBeNull();
  });

  it('should resolve explicit relative paths with extensions', () => {
    const specifier = './utils.js';
    const expected = resolve('/src/analyzers/utils.js');
    expect(resolveSpecifier(specifier, fromFile)).toBe(expected);
  });

  it('should resolve parent directory paths', () => {
    const specifier = '../shared/helper.ts';
    const expected = resolve('/src/shared/helper.ts');
    expect(resolveSpecifier(specifier, fromFile)).toBe(expected);
  });

  it('should append .ts extension if missing', () => {
    const specifier = './utils';
    // The current implementation defaults to .ts if no extension is found
    const expected = resolve('/src/analyzers/utils.ts');
    expect(resolveSpecifier(specifier, fromFile)).toBe(expected);
  });

  it('should resolve exact match if it looks like a file with extension', () => {
    const specifier = './style.css';
    const expected = resolve('/src/analyzers/style.css');
    expect(resolveSpecifier(specifier, fromFile)).toBe(expected);
  });

  it('should return null for absolute paths (treated as non-relative)', () => {
    // resolveSpecifier checks for startsWith('.')
    expect(resolveSpecifier('/absolute/path', fromFile)).toBeNull();
  });
});
