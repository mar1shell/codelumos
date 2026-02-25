import { Command, Option } from 'commander';
import { resolve } from 'node:path';
import { writeFile, access } from 'node:fs/promises';
import ora from 'ora';
import chalk from 'chalk';

import { scanDirectory, preloadContents } from './scanner/fileScanner.js';
import { analyzeLocForFiles } from './analyzers/locAnalyzer.js';
import { analyzeComplexity } from './analyzers/complexityAnalyzer.js';
import { analyzeDuplication, recalcDuplicationRate } from './analyzers/duplicationAnalyzer.js';
import { analyzeDeadCode } from './analyzers/deadCodeAnalyzer.js';
import { analyzeDependencies } from './analyzers/dependencyAnalyzer.js';
import { attachScore } from './scorer.js';
import { renderTerminal } from './reporters/terminalReporter.js';
import { renderJson } from './reporters/jsonReporter.js';
import { renderHtml } from './reporters/htmlReporter.js';
import { findAndLoadRc, mergeConfig } from './config.js';
import type { CliOptions, OutputFormat, AuditReport } from './types.js';

// ---------------------------------------------------------------------------
// Package version (injected at build time by tsup)
// ---------------------------------------------------------------------------
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '1.0.0';

// ---------------------------------------------------------------------------
// CLI definition
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('codelumos')
  .description(
    'Deep codebase analysis: LOC, complexity, duplication, dead code, and health scoring.',
  )
  .version(VERSION, '-v, --version', 'Print version number')
  .argument('[path]', 'Directory to audit (default: current directory)', '.')
  .addOption(
    new Option('-f, --format <format>', 'Output format')
      .choices(['terminal', 'json', 'html'])
      .default('terminal'),
  )
  .option('-o, --output <file>', 'Write report to a file instead of stdout')
  .option(
    '-i, --ignore <patterns...>',
    'Additional glob patterns to ignore (repeatable)',
    [],
  )
  .option(
    '--min-score <number>',
    'Exit with code 1 if health score is below this threshold (CI mode)',
  )
  .option('--no-color', 'Disable colored terminal output')
  .option('--verbose', 'Show per-file details in terminal output', false)
  .option(
    '--complexity-threshold <number>',
    'Complexity value above which a function is flagged',
    '10',
  )
  .option(
    '--duplication-min-lines <number>',
    'Minimum block size (lines) for duplication detection',
    '6',
  )
  .action(async (pathArg: string, rawOpts: Record<string, unknown>) => {
    // ── Parse options ────────────────────────────────────────────────────────
    const rawOutput = rawOpts['output'] as string | undefined;
    const rawMinScore = rawOpts['minScore'] !== undefined ? Number(rawOpts['minScore']) : undefined;
    const cliOpts: CliOptions = {
      format: (rawOpts['format'] as OutputFormat) ?? 'terminal',
      ...(rawOutput !== undefined ? { output: rawOutput } : {}),
      ...(rawMinScore !== undefined ? { minScore: rawMinScore } : {}),
      ignore: (rawOpts['ignore'] as string[]) ?? [],
      noColor: rawOpts['color'] === false,
      verbose: (rawOpts['verbose'] as boolean) ?? false,
      complexityThreshold: Number(rawOpts['complexityThreshold'] ?? 10),
      duplicationMinLines: Number(rawOpts['duplicationMinLines'] ?? 6),
    };

    // Determine which flags were explicitly set (vs defaults)
    const explicitFlags = new Set<string>(
      Object.entries(rawOpts)
        .filter(([, v]) => v !== undefined && v !== false && v !== '' && !(Array.isArray(v) && v.length === 0))
        .map(([k]) => k),
    );

    // Load .codelumos.json from the target directory (or cwd) upward
    const rcStartDir = resolve(pathArg);
    const rc = findAndLoadRc(rcStartDir);
    const opts = mergeConfig(cliOpts, rc, explicitFlags);

    if (opts.noColor) chalk.level = 0;

    const rootDir = resolve(pathArg);

    // ── Verify path exists ───────────────────────────────────────────────────
    try {
      await access(rootDir);
    } catch {
      process.stderr.write(
        chalk.red(`  error: directory not found: ${rootDir}\n`),
      );
      process.exit(1);
    }

    const startMs = Date.now();

    // ── Scanning ─────────────────────────────────────────────────────────────
    const scanSpinner = ora({ text: 'Scanning files…', color: 'cyan' }).start();

    let scanResult;
    try {
      scanResult = await scanDirectory(rootDir, {
        ignore: opts.ignore,
        onProgress: (scanned, total) => {
          scanSpinner.text = `Scanning files…  ${scanned}/${total}`;
        },
      });
    } catch (err: unknown) {
      scanSpinner.fail('Scan failed');
      process.stderr.write(
        chalk.red(`  error: ${err instanceof Error ? err.message : String(err)}\n`),
      );
      process.exit(1);
    }

    const { files } = scanResult;

    scanSpinner.succeed(
      `Found ${chalk.bold(String(files.length))} files  ` +
      chalk.dim(
        `(skipped: ${scanResult.skippedIgnored} ignored, ` +
        `${scanResult.skippedBinary} binary, ` +
        `${scanResult.skippedTooBig} too large, ` +
        `${scanResult.skippedUnknown} unknown type)`,
      ),
    );

    if (files.length === 0) {
      process.stdout.write(chalk.yellow('  No files to analyze.\n'));
      process.exit(0);
    }

    // ── Analysis ─────────────────────────────────────────────────────────────
    const analyzeSpinner = ora({ text: 'Analyzing…', color: 'cyan' }).start();

    const steps = ['LOC', 'Complexity', 'Duplication', 'Dead code', 'Dependencies'];
    let step = 0;

    function nextStep(): void {
      step++;
      analyzeSpinner.text = `Analyzing…  [${step}/${steps.length}] ${steps[step] ?? ''}`;
    }

    try {
      analyzeSpinner.text = `Analyzing…  [1/${steps.length}] LOC`;

      // Preload all file contents once to avoid repeated disk reads
      const contentCache = await preloadContents(files);

      const [loc, complexity, duplication, deadCode, dependencies] = await Promise.all([
        analyzeLocForFiles(files, contentCache).then((r) => { nextStep(); return r; }),
        analyzeComplexity(files, opts.complexityThreshold, contentCache).then((r) => { nextStep(); return r; }),
        analyzeDuplication(files, opts.duplicationMinLines, contentCache).then((r) => { nextStep(); return r; }),
        analyzeDeadCode(files, contentCache).then((r) => { nextStep(); return r; }),
        analyzeDependencies(files).then((r) => { nextStep(); return r; }),
      ]);

      analyzeSpinner.succeed('Analysis complete');

      // Recalc duplication rate with accurate total from LOC
      const duplicationFinal = recalcDuplicationRate(duplication, loc.totals.total);

      const partialReport: Omit<AuditReport, 'score'> = {
        timestamp: new Date().toISOString(),
        rootDir,
        durationMs: Date.now() - startMs,
        loc,
        complexity,
        duplication: duplicationFinal,
        deadCode,
        dependencies,
      };

      const report = attachScore(partialReport);

      // ── Render ──────────────────────────────────────────────────────────────
      let output: string;
      switch (opts.format) {
        case 'json':
          output = renderJson(report);
          break;
        case 'html':
          output = renderHtml(report);
          break;
        default: {
          // Render to string; if writing to a file, strip ANSI escape codes
          const rendered = renderTerminal(report, opts);
          if (opts.output !== undefined) {
            // Strip ANSI codes for plain-text file output
            // eslint-disable-next-line no-control-regex
            output = rendered.replace(/\x1b\[[0-9;]*m/g, '');
          } else {
            // Write directly to stdout and clear output so we don't double-write
            process.stdout.write(rendered + '\n');
            output = '';
          }
          break;
        }
      }

      if (opts.output !== undefined) {
        const outPath = resolve(opts.output);
        await writeFile(outPath, output, 'utf8');
        process.stdout.write(
          chalk.green(`  Report written to: ${outPath}\n`),
        );
      } else if (output.length > 0) {
        process.stdout.write(output);
      }

      // ── CI mode ─────────────────────────────────────────────────────────────
      if (opts.minScore !== undefined && report.score.score < opts.minScore) {
        process.stderr.write(
          chalk.red(
            `\n  Health score ${report.score.score} is below minimum ${opts.minScore}. Exiting with code 1.\n`,
          ),
        );
        process.exit(1);
      }
    } catch (err: unknown) {
      analyzeSpinner.fail('Analysis failed');
      process.stderr.write(
        chalk.red(`  error: ${err instanceof Error ? err.message : String(err)}\n`),
      );
      if (err instanceof Error && err.stack !== undefined) {
        process.stderr.write(chalk.dim(err.stack) + '\n');
      }
      process.exit(1);
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(
    chalk.red(`  fatal: ${err instanceof Error ? err.message : String(err)}\n`),
  );
  process.exit(1);
});
