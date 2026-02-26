import { describe, it, expect } from 'vitest';
import { countBranches, extractJsFunctions } from '../../src/analyzers/complexityAnalyzer.js';

describe('countBranches', () => {
  it('returns 0 for code with no branches', () => {
    const code = 'const x = 1;\nconst y = 2;\nreturn x + y;';
    expect(countBranches(code)).toBe(0);
  });

  it('counts if statements', () => {
    const code = 'if (a) { return 1; }\nif (b) { return 2; }';
    expect(countBranches(code)).toBe(2);
  });

  it('counts for loops', () => {
    const code = 'for (let i = 0; i < 10; i++) { doSomething(); }';
    expect(countBranches(code)).toBe(1);
  });

  it('counts logical operators', () => {
    const code = 'if (a && b || c) { return 1; }';
    // if + && + ||  = 3
    expect(countBranches(code)).toBe(3);
  });

  it('counts ternary operators', () => {
    const code = 'const x = a ? 1 : 2;';
    expect(countBranches(code)).toBeGreaterThanOrEqual(1);
  });

  it('counts while loops', () => {
    const code = 'while (x > 0) { x--; }';
    expect(countBranches(code)).toBe(1);
  });

  it('counts catch blocks', () => {
    const code = 'try { doThing(); } catch (e) { handleError(e); }';
    expect(countBranches(code)).toBe(1);
  });
});

describe('extractJsFunctions', () => {
  it('extracts a function declaration', async () => {
    const code = [
      'export function hello(name: string): string {',
      '  return `Hello ${name}`;',
      '}',
    ].join('\n');
    const fns = await extractJsFunctions(code, 'TypeScript');
    expect(fns.length).toBeGreaterThanOrEqual(1);
    expect(fns[0]?.name).toBe('hello');
    expect(fns[0]?.line).toBe(1);
  });

  it('extracts multiple functions', async () => {
    const code = [
      'function foo() {',
      '  return 1;',
      '}',
      '',
      'function bar() {',
      '  return 2;',
      '}',
    ].join('\n');
    const fns = await extractJsFunctions(code, 'JavaScript');
    expect(fns.length).toBeGreaterThanOrEqual(2);
    const names = fns.map((f) => f.name);
    expect(names).toContain('foo');
    expect(names).toContain('bar');
  });

  it('returns empty for files with no functions', async () => {
    const code = 'const x = 1;\nconst y = 2;\n';
    const fns = await extractJsFunctions(code, 'TypeScript');
    expect(fns.length).toBe(0);
  });

  it('handles invalid syntax by returning an empty array', async () => {
    const code = 'function invalid( {';
    const fns = await extractJsFunctions(code, 'JavaScript');
    expect(fns).toEqual([]);
  });
});
