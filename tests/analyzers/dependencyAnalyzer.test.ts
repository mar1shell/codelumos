import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeDependencies } from '../../src/analyzers/dependencyAnalyzer.js';
import { readFileContent } from '../../src/scanner/fileScanner.js';
import type { ScannedFile } from '../../src/types.js';

// Mock the fileScanner module
vi.mock('../../src/scanner/fileScanner.js', () => ({
  readFileContent: vi.fn(),
}));

describe('analyzeDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles invalid JSON in package.json gracefully', async () => {
    // Mock readFileContent to return malformed JSON
    vi.mocked(readFileContent).mockResolvedValue('invalid json content');

    const file: ScannedFile = {
      path: '/abs/path/to/package.json',
      relativePath: 'package.json',
      language: 'JSON',
      sizeBytes: 100,
    };

    const result = await analyzeDependencies([file]);

    // Should return no manifests because parsing failed
    expect(result.manifests).toHaveLength(0);
    expect(readFileContent).toHaveBeenCalledWith(file.path);
  });

  it('parses valid package.json correctly', async () => {
    const validJson = JSON.stringify({
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    });

    vi.mocked(readFileContent).mockResolvedValue(validJson);

    const file: ScannedFile = {
      path: '/abs/path/to/package.json',
      relativePath: 'package.json',
      language: 'JSON',
      sizeBytes: 100,
    };

    const result = await analyzeDependencies([file]);

    expect(result.manifests).toHaveLength(1);
    expect(result.manifests[0].dependencies).toContain('react');
    expect(result.manifests[0].devDependencies).toContain('typescript');
  });

  it('handles null content from readFileContent', async () => {
      vi.mocked(readFileContent).mockResolvedValue(null);

      const file: ScannedFile = {
        path: '/abs/path/to/package.json',
        relativePath: 'package.json',
        language: 'JSON',
        sizeBytes: 100,
      };

      const result = await analyzeDependencies([file]);
      expect(result.manifests).toHaveLength(0);
  });
});
