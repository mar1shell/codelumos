import chalk from 'chalk';
import Table from 'cli-table3';
import type { AuditReport, CliOptions, HealthGrade } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRADE_COLOR: Record<HealthGrade, (s: string) => string> = {
  'A+': (s) => chalk.bold.green(s),
  A: (s) => chalk.green(s),
  'B+': (s) => chalk.bold.cyan(s),
  B: (s) => chalk.cyan(s),
  'C+': (s) => chalk.bold.yellow(s),
  C: (s) => chalk.yellow(s),
  D: (s) => chalk.bold.red(s),
  F: (s) => chalk.bgRed.white.bold(s),
};

function colorGrade(grade: HealthGrade): string {
  return GRADE_COLOR[grade](` ${grade} `);
}

function colorScore(score: number): string {
  if (score >= 88) return chalk.green(String(score));
  if (score >= 70) return chalk.cyan(String(score));
  if (score >= 50) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

function bar(value: number, max: number, width = 24): string {
  const filled = Math.round((value / Math.max(max, 1)) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function percentBar(pct: number, width = 24): string {
  const filled = Math.round((Math.min(pct, 100) / 100) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function truncate(s: string, max: number): string {
  return s.length > max ? '…' + s.slice(-(max - 1)) : s;
}

// ---------------------------------------------------------------------------
// Report renderer — returns the full rendered string (caller decides where to write)
// ---------------------------------------------------------------------------

export function renderTerminal(report: AuditReport, opts: CliOptions): string {
  const { loc, complexity, duplication, deadCode, dependencies, score } = report;
  const root = report.rootDir.split('/').pop() ?? report.rootDir;

  if (opts.noColor) chalk.level = 0;

  const lines: string[] = [];
  const w = (s: string): void => { lines.push(s); };

  const section = (title: string): void => {
    w('\n' + chalk.bold.white('  ' + title));
    w(chalk.gray('  ' + '─'.repeat(title.length + 2)));
  };

  // ── Header ────────────────────────────────────────────────────────────────
  w('');
  w(chalk.bgWhite.black.bold(`  Code Audit Report  •  ${root}  `));
  w(chalk.gray(`  ${report.timestamp}  •  ${report.durationMs}ms`));

  // ── Health Score ──────────────────────────────────────────────────────────
  section('Health Score');
  w(`  ${colorGrade(score.grade)}  ${colorScore(score.score)}/100\n`);

  const bdown = score.breakdown;
  const bdownRows = [
    ['Comment Coverage', bdown.commentCoverage],
    ['Complexity',       bdown.complexity],
    ['Duplication',      bdown.duplication],
    ['Dead Code',        bdown.deadCode],
  ] as const;

  for (const [label, pts] of bdownRows) {
    w(`  ${chalk.dim(label.padEnd(22))} ${percentBar(pts, 20)} ${colorScore(pts)}/100`);
  }

  // ── Language Breakdown ────────────────────────────────────────────────────
  section('Language Breakdown');
  const totalCode = loc.totals.code || 1;
  const topLangs = loc.byLanguage.slice(0, 8);

  for (const lang of topLangs) {
    const pct = Math.round((lang.code / totalCode) * 100);
    const label = lang.language.padEnd(16);
    w(
      `  ${chalk.cyan(label)}  ${bar(lang.code, totalCode)}  ${String(pct).padStart(3)}%  ` +
      `${chalk.dim(fmt(lang.files) + ' files')}`,
    );
  }

  // ── Lines of Code ─────────────────────────────────────────────────────────
  section('Lines of Code');
  const locTable = new Table({
    head: ['', chalk.white('Total'), chalk.white('Code'), chalk.white('Blank'), chalk.white('Comments'), chalk.white('Coverage')],
    style: { head: [], border: ['gray'] },
    chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
  });

  locTable.push([
    chalk.bold('Project'),
    fmt(loc.totals.total),
    fmt(loc.totals.code),
    fmt(loc.totals.blank),
    fmt(loc.totals.comment),
    loc.totals.code === 0
      ? 'n/a'
      : chalk.dim(
          Math.round((loc.totals.comment / (loc.totals.code + loc.totals.comment)) * 100) + '%',
        ),
  ]);

  for (const lang of topLangs) {
    const cov =
      lang.code === 0
        ? 'n/a'
        : Math.round((lang.comment / (lang.code + lang.comment)) * 100) + '%';
    locTable.push([lang.language, fmt(lang.total), fmt(lang.code), fmt(lang.blank), fmt(lang.comment), cov]);
  }

  w(locTable.toString());

  // ── Complexity ────────────────────────────────────────────────────────────
  section('Complexity');
  w(
    `  Project average: ${chalk.bold(String(complexity.projectAvg))}   ` +
    `Hotspot files: ${chalk.bold(String(complexity.hotspots.length))}\n`,
  );

  if (complexity.hotspots.length > 0) {
    const complexTable = new Table({
      head: [chalk.white('File'), chalk.white('Max'), chalk.white('Avg'), chalk.white('Functions')],
      style: { head: [], border: ['gray'] },
      chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    });

    for (const h of complexity.hotspots.slice(0, 10)) {
      const maxColor = h.maxComplexity >= 20 ? chalk.red : chalk.yellow;
      complexTable.push([
        truncate(h.path, 55),
        maxColor(String(h.maxComplexity)),
        String(h.avgComplexity),
        String(h.functions.length),
      ]);
    }
    w(complexTable.toString());
  }

  if (opts.verbose && complexity.hotspots.length > 0) {
    w('\n  ' + chalk.dim('Top complex functions:'));
    for (const h of complexity.hotspots.slice(0, 5)) {
      const topFns = [...h.functions]
        .sort((a, b) => b.complexity - a.complexity)
        .slice(0, 3);
      for (const fn of topFns) {
        w(
          `  ${chalk.dim(truncate(h.path, 40))}:${fn.line}  ` +
          `${chalk.cyan(fn.name)}  complexity ${chalk.yellow(String(fn.complexity))}`,
        );
      }
    }
  }

  // ── Duplication ───────────────────────────────────────────────────────────
  section('Duplication');
  w(
    `  Duplicated lines: ${chalk.bold(fmt(duplication.duplicatedLines))}  ` +
    `(${chalk.bold(String(duplication.duplicationRate) + '%')} of ${fmt(duplication.totalLines)} total lines)  ` +
    `Blocks: ${chalk.bold(String(duplication.blocks.length))}`,
  );

  if (opts.verbose && duplication.blocks.length > 0) {
    w('');
    for (const block of duplication.blocks.slice(0, 5)) {
      w(`  ${chalk.dim(block.lines + '-line block — ' + block.occurrences.length + ' occurrences:')}`);
      for (const occ of block.occurrences) {
        w(`    ${truncate(occ.path, 55)}:${occ.startLine}`);
      }
    }
  }

  // ── Dead Code ─────────────────────────────────────────────────────────────
  section('Dead Code');
  w(
    `  Unused exports: ${chalk.bold(String(deadCode.deadExports.length))} / ${deadCode.totalExports}  ` +
    `(${chalk.bold(String(deadCode.deadRatio) + '%')})`,
  );

  if (opts.verbose && deadCode.deadExports.length > 0) {
    w('');
    const deadTable = new Table({
      head: [chalk.white('Symbol'), chalk.white('Type'), chalk.white('File'), chalk.white('Line')],
      style: { head: [], border: ['gray'] },
      chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    });

    for (const d of deadCode.deadExports.slice(0, 15)) {
      deadTable.push([
        chalk.yellow(d.symbol),
        chalk.dim(d.exportType),
        truncate(d.path, 45),
        String(d.line),
      ]);
    }
    w(deadTable.toString());
  }

  // ── Dependencies ──────────────────────────────────────────────────────────
  section('Dependencies');
  w(
    `  Manifests: ${chalk.bold(String(dependencies.manifests.length))}  ` +
    `Total deps: ${chalk.bold(fmt(dependencies.totalDependencies))}  ` +
    `Dev deps: ${chalk.bold(fmt(dependencies.totalDevDependencies))}`,
  );

  if (dependencies.missingLockFiles.length > 0) {
    w(`\n  ${chalk.yellow('⚠')}  Missing lock files:`);
    for (const p of dependencies.missingLockFiles) {
      w(`    ${chalk.dim(p)}`);
    }
  }

  // ── Worst Files ───────────────────────────────────────────────────────────
  if (score.worstFiles.length > 0) {
    section('Files Needing Attention');
    const worstTable = new Table({
      head: [chalk.white('File'), chalk.white('Score'), chalk.white('Grade'), chalk.white('Issues')],
      style: { head: [], border: ['gray'] },
      chars: { mid: '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    });

    for (const f of score.worstFiles.slice(0, 10)) {
      if (f.penalties.length === 0) continue;
      worstTable.push([
        truncate(f.path, 50),
        colorScore(f.score),
        colorGrade(f.grade),
        f.penalties.join(', '),
      ]);
    }
    w(worstTable.toString());
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  w('');
  w(chalk.dim(`  Scanned ${fmt(loc.totals.files)} files in ${report.durationMs}ms`));
  w('');

  return lines.join('\n');
}

