# codeaudit

A production-ready CLI tool for deep static codebase analysis. Scans any directory and produces a comprehensive report covering lines of code, cyclomatic complexity, code duplication, dead code, dependencies, and an overall health score.

## Features

- **Lines of Code** — Total, code, blank, and comment lines per file and per language
- **Cyclomatic Complexity** — Per-function scores, project averages, and hotspot detection (AST-based for TypeScript/JavaScript, regex-based for Python, Go, Ruby, and C-family languages)
- **Code Duplication** — Rolling-window hash matching to detect duplicated blocks across files
- **Dead Code** — Detects exported symbols that are never imported anywhere (TypeScript/JavaScript)
- **Dependencies** — Parses `package.json`, `requirements.txt`, and `go.mod`; flags missing lock files
- **Health Score** — A weighted 0–100 score with letter grade (A+ to F) for the entire project and per file

## Requirements

- Node.js >= 18.0.0

## Installation

```bash
npm install
npm run build
```

To install globally:

```bash
npm install -g .
```

## Usage

```
codeaudit [path] [options]
```

`[path]` defaults to the current directory (`.`).

### Options

| Flag | Default | Description |
|---|---|---|
| `-f, --format <format>` | `terminal` | Output format: `terminal`, `json`, or `html` |
| `-o, --output <file>` | — | Write report to a file instead of stdout |
| `-i, --ignore <patterns...>` | — | Extra glob patterns to ignore (repeatable) |
| `--min-score <number>` | — | Exit with code 1 if health score is below this threshold (CI mode) |
| `--no-color` | — | Disable colored terminal output |
| `--verbose` | `false` | Show per-file details (top complex functions, duplication blocks, dead exports) |
| `--complexity-threshold <number>` | `10` | Complexity value above which a function is flagged as a hotspot |
| `--duplication-min-lines <number>` | `6` | Minimum block size (lines) for duplication detection |
| `-v, --version` | — | Print version number |

### Examples

```bash
# Audit current directory
codeaudit

# Audit a specific project
codeaudit /path/to/project

# Save a JSON report
codeaudit --format json --output report.json /path/to/project

# Generate an HTML report
codeaudit --format html --output report.html /path/to/project

# CI mode: fail if score drops below 70
codeaudit --min-score 70 /path/to/project

# Verbose output with custom thresholds, ignoring test fixtures
codeaudit --verbose --complexity-threshold 8 --ignore "tests/**" --ignore "vendor/**"
```

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success (score meets `--min-score` threshold, or no threshold set) |
| `1` | Error (directory not found, analysis failed, or score below `--min-score`) |

## Configuration File

Place a `.codeauditrc.json` file in the target directory (or any parent directory). CLI flags always take precedence over config file values.

```json
{
  "ignore": ["tests/fixtures/**", "vendor/**"],
  "complexityThreshold": 8,
  "duplicationMinLines": 5,
  "minScore": 75,
  "format": "terminal",
  "verbose": false,
  "noColor": false
}
```

## Health Score

The overall health score (0–100) is a weighted average of four sub-dimensions:

| Dimension | Weight | Target |
|---|---|---|
| Comment Coverage | 20% | >= 20% comment ratio |
| Complexity | 30% | Project average < 5, no file above threshold |
| Duplication | 30% | < 3% duplication rate |
| Dead Code | 20% | < 5% dead export ratio |

### Grade Scale

| Grade | Score Range |
|---|---|
| A+ | 95 – 100 |
| A  | 88 – 94  |
| B+ | 80 – 87  |
| B  | 70 – 79  |
| C+ | 60 – 69  |
| C  | 50 – 59  |
| D  | 35 – 49  |
| F  | 0  – 34  |

## Terminal Report Sections

1. **Health Score** — Overall grade and score with sub-dimension breakdown
2. **Language Breakdown** — Bar chart of languages by lines of code
3. **Lines of Code** — Table with total, code, blank, and comment lines per language
4. **Complexity** — Project average, hotspot files; per-function detail with `--verbose`
5. **Duplication** — Total duplicated lines, rate, and block count; block locations with `--verbose`
6. **Dead Code** — Unused export count and percentage; symbol table with `--verbose`
7. **Dependencies** — Manifest summary and missing lock file warnings
8. **Files Needing Attention** — Top 10 worst-scoring files with penalty reasons

## Supported Languages

TypeScript, JavaScript, Python, Go, Rust, Ruby, C, C++, C#, Java, PHP, Swift, Kotlin, Shell, Bash, HTML, CSS, SCSS, JSON, YAML, TOML, Markdown, Dockerfile, and more (~35 languages via extension and shebang detection).

## Development

```bash
# Install dependencies
npm install

# Build (bundles src/cli.ts → dist/cli.js)
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Lint
npm run lint
npm run lint:fix

# Full CI check (typecheck + lint + test)
npm run check
```

## Project Structure

```
src/
├── cli.ts                    # CLI entry point (Commander.js)
├── config.ts                 # .codeauditrc.json loader and merger
├── scorer.ts                 # Health scoring engine
├── types.ts                  # Shared TypeScript interfaces
├── analyzers/
│   ├── complexityAnalyzer.ts # Cyclomatic complexity analysis
│   ├── deadCodeAnalyzer.ts   # Unused export detection
│   ├── dependencyAnalyzer.ts # Dependency manifest parsing
│   ├── duplicationAnalyzer.ts# Code duplication detection
│   └── locAnalyzer.ts        # Lines-of-code counter
├── reporters/
│   ├── terminalReporter.ts   # ANSI/chalk terminal output
│   ├── jsonReporter.ts       # JSON report serialization
│   └── htmlReporter.ts       # Self-contained HTML report
└── scanner/
    ├── fileScanner.ts        # File discovery and content cache
    └── languageMap.ts        # Language detection by extension and shebang
```

## License

MIT
