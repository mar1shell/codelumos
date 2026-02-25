```
 ██████╗ ██████╗ ██████╗ ███████╗██╗     ██╗   ██╗███╗   ███╗ ██████╗ ███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝██║     ██║   ██║████╗ ████║██╔═══██╗██╔════╝
██║     ██║   ██║██║  ██║█████╗  ██║     ██║   ██║██╔████╔██║██║   ██║███████╗
██║     ██║   ██║██║  ██║██╔══╝  ██║     ██║   ██║██║╚██╔╝██║██║   ██║╚════██║
╚██████╗╚██████╔╝██████╔╝███████╗███████╗╚██████╔╝██║ ╚═╝ ██║╚██████╔╝███████║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ╚═╝ ╚═════╝ ╚══════╝
                         illuminate your codebase ✦
```

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-yellow?style=flat-square)
![Vibes](https://img.shields.io/badge/vibecoded-100%25-ff69b4?style=flat-square)
![Status](https://img.shields.io/badge/status-hobby%20project-orange?style=flat-square)
![PRs](https://img.shields.io/badge/PRs-welcome-blueviolet?style=flat-square)

</div>

---

> **Hobby project. 100% vibecoded.** No roadmap, no issues SLA, no enterprise support.
> Just vibes, static analysis, and the occasional refactor at 2am. Use it, break it, fork it.

---

A CLI tool for deep static codebase analysis. Point it at any directory and get a comprehensive report: lines of code, cyclomatic complexity, code duplication, dead code, dependency health, and an overall score with a letter grade.

## Features

- **Lines of Code** — Total, code, blank, and comment lines per file and per language
- **Cyclomatic Complexity** — Per-function scores, project averages, and hotspot detection (AST-based for TypeScript/JavaScript, regex-based for Python, Go, Ruby, and C-family)
- **Code Duplication** — Rolling-window hash matching to find duplicated blocks across files
- **Dead Code** — Detects exported symbols that are never imported anywhere (TypeScript/JavaScript)
- **Dependencies** — Parses `package.json`, `requirements.txt`, and `go.mod`; flags missing lock files
- **Health Score** — Weighted 0–100 score with letter grade (A+ to F) per project and per file

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
codelumos [path] [options]
```

`[path]` defaults to the current directory (`.`).

### Options

| Flag                               | Default    | Description                                                                     |
| ---------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| `-f, --format <format>`            | `terminal` | Output format: `terminal`, `json`, or `html`                                    |
| `-o, --output <file>`              | —          | Write report to a file instead of stdout                                        |
| `-i, --ignore <patterns...>`       | —          | Extra glob patterns to ignore (repeatable)                                      |
| `--min-score <number>`             | —          | Exit with code 1 if health score is below this threshold (CI mode)              |
| `--no-color`                       | —          | Disable colored terminal output                                                 |
| `--verbose`                        | `false`    | Show per-file details (top complex functions, duplication blocks, dead exports) |
| `--complexity-threshold <number>`  | `10`       | Complexity value above which a function is flagged as a hotspot                 |
| `--duplication-min-lines <number>` | `6`        | Minimum block size (lines) for duplication detection                            |
| `-v, --version`                    | —          | Print version number                                                            |

### Examples

```bash
# Audit current directory
codelumos

# Audit a specific project
codelumos /path/to/project

# Save a JSON report
codelumos --format json --output report.json /path/to/project

# Generate an HTML report
codelumos --format html --output report.html /path/to/project

# CI mode: fail if score drops below 70
codelumos --min-score 70 /path/to/project

# Verbose output with custom thresholds, ignoring test fixtures
codelumos --verbose --complexity-threshold 8 --ignore "tests/**" --ignore "vendor/**"
```

### Exit Codes

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `0`  | Success (score meets `--min-score` threshold, or no threshold set)         |
| `1`  | Error (directory not found, analysis failed, or score below `--min-score`) |

## Configuration File

Place a `.codelumos.json` file in the target directory (or any parent directory). CLI flags always take precedence over config file values.

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

| Dimension        | Weight | Target                                       |
| ---------------- | ------ | -------------------------------------------- |
| Comment Coverage | 20%    | >= 20% comment ratio                         |
| Complexity       | 30%    | Project average < 5, no file above threshold |
| Duplication      | 30%    | < 3% duplication rate                        |
| Dead Code        | 20%    | < 5% dead export ratio                       |

### Grade Scale

| Grade | Score    |
| ----- | -------- |
| `A+`  | 95 – 100 |
| `A`   | 88 – 94  |
| `B+`  | 80 – 87  |
| `B`   | 70 – 79  |
| `C+`  | 60 – 69  |
| `C`   | 50 – 59  |
| `D`   | 35 – 49  |
| `F`   | 0 – 34   |

## Terminal Report Sections

```
[ Health Score ]  [ Language Breakdown ]  [ Lines of Code ]
[ Complexity   ]  [ Duplication        ]  [ Dead Code     ]
[ Dependencies ]  [ Files Needing Attention               ]
```

1. **Health Score** — Overall grade and score with sub-dimension breakdown
2. **Language Breakdown** — Bar chart of languages by lines of code
3. **Lines of Code** — Table with total, code, blank, and comment lines per language
4. **Complexity** — Project average, hotspot files; per-function detail with `--verbose`
5. **Duplication** — Total duplicated lines, rate, and block count; block locations with `--verbose`
6. **Dead Code** — Unused export count and percentage; symbol table with `--verbose`
7. **Dependencies** — Manifest summary and missing lock file warnings
8. **Files Needing Attention** — Top 10 worst-scoring files with penalty reasons

## Supported Languages

```
TypeScript  JavaScript  Python      Go          Rust        Ruby
Java        C / C++     C#          PHP         Swift       Kotlin
Scala       Shell       HTML        CSS / SCSS  JSON        YAML
TOML        XML         Markdown    Dockerfile  SQL         GraphQL
Terraform   Protobuf    Vue         Svelte      Dotenv      +more
```

~35 languages detected by file extension and shebang line.

## Development

```bash
npm install          # install dependencies
npm run build        # bundle src/cli.ts → dist/cli.js
npm run dev          # watch mode
npm test             # run tests
npm run test:watch   # interactive watch mode
npm run test:coverage# coverage report (V8)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run lint:fix     # eslint --fix
npm run check        # typecheck + lint + test (CI gate)
```

## Project Structure

```
src/
├── cli.ts                     # CLI entry point (Commander.js)
├── config.ts                  # .codelumos.json loader and merger
├── scorer.ts                  # Health scoring engine
├── types.ts                   # Shared TypeScript interfaces
├── analyzers/
│   ├── complexityAnalyzer.ts  # Cyclomatic complexity analysis
│   ├── deadCodeAnalyzer.ts    # Unused export detection
│   ├── dependencyAnalyzer.ts  # Dependency manifest parsing
│   ├── duplicationAnalyzer.ts # Code duplication detection
│   └── locAnalyzer.ts         # Lines-of-code counter
├── reporters/
│   ├── terminalReporter.ts    # ANSI/chalk terminal output
│   ├── jsonReporter.ts        # JSON report serialization
│   └── htmlReporter.ts        # Self-contained HTML report
└── scanner/
    ├── fileScanner.ts         # File discovery and content cache
    └── languageMap.ts         # Language detection by extension and shebang
```

---
