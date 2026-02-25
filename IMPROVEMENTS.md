# codelumos — Improvement Tasks for Agent

Below is a prioritised list of concrete improvements to make to the codelumos project. Each task includes the exact file(s) to change, the problem, and the required fix.

---

## 1. Fix path mismatch in scorer (silent bug — incorrect per-file scores)

**Files:** `src/scorer.ts`, verify against `src/analyzers/locAnalyzer.ts`, `src/analyzers/complexityAnalyzer.ts`, `src/analyzers/duplicationAnalyzer.ts`

**Problem:**

- `locByFile` is keyed by `file.path` (absolute path from `LocFileResult.path`).
- `complexByFile` is keyed by `file.path` from `ComplexityFileResult.path`, which is set to `file.relativePath` inside `complexityAnalyzer.ts`.
- `duplicatedFiles` is built from `block.occurrences[].path`, which is also relative (set in `duplicationAnalyzer.ts`).
- The `allPaths` set iterates `loc.files.map(f => f.path)` (absolute) and `complexity.files.map(f => f.path)` (relative), causing mixed keys that never match each other.
- Result: duplication penalties are **never applied** to any file, and complexity lookups silently return 0 for most files.

**Fix:**

1. Audit every analyzer to confirm whether `FileResult.path` is set to `file.path` (absolute) or `file.relativePath`. Standardise **all** of them to use `file.relativePath` (relative) as the key in their result objects.
2. In `locAnalyzer.ts`, ensure `LocFileResult.path` is set to `file.relativePath`, not `file.path`.
3. In `scorer.ts`, confirm all three Maps (`locByFile`, `complexByFile`, `duplicatedFiles`) use the same key type (relative path) and that `allPaths` iterates consistent keys.

---

## 2. Replace regex-based complexity analysis with an AST parser

**File:** `src/analyzers/complexityAnalyzer.ts`

**Problem:**

- Brace counting to find function boundaries breaks on template literals and strings containing `{` or `}`.
- Single-expression arrow functions (no braces) are silently skipped.
- The ternary pattern `/\?\s+[^:]+\s*:/g` is too broad and matches TypeScript optional types, object shorthand, etc., causing false positives.
- The `BRANCH_PATTERNS` approach double-counts `&&` and `||` inside already-counted `if` conditions.

**Fix:**

1. Install `@typescript-eslint/typescript-estree` as a dependency.
2. Rewrite `extractJsFunctions` and `countBranches` (for TS/JS) to:
   - Parse the file with `parse(content, { jsx: true, loc: true })`.
   - Walk the AST (using a simple recursive visitor) to find `FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, and `MethodDefinition` nodes.
   - For each function node, count branching nodes within its subtree: `IfStatement`, `ForStatement`, `ForInStatement`, `ForOfStatement`, `WhileStatement`, `DoWhileStatement`, `SwitchCase`, `CatchClause`, `LogicalExpression` (where `operator` is `&&`, `||`, or `??`), `ConditionalExpression`.
   - Each counts as +1; the function base is 1.
3. Keep the existing Python regex approach (it is adequate for Python) but remove the brace-counting fallback for JS/TS entirely.
4. Wrap the AST parse in a try/catch so a single unparseable file does not abort the entire analysis.

---

## 3. Fix dead code detection — resolve imports by path, not just by name

**File:** `src/analyzers/deadCodeAnalyzer.ts`

**Problem:**

- Symbols are matched purely by name across all files. If two files export `formatDate`, importing one marks both as used.
- Star imports (`import * as utils`) are not tracked — any consumer using barrel imports causes all exports from the barrel to appear dead.
- `import type { ... }` is correctly stripped of the `type` keyword by the regex, but the type keyword in imports like `import type Foo from` is not handled for default imports.

**Fix:**

1. Track exports as `{ filePath: string; symbol: string }` tuples.
2. In `extractImportedSymbols`, also extract the **module specifier** from each import statement. Return a `Set<string>` of `resolvedAbsolutePath:symbolName` strings.
3. For each import, resolve the specifier relative to the importing file's directory (handle `.js` extensions mapping to `.ts` source, bare index, etc.).
4. Match exported symbols as `absoluteExportFilePath:symbolName` against the import set.
5. Add star-import tracking: if any file does `import * as X from './foo'`, mark all exports from `./foo` as used.
6. Fix default import handling: the pattern `import\s+(\w+)\s+from` currently captures the keyword `type` when processing `import type Foo from`. Add a negative lookbehind or filter out `type` as a captured name.

---

## 4. Inject version from package.json at build time

**Files:** `tsup.config.ts`, `src/cli.ts`

**Problem:**
`src/cli.ts` has `const VERSION = '1.0.0'` hardcoded. The comment says "injected at build time by tsup" but `tsup.config.ts` has no `define` block, so the version is always `1.0.0`.

**Fix:**

1. In `tsup.config.ts`, add a `define` block:

   ```ts
   import pkg from "./package.json" assert { type: "json" };

   export default defineConfig({
     // ...existing config...
     define: {
       __VERSION__: JSON.stringify(pkg.version),
     },
   });
   ```

2. In `src/cli.ts`, replace:
   ```ts
   const VERSION = "1.0.0";
   ```
   with:
   ```ts
   declare const __VERSION__: string;
   const VERSION = __VERSION__;
   ```

---

## 5. Add a shared file content cache to avoid redundant disk reads

**Files:** `src/scanner/fileScanner.ts`, all files in `src/analyzers/`

**Problem:**
Each of the 5 analyzers independently calls `readFileContent(file.path)` per file. A project with 500 files performs up to 2,500 disk reads sequentially. The analyses already run in `Promise.all`, but each still re-reads every file independently.

**Fix:**

1. In `fileScanner.ts`, add an exported function:
   ```ts
   export async function preloadContents(
     files: ScannedFile[],
   ): Promise<Map<string, string>> {
     const entries = await Promise.all(
       files.map(async (f) => {
         const content = await readFileContent(f.path);
         return [f.path, content] as const;
       }),
     );
     return new Map(
       entries.filter((e): e is [string, string] => e[1] !== null),
     );
   }
   ```
2. Update the signature of each analyzer to accept an optional `contentCache: Map<string, string>` parameter. When provided, look up the cache before calling `readFileContent`.
3. In `src/cli.ts`, call `preloadContents(files)` once after scanning, then pass the cache to all 5 `Promise.all` analyzer calls.

---

## 6. Fix the LOC block-comment end detection regex bug

**File:** `src/analyzers/locAnalyzer.ts`

**Problem:**
In `classifyLines`, the code checks for block comment end with:

```ts
if (!syntax.blockEnd.test(line.replace(syntax.blockStart.source, ''))) {
```

`syntax.blockStart` is a `RegExp` object. Calling `.source` on it and passing it to `String.replace()` means it is treated as a **literal string**, not a regex. For patterns like `/\/\*/` the `.source` is `\/\*` which as a literal string will never be found in the line. The `inBlock` flag is therefore never cleared within the same line, causing subsequent code lines to be misclassified as comments.

**Fix:**
Replace:

```ts
if (!syntax.blockEnd.test(line.replace(syntax.blockStart.source, ""))) {
  inBlock = true;
}
```

with:

```ts
if (!syntax.blockEnd.test(line.replace(syntax.blockStart, ""))) {
  inBlock = true;
}
```

(`String.replace` accepts a `RegExp` directly as its first argument.)

---

## 7. Fix redundant dynamic import in `isBinaryFile`

**File:** `src/scanner/fileScanner.ts`

**Problem:**
`isBinaryFile` does:

```ts
const fd = await import("node:fs/promises").then((m) => m.open(filePath, "r"));
```

`node:fs/promises` is already statically imported at the top of the file as `import { readFile, stat } from 'node:fs/promises'`. The dynamic re-import is redundant and adds unnecessary overhead on every binary-check call.

**Fix:**
Add `open` to the top-level static import:

```ts
import { readFile, stat, open } from "node:fs/promises";
```

Then replace the dynamic import inside `isBinaryFile` with a direct call to `open(filePath, 'r')`.

---

## 8. Document the silent JSON fallback when `--output` is used with `--format terminal`

**File:** `src/cli.ts`

**Problem:**
When `--output <file>` is combined with `--format terminal` (or no `--format`), the code silently writes JSON to the output file instead of terminal output. This is surprising and undocumented.

**Fix (option A — simplest):** Write the terminal render (ANSI-stripped) to the file when `--format terminal` and `--output` are both set, same as other formats.

Replace the block:

```ts
if (opts.output !== undefined) {
  const outPath = resolve(opts.output);
  await writeFile(
    outPath,
    opts.format === 'terminal' ? renderJson(report) : output,
    'utf8',
  );
```

with:

```ts
if (opts.output !== undefined) {
  const outPath = resolve(opts.output);
  const fileContent =
    opts.format === 'terminal'
      ? renderTerminal(report, { ...opts, noColor: true }) ?? renderJson(report)
      : output;
  await writeFile(outPath, fileContent, 'utf8');
```

Note: this requires `renderTerminal` to return a `string` instead of writing directly to `process.stdout`. Refactor `terminalReporter.ts` to return the rendered string and let the caller decide where to write it.

---

## 9. Add config file support (`.codelumos.json`)

**Files:** new file `src/config.ts`, updated `src/cli.ts`

**Problem:**
All options must be passed as CLI flags every time. There is no way to commit per-project defaults (e.g., ignore patterns, thresholds, minimum score) to the repository.

**Fix:**

1. Create `src/config.ts` that:
   - Looks for `.codelumos.json` in the target directory and each parent up to `/`.
   - Parses it and validates it against the `CliOptions` shape (ignore unknown keys).
   - Returns a partial `CliOptions` to be merged with CLI flags (CLI flags take precedence).
2. In `cli.ts`, load the config file before building `opts` and deep-merge it under CLI flags.
3. Document the supported keys in the package README.

Example `.codelumos.json`:

```json
{
  "ignore": ["tests/fixtures/**", "vendor/**"],
  "complexityThreshold": 8,
  "duplicationMinLines": 5,
  "minScore": 75
}
```

---

## 10. Expand language coverage for complexity analysis

**File:** `src/analyzers/complexityAnalyzer.ts`

**Problem:**
Complexity analysis only runs on TypeScript, JavaScript, Python, and Go. LOC analysis supports Rust, Swift, Kotlin, C, C++, C#, Java, Scala, PHP, Ruby, and Shell. Users see LOC data for those languages but complexity silently shows nothing, which is confusing.

**Fix:**

1. For C, C++, C#, Java, Kotlin, Scala, and Swift (all use C-style braces), the existing brace-counting `extractJsFunctions` approach (after the AST fix in task 2 is applied to JS/TS) can be reused as a fallback on a copy that does not use the TS-specific class-method pattern.
2. Add `extractGenericCFunctions(content: string): FunctionMatch[]` that matches:
   - `<type> <name>(` with a brace body (covers C, C++, Java, C#, Kotlin, Swift, Scala, Go methods).
3. For Ruby, add `extractRubyFunctions` matching `def <name>` … `end`.
4. Add these languages to `SUPPORTED_LANGUAGES` with the appropriate extractor in the `extractFunctions` dispatcher.

---

## Summary of Priority

| #   | Task                                           | Priority     |
| --- | ---------------------------------------------- | ------------ |
| 1   | Fix path mismatch in scorer                    | **Critical** |
| 2   | AST-based complexity analysis                  | **High**     |
| 3   | Path-resolved dead code detection              | **High**     |
| 6   | Fix LOC block-comment regex bug                | **High**     |
| 4   | Inject version from package.json               | Medium       |
| 5   | Shared content cache                           | Medium       |
| 7   | Remove redundant dynamic import                | Low          |
| 8   | Fix `--output` + `--format terminal` behaviour | Medium       |
| 9   | Config file support                            | Medium       |
| 10  | Expand language complexity coverage            | Low          |
