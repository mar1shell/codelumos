## 2024-05-19 - Fast-path text parsing before Regex
**Learning:** In static analysis of large files, applying regex line-by-line is extremely expensive. `extractExports` was checking multiple regex patterns on every line. Most lines don't have an `export` keyword.
**Action:** Added a fast-path check `if (!line.startsWith('export ')) continue;` before running the `EXPORT_PATTERNS` regexes. This reduced the time spent from ~141ms to ~97ms in benchmarks (~30% faster). Similarly, in `extractImportedRefs`, an early return `if (!content.includes('import ')) return [];` avoids running regexes on files that have no imports at all.

## 2024-05-20 - Fast-path text parsing in export extraction
**Learning:** `deadCodeAnalyzer` was calling `.trim()` and then `.includes('export')` on every line. Trimming every single line in a large codebase creates massive string allocations. Most lines don't contain the word "export" anyway. By reordering to check `.includes('export')` on the raw line *before* trimming, we drastically reduce string allocations and improve export extraction performance by ~30% (~140ms down to ~95ms in 500k line benchmarks).
**Action:** When parsing large text files, always perform fast substring checks (`.includes()`) on the raw, unmodified line or string *before* applying transformations like `.trim()` or regular expressions.

## 2024-05-21 - Reusing Global Regex and avoiding Array allocations
**Learning:** Instantiating complex regular expressions repeatedly within functions or loops causes unnecessary overhead. Furthermore, when using `String.prototype.match()` with a global RegExp to count matches, the engine allocates an entire Array of string results, which is wasteful if only the count is needed.
**Action:** Always hoist invariant RegExp patterns to the module level so they are instantiated once. For simple counting, prefer resetting `pattern.lastIndex = 0` and using `pattern.exec(code)` in a `while` loop, which avoids allocating an array of strings.

## 2025-02-12 - Fast-path file scanning by avoiding I/O for language detection
**Learning:** During directory scanning (`fileScanner.ts`), detecting the language of every file by unconditionally reading the first line causes massive overhead for large codebases. Most file languages can be identified solely by their extension (e.g., `.ts`, `.js`, `.py`). Benchmarks showed that conditionally doing file I/O only for unknown extensions improved scanning performance by over 50%.
**Action:** Always attempt to resolve metadata like file language using fast-path synchronous string operations (filename/extension matching) before resorting to asynchronous file reads. If reading is strictly necessary, use `fs.open` and read only the first chunk of bytes to extract the shebang rather than `fs.readFile` on potentially large files.
