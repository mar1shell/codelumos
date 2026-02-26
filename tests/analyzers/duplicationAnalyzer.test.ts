
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeDuplication } from '../../src/analyzers/duplicationAnalyzer.js';
import type { ScannedFile } from '../../src/types.js';

// Mock readFileContent to avoid hitting the disk
const mockContentCache = new Map<string, string>();

vi.mock('../../src/scanner/fileScanner.js', () => ({
  readFileContent: async (path: string, cache?: Map<string, string>): Promise<string | null> => {
    // If cache is provided, use it
    if (cache && cache.has(path)) return cache.get(path) ?? null;
    // Otherwise, check our mock cache
    return Promise.resolve(mockContentCache.get(path) ?? null);
  }
}));

describe('analyzeDuplication', () => {
  beforeEach(() => {
    mockContentCache.clear();
  });

  const createMockFile = (path: string, content: string): ScannedFile => {
    mockContentCache.set(path, content);
    return {
      path,
      relativePath: path,
      language: 'TypeScript',
      sizeBytes: content.length,
    } as ScannedFile;
  };

  it('should detect exact duplicates', async () => {
    // Each line needs enough tokens to sum up to >= 20 for a 6-line window
    // "console.log('line 1', 'extra', 'tokens', 'here');" -> ~5 tokens
    const block = [
      "console.log('line 1', 'extra', 'tokens', 'here');",
      "console.log('line 2', 'extra', 'tokens', 'here');",
      "console.log('line 3', 'extra', 'tokens', 'here');",
      "console.log('line 4', 'extra', 'tokens', 'here');",
      "console.log('line 5', 'extra', 'tokens', 'here');",
      "console.log('line 6', 'extra', 'tokens', 'here');",
    ].join('\n');

    const content = block + '\n' + block;
    const file1 = createMockFile('file1.ts', content);

    const result = await analyzeDuplication([file1], 6, mockContentCache);

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.blocks[0].occurrences.length).toBe(2);
    expect(result.duplicatedLines).toBe(6);
  });

  it('should ignore windows with too few tokens', async () => {
    const sparseBlock = [
      'a', 'b', 'c', 'd', 'e', 'f'
    ].join('\n');

    const content = sparseBlock + '\n' + sparseBlock;
    const file1 = createMockFile('sparse.ts', content);

    const result = await analyzeDuplication([file1], 6, mockContentCache);
    expect(result.blocks.length).toBe(0);
  });

  it('should handle whitespace and comments normalization', async () => {
     // Ensure enough tokens
     const block1 = [
       "function test(arg1, arg2, arg3) { // comment",
       "  return true && false || true;",
       "}",
       "console.log('end', 'of', 'test');",
       "console.log('end2', 'of', 'test');",
       "console.log('end3', 'of', 'test');",
     ].join('\n');

     const block2 = [
       "function test(arg1, arg2, arg3) {   ",
       "  return true && false || true;",
       "}",
       "console.log('end', 'of', 'test');",
       "console.log('end2', 'of', 'test');",
       "console.log('end3', 'of', 'test');",
     ].join('\n');

     const file1 = createMockFile('norm1.ts', block1);
     const file2 = createMockFile('norm2.ts', block2);

     const result = await analyzeDuplication([file1, file2], 6, mockContentCache);
     expect(result.blocks.length).toBe(1);
     expect(result.blocks[0].occurrences.length).toBe(2);
  });

  it('should not detect duplication if lines < minLines', async () => {
    const shortBlock = `
      console.log('1');
      console.log('2');
    `;
    const file1 = createMockFile('short.ts', shortBlock + '\n' + shortBlock);

    const result = await analyzeDuplication([file1], 5, mockContentCache);
    expect(result.blocks.length).toBe(0);
  });

  it('should correctly handle sliding window token counting', async () => {
      // MIN_TOKENS = 20
      const manyTokens = 'a b c d e f g h i j k l m n o p q r s t'; // 20 tokens
      const fewTokens = 'x'; // 1 token

      const lines: string[] = [];
      // 1-6
      for(let i=0; i<6; i++) lines.push(manyTokens);
      // 7-12
      for(let i=0; i<6; i++) lines.push(fewTokens);
      // 13-18
      for(let i=0; i<6; i++) lines.push(manyTokens);

      const content = lines.join('\n');
      const file = createMockFile('sliding.ts', content);

      const result = await analyzeDuplication([file], 6, mockContentCache);

      expect(result.blocks.length).toBe(1);

      const occurrences = result.blocks[0].occurrences;
      expect(occurrences.length).toBe(2);

      const startLines = occurrences.map(o => o.startLine).sort((a,b) => a-b);
      expect(startLines).toEqual([1, 13]);
  });
});
