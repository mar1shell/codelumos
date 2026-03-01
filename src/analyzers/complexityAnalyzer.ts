import { readFileContent } from '../scanner/fileScanner.js';
import type {
  ScannedFile,
  ComplexityResult,
  ComplexityFileResult,
  ComplexityFunctionResult,
} from '../types.js';

// ---------------------------------------------------------------------------
// Cyclomatic complexity estimators per language
//
// Complexity = 1 + number of branching points (if, else if, for, while,
// case, catch, &&, ||, ??, ternary, etc.)
// ---------------------------------------------------------------------------

interface FunctionMatch {
  name: string;
  line: number;
  bodyStart: number;
  bodyEnd: number;
}

// ---------------------------------------------------------------------------
// AST-based JS / TS function extraction + complexity counting
// ---------------------------------------------------------------------------

// Node types that add +1 to cyclomatic complexity
const BRANCH_NODE_TYPES = new Set([
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchCase',
  'CatchClause',
  'ConditionalExpression', // ternary
  'LogicalExpression',     // && || ??
]);

// Lazily loaded parser — avoids paying the import cost for non-JS/TS projects
let _parse: ((code: string, opts: Record<string, unknown>) => unknown) | undefined;

async function getTsParser(): Promise<(code: string, opts: Record<string, unknown>) => unknown> {
  if (_parse !== undefined) return _parse;
  const mod = await import('@typescript-eslint/typescript-estree');
  _parse = mod.parse as unknown as (code: string, opts: Record<string, unknown>) => unknown;
  return _parse;
}

interface AstNode {
  type: string;
  loc?: { start: { line: number }; end: { line: number } };
  [key: string]: unknown;
}

/** Walk an AST node, calling `visit` for every node */
function walk(node: unknown, visit: (n: AstNode) => void): void {
  if (node === null || node === undefined || typeof node !== 'object') return;
  const n = node as AstNode;
  if (typeof n.type !== 'string') return;
  visit(n);
  for (const key of Object.keys(n)) {
    const val = n[key];
    if (Array.isArray(val)) {
      for (const child of val) walk(child, visit);
    } else if (val !== null && typeof val === 'object') {
      walk(val as AstNode, visit);
    }
  }
}

/** Node types that represent the start of a new function scope */
const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

interface FunctionScope {
  name: string;
  line: number;
  complexity: number;
}

function extractFunctionsFromAst(ast: AstNode): FunctionScope[] {
  const results: FunctionScope[] = [];

  // We need a parent-pointer walk; instead, collect function nodes first
  const functionNodes: Array<{ node: AstNode; name: string }> = [];

  // First pass: collect all function node positions
  walk(ast, (node) => {
    if (!FUNCTION_TYPES.has(node.type)) return;

    let name = '<anonymous>';

    if (node.type === 'FunctionDeclaration') {
      const id = node['id'] as AstNode | undefined;
      if (id?.type === 'Identifier') name = id['name'] as string ?? name;
    } else if (node.type === 'FunctionExpression') {
      const id = node['id'] as AstNode | undefined;
      if (id?.type === 'Identifier') name = id['name'] as string ?? name;
    }
    // ArrowFunctionExpression: we'll try to infer name from parent in second pass

    functionNodes.push({ node, name });
  });

  // Better name inference: look for variable declarators / property assignments
  // We walk again and look for assignments to arrow functions
  walk(ast, (node) => {
    if (node.type !== 'VariableDeclarator') return;
    const init = node['init'] as AstNode | undefined;
    if (init === undefined || init === null) return;
    if (!FUNCTION_TYPES.has(init.type)) return;
    const id = node['id'] as AstNode | undefined;
    if (id?.type === 'Identifier') {
      const name = id['name'] as string;
      // Find the matching function node entry and update its name
      const entry = functionNodes.find(
        (e) => e.node === init && e.name === '<anonymous>',
      );
      if (entry !== undefined) entry.name = name;
    }
  });

  // Also handle method definitions
  walk(ast, (node) => {
    if (node.type !== 'MethodDefinition' && node.type !== 'Property') return;
    const value = node['value'] as AstNode | undefined;
    if (value === undefined || value === null) return;
    if (!FUNCTION_TYPES.has(value.type)) return;
    const key = node['key'] as AstNode | undefined;
    if (key?.type === 'Identifier') {
      const name = key['name'] as string;
      const entry = functionNodes.find(
        (e) => e.node === value && e.name === '<anonymous>',
      );
      if (entry !== undefined) entry.name = name;
    }
  });

  // Second pass: count complexity for each function body
  for (const { node, name } of functionNodes) {
    const line = node.loc?.start.line ?? 0;
    let complexity = 1; // base complexity

    const body = node['body'] as AstNode | undefined;
    if (body === undefined) {
      // Arrow function with expression body: no branching possible in body
      results.push({ name, line, complexity });
      continue;
    }

    // Count branch nodes inside this function body (but not nested functions)
    const nestedFunctionBodies = new Set<AstNode>();
    walk(body, (inner) => {
      if (FUNCTION_TYPES.has(inner.type) && inner !== node) {
        const innerBody = inner['body'] as AstNode | undefined;
        if (innerBody !== undefined) nestedFunctionBodies.add(innerBody);
      }
    });

    walk(body, (inner) => {
      // Skip nodes inside nested function bodies
      if (nestedFunctionBodies.has(inner)) return;
      if (!BRANCH_NODE_TYPES.has(inner.type)) return;

      // LogicalExpression: && || ?? each add 1
      // SwitchCase: only count non-default cases (default has no test)
      if (inner.type === 'SwitchCase') {
        if (inner['test'] !== null) complexity++;
      } else if (inner.type === 'LogicalExpression') {
        complexity++;
      } else {
        complexity++;
      }
    });

    // Skip anonymous tiny arrow functions (e.g. array callbacks) unless they
    // have at least one branch themselves — reduces noise
    if (name === '<anonymous>' && complexity === 1) continue;

    results.push({ name, line, complexity });
  }

  return results;
}

async function extractJsFunctionsAst(
  content: string,
  language: string,
): Promise<FunctionScope[]> {
  try {
    const parse = await getTsParser();
    const ast = parse(content, {
      jsx: language === 'TypeScript' || language === 'JavaScript',
      errorRecovery: true,
      range: false,
      loc: true,
    }) as AstNode;
    return extractFunctionsFromAst(ast);
  } catch {
    // Parse failure — fall back to empty (don't crash the whole audit)
    return [];
  }
}

// ---------------------------------------------------------------------------
// Regex-based complexity counter (kept for non-JS/TS languages)
// ---------------------------------------------------------------------------

const BRANCH_PATTERNS = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /\?\?/g,
  /\?\s+[^:]+\s*:/g, // ternary
  /&&/g,
  /\|\|/g,
];

function countBranches(code: string): number {
  let count = 0;
  for (const pattern of BRANCH_PATTERNS) {
    pattern.lastIndex = 0;
    while (pattern.exec(code) !== null) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Python function extraction
// ---------------------------------------------------------------------------

const PYTHON_DEF_PATTERN = /^(\s*)(?:async\s+)?def\s+(\w+)\s*\(/;

function extractPythonFunctions(content: string): FunctionMatch[] {
  const lines = content.split('\n');
  const functions: FunctionMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = PYTHON_DEF_PATTERN.exec(line);
    if (match?.[2] !== undefined) {
      const baseIndent = (match[1] ?? '').length;
      let bodyEnd = i;

      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j] ?? '';
        if (nextLine.trim() === '') continue;
        const indentMatch = /^(\s*)/.exec(nextLine);
        const currentIndent = (indentMatch?.[1] ?? '').length;
        if (currentIndent <= baseIndent) {
          bodyEnd = j - 1;
          break;
        }
        bodyEnd = j;
      }

      functions.push({ name: match[2], line: i + 1, bodyStart: i, bodyEnd });
    }
  }

  return functions;
}

// ---------------------------------------------------------------------------
// Go function extraction
// ---------------------------------------------------------------------------

const GO_FUNC_PATTERN = /^func\s+(?:\([^)]*\)\s+)?(\w+)\s*\(/;

function extractGoFunctions(content: string): FunctionMatch[] {
  const lines = content.split('\n');
  const functions: FunctionMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = GO_FUNC_PATTERN.exec(line);
    if (match?.[1] !== undefined) {
      let depth = 0;
      let bodyEnd = i;
      let found = false;

      for (let j = i; j < Math.min(i + 500, lines.length); j++) {
        const l = lines[j] ?? '';
        for (const ch of l) {
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0 && j > i) {
              bodyEnd = j;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }

      if (found) {
        functions.push({ name: match[1], line: i + 1, bodyStart: i, bodyEnd });
      }
    }
  }

  return functions;
}

// ---------------------------------------------------------------------------
// C-family function extraction (C, C++, Java, C#, Kotlin, Swift, Scala)
// ---------------------------------------------------------------------------

// Matches: optional modifiers, return type, name, parameters, optional {
const C_FUNC_PATTERN =
  /^(?:(?:public|private|protected|static|final|override|virtual|abstract|async|inline|extern|const|fun|func|def)\s+)*[\w<>[\],\s*&]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{?/;

function extractGenericCFunctions(content: string): FunctionMatch[] {
  const lines = content.split('\n');
  const functions: FunctionMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Must have a function-signature-like pattern and open brace
    if (!trimmed.includes('(') || !trimmed.includes(')')) continue;

    const match = C_FUNC_PATTERN.exec(trimmed);
    if (match?.[1] === undefined) continue;

    const name = match[1];

    // Skip common false-positives (control flow keywords, type declarations)
    if (/^(if|for|while|switch|catch|return|new|class|interface|enum|import|using|package)$/.test(name)) {
      continue;
    }

    // Find the opening brace (may be on the same or next line)
    let braceStart = -1;
    for (let k = i; k < Math.min(i + 3, lines.length); k++) {
      if ((lines[k] ?? '').includes('{')) {
        braceStart = k;
        break;
      }
    }
    if (braceStart === -1) continue;

    // Find matching closing brace
    let depth = 0;
    let bodyEnd = braceStart;
    let found = false;

    for (let j = braceStart; j < Math.min(braceStart + 500, lines.length); j++) {
      const l = lines[j] ?? '';
      for (const ch of l) {
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0 && j > braceStart) {
            bodyEnd = j;
            found = true;
            break;
          }
        }
      }
      if (found) break;
    }

    if (found) {
      functions.push({ name, line: i + 1, bodyStart: braceStart, bodyEnd });
    }
  }

  return functions;
}

// ---------------------------------------------------------------------------
// Ruby function extraction
// ---------------------------------------------------------------------------

const RUBY_DEF_PATTERN = /^(\s*)def\s+(?:self\.)?(\w+)/;

function extractRubyFunctions(content: string): FunctionMatch[] {
  const lines = content.split('\n');
  const functions: FunctionMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const match = RUBY_DEF_PATTERN.exec(line);
    if (match?.[2] === undefined) continue;

    const baseIndent = (match[1] ?? '').length;
    let bodyEnd = i;
    let depth = 0;

    for (let j = i; j < lines.length; j++) {
      const l = lines[j] ?? '';
      if (/\bdo\b|\bdef\b|\bclass\b|\bmodule\b|\bif\b|\bunless\b|\bwhile\b|\buntil\b|\bfor\b|\bbegin\b/.test(l)) {
        depth++;
      }
      if (/\bend\b/.test(l)) {
        depth--;
        if (depth <= 0) {
          bodyEnd = j;
          break;
        }
      }
      bodyEnd = j;
    }

    // Only include if indent level makes sense (top-level or nested methods)
    if ((match[1] ?? '').length <= baseIndent + 2) {
      functions.push({ name: match[2], line: i + 1, bodyStart: i, bodyEnd });
    }
  }

  return functions;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const SUPPORTED_LANGUAGES = new Set([
  'TypeScript',
  'JavaScript',
  'Python',
  'Go',
  'C',
  'C++',
  'Java',
  'C#',
  'Kotlin',
  'Swift',
  'Scala',
  'Ruby',
]);

const DEFAULT_HOTSPOT_THRESHOLD = 10;

export async function analyzeComplexity(
  files: ScannedFile[],
  hotspotThreshold = DEFAULT_HOTSPOT_THRESHOLD,
  contentCache?: Map<string, string>,
): Promise<ComplexityResult> {
  const fileResults: ComplexityFileResult[] = [];

  for (const file of files) {
    if (!SUPPORTED_LANGUAGES.has(file.language)) continue;

    const content = await readFileContent(file.path, contentCache);
    if (content === null) continue;

    let functionResults: ComplexityFunctionResult[] = [];

    if (file.language === 'TypeScript' || file.language === 'JavaScript') {
      // AST-based analysis
      const fns = await extractJsFunctionsAst(content, file.language);
      functionResults = fns.map((fn) => ({
        name: fn.name,
        line: fn.line,
        complexity: fn.complexity,
      }));
    } else if (file.language === 'Python') {
      const lines = content.split('\n');
      for (const fn of extractPythonFunctions(content)) {
        const body = lines.slice(fn.bodyStart, fn.bodyEnd + 1).join('\n');
        functionResults.push({ name: fn.name, line: fn.line, complexity: 1 + countBranches(body) });
      }
    } else if (file.language === 'Go') {
      const lines = content.split('\n');
      for (const fn of extractGoFunctions(content)) {
        const body = lines.slice(fn.bodyStart, fn.bodyEnd + 1).join('\n');
        functionResults.push({ name: fn.name, line: fn.line, complexity: 1 + countBranches(body) });
      }
    } else if (file.language === 'Ruby') {
      const lines = content.split('\n');
      for (const fn of extractRubyFunctions(content)) {
        const body = lines.slice(fn.bodyStart, fn.bodyEnd + 1).join('\n');
        functionResults.push({ name: fn.name, line: fn.line, complexity: 1 + countBranches(body) });
      }
    } else {
      // C, C++, Java, C#, Kotlin, Swift, Scala
      const lines = content.split('\n');
      for (const fn of extractGenericCFunctions(content)) {
        const body = lines.slice(fn.bodyStart, fn.bodyEnd + 1).join('\n');
        functionResults.push({ name: fn.name, line: fn.line, complexity: 1 + countBranches(body) });
      }
    }

    if (functionResults.length === 0) continue;

    const maxComplexity = Math.max(...functionResults.map((f) => f.complexity));
    const avgComplexity =
      functionResults.reduce((s, f) => s + f.complexity, 0) / functionResults.length;

    fileResults.push({
      path: file.relativePath,
      language: file.language,
      functions: functionResults,
      maxComplexity,
      avgComplexity: Math.round(avgComplexity * 10) / 10,
    });
  }

  const projectAvg =
    fileResults.length === 0
      ? 0
      : Math.round(
          (fileResults.reduce((s, f) => s + f.avgComplexity, 0) / fileResults.length) * 10,
        ) / 10;

  const hotspots = fileResults
    .filter((f) => f.maxComplexity >= hotspotThreshold)
    .sort((a, b) => b.maxComplexity - a.maxComplexity);

  return { files: fileResults, projectAvg, hotspots };
}

/** Exported for testing */
export { countBranches, extractPythonFunctions };

/**
 * Exported for testing — wraps the async AST extractor in a sync-style
 * interface by calling extractFunctionsFromAst on a pre-parsed AST.
 */
export { extractFunctionsFromAst };

// Legacy export kept for existing tests that import extractJsFunctions
export async function extractJsFunctions(
  content: string,
  language: string,
): Promise<FunctionMatch[]> {
  const fns = await extractJsFunctionsAst(content, language);
  return fns.map((fn) => ({ name: fn.name, line: fn.line, bodyStart: fn.line - 1, bodyEnd: fn.line - 1 }));
}
