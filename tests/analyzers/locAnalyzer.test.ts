import { describe, it, expect } from 'vitest';
import { classifyLines } from '../../src/analyzers/locAnalyzer.js';

describe('classifyLines', () => {
  it('counts blank lines correctly', () => {
    // 'const x = 1;\n\n\nconst y = 2;\n' splits into 5 lines:
    // ['const x = 1;', '', '', 'const y = 2;', '']
    // → 3 blank lines (two mid-string + one trailing), 2 code lines, total 5
    const content = 'const x = 1;\n\n\nconst y = 2;\n';
    const result = classifyLines(content, 'TypeScript');
    expect(result.blank).toBe(3);
    expect(result.total).toBe(5);
    expect(result.code).toBe(2);
  });

  it('counts TypeScript single-line comments', () => {
    const content = [
      '// This is a comment',
      'const x = 1;',
      '// Another comment',
      'const y = 2;',
    ].join('\n');
    const result = classifyLines(content, 'TypeScript');
    expect(result.comment).toBe(2);
    expect(result.code).toBe(2);
  });

  it('counts TypeScript block comments', () => {
    const content = [
      '/**',
      ' * A block comment',
      ' * spanning multiple lines',
      ' */',
      'function foo() {',
      '  return 1;',
      '}',
    ].join('\n');
    const result = classifyLines(content, 'TypeScript');
    expect(result.comment).toBe(4);
    expect(result.code).toBe(3);
  });

  it('counts Python hash comments', () => {
    const content = [
      '# A python comment',
      'def foo():',
      '    # inline',
      '    return 1',
    ].join('\n');
    const result = classifyLines(content, 'Python');
    expect(result.comment).toBe(2);
    expect(result.code).toBe(2);
  });

  it('handles empty content', () => {
    const result = classifyLines('', 'TypeScript');
    expect(result.total).toBe(1); // split('') gives ['']
    expect(result.blank).toBe(1);
    expect(result.code).toBe(0);
  });

  it('counts totals correctly', () => {
    const content = '// comment\nconst x = 1;\n\nconst y = 2;\n';
    const result = classifyLines(content, 'TypeScript');
    expect(result.total).toBe(result.code + result.blank + result.comment);
  });
});
