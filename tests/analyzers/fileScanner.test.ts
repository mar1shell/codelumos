import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { scanDirectory } from '../../src/scanner/fileScanner.js';

const SIMPLE_FIXTURE = resolve(import.meta.dirname ?? '', '../fixtures/simple');
const COMPLEX_FIXTURE = resolve(import.meta.dirname ?? '', '../fixtures/complex');

describe('scanDirectory', () => {
  it('finds files in the simple fixture', async () => {
    const result = await scanDirectory(SIMPLE_FIXTURE);
    expect(result.files.length).toBeGreaterThan(0);
  });

  it('assigns correct languages', async () => {
    const result = await scanDirectory(SIMPLE_FIXTURE);
    const byLang = new Map(result.files.map((f) => [f.relativePath.split('/').pop(), f.language]));
    expect(byLang.get('math.ts')).toBe('TypeScript');
    expect(byLang.get('utils.py')).toBe('Python');
  });

  it('respects ignore patterns', async () => {
    const result = await scanDirectory(SIMPLE_FIXTURE, { ignore: ['*.py'] });
    const hasPy = result.files.some((f) => f.relativePath.endsWith('.py'));
    expect(hasPy).toBe(false);
  });

  it('populates sizeBytes', async () => {
    const result = await scanDirectory(SIMPLE_FIXTURE);
    for (const file of result.files) {
      expect(file.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('finds files in the complex fixture', async () => {
    const result = await scanDirectory(COMPLEX_FIXTURE);
    expect(result.files.length).toBeGreaterThanOrEqual(3);
  });
});
