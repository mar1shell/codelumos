import type { AuditReport, HealthGrade } from '../types.js';

// ---------------------------------------------------------------------------
// Self-contained HTML report with inline CSS and JS
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function gradeClass(grade: HealthGrade): string {
  if (grade === 'A+' || grade === 'A') return 'grade-a';
  if (grade === 'B+' || grade === 'B') return 'grade-b';
  if (grade === 'C+' || grade === 'C') return 'grade-c';
  if (grade === 'D') return 'grade-d';
  return 'grade-f';
}

function scoreBar(score: number, label: string): string {
  const cls =
    score >= 88 ? 'bar-green' : score >= 70 ? 'bar-cyan' : score >= 50 ? 'bar-yellow' : 'bar-red';
  return `<div class="bar-wrap" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100"><div class="bar ${cls}" style="width:${score}%"></div></div>`;
}

export function renderHtml(report: AuditReport): string {
  const { loc, complexity, duplication, deadCode, dependencies, score } = report;
  const root = escapeHtml(report.rootDir.split('/').pop() ?? report.rootDir);

  const langRows = loc.byLanguage
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.language)}</td><td>${fmt(l.files)}</td><td>${fmt(l.total)}</td><td>${fmt(l.code)}</td><td>${fmt(l.comment)}</td></tr>`,
    )
    .join('');

  const hotspotRows = complexity.hotspots
    .slice(0, 20)
    .map(
      (h) =>
        `<tr><td>${escapeHtml(h.path)}</td><td>${h.maxComplexity}</td><td>${h.avgComplexity}</td><td>${h.functions.length}</td></tr>`,
    )
    .join('');

  const dupRows = duplication.blocks
    .slice(0, 20)
    .map(
      (b) =>
        `<tr><td>${b.lines} lines</td><td>${b.occurrences.length}</td><td>${b.occurrences.map((o) => escapeHtml(o.path) + ':' + o.startLine).join('<br>')}</td></tr>`,
    )
    .join('');

  const deadRows = deadCode.deadExports
    .slice(0, 50)
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.symbol)}</td><td>${d.exportType}</td><td>${escapeHtml(d.path)}</td><td>${d.line}</td></tr>`,
    )
    .join('');

  const depRows = dependencies.manifests
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.path)}</td><td>${m.kind}</td><td>${m.dependencies.length}</td><td>${m.devDependencies.length}</td><td>${m.hasLockFile ? '<span class="ok">✓</span>' : '<span class="warn">✗</span>'}</td></tr>`,
    )
    .join('');

  const worstRows = score.worstFiles
    .filter((f) => f.penalties.length > 0)
    .slice(0, 20)
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.path)}</td><td>${f.score}</td><td><span class="grade ${gradeClass(f.grade)}">${f.grade}</span></td><td>${f.penalties.map(escapeHtml).join(', ')}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Code Audit — ${root}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0d1117;color:#c9d1d9;line-height:1.6}
  a{color:#58a6ff}
  h1{font-size:1.6rem;font-weight:700;color:#e6edf3}
  h2{font-size:1.1rem;font-weight:600;color:#e6edf3;margin-bottom:.75rem;padding-bottom:.4rem;border-bottom:1px solid #21262d}
  .container{max-width:1100px;margin:0 auto;padding:2rem 1.5rem}
  .header{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:1.5rem 2rem;margin-bottom:1.5rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}
  .header-meta{color:#8b949e;font-size:.85rem}
  .score-hero{display:flex;align-items:center;gap:1rem}
  .score-num{font-size:3rem;font-weight:700;line-height:1}
  .grade-badge{font-size:1.5rem;font-weight:700;padding:.2rem .8rem;border-radius:6px}
  .grade-a{background:#1a4731;color:#3fb950}
  .grade-b{background:#0d2b45;color:#58a6ff}
  .grade-c{background:#3d2b00;color:#e3b341}
  .grade-d{background:#3d1c1c;color:#f85149}
  .grade-f{background:#f85149;color:#fff}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-bottom:1.5rem}
  .card{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:1.25rem 1.5rem}
  .breakdown-row{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem}
  .breakdown-label{width:160px;font-size:.85rem;color:#8b949e;flex-shrink:0}
  .bar-wrap{flex:1;background:#21262d;border-radius:4px;height:8px;overflow:hidden}
  .bar{height:100%;border-radius:4px;transition:width .3s}
  .bar-green{background:#3fb950}
  .bar-cyan{background:#58a6ff}
  .bar-yellow{background:#e3b341}
  .bar-red{background:#f85149}
  .pts{font-size:.8rem;color:#8b949e;width:55px;text-align:right}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;padding:.5rem .75rem;color:#8b949e;font-weight:600;border-bottom:1px solid #21262d}
  td{padding:.4rem .75rem;border-bottom:1px solid #161b22;color:#c9d1d9}
  tr:hover td{background:#1c2128}
  .stat{font-size:2rem;font-weight:700;color:#e6edf3}
  .stat-label{font-size:.8rem;color:#8b949e;margin-top:.15rem}
  .stats-row{display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1rem}
  .ok{color:#3fb950}
  .warn{color:#e3b341}
  .section{margin-bottom:1.5rem}
  footer{text-align:center;color:#484f58;font-size:.8rem;margin-top:2rem;padding-top:1rem;border-top:1px solid #21262d}
  @media print{
    body{background:#fff;color:#000}
    .container{max-width:100%;padding:0}
    .header,.card,.section{background:#fff;border:1px solid #ccc;break-inside:avoid;box-shadow:none}
    h1,h2,.stat,.score-num{color:#000}
    .header-meta,.stat-label,th,.pts,.breakdown-label{color:#333}
    a{color:#000;text-decoration:underline}
    .bar-wrap{border:1px solid #ccc;background:#eee}
    .bar-green,.bar-cyan,.bar-yellow,.bar-red{background:#000}
    .grade-badge{border:1px solid #000;background:#fff;color:#000}
    td{border-bottom:1px solid #eee;color:#000}
    tr:hover td{background:#fff}
    footer{display:none}
  }
</style>
</head>
<body>
<main class="container">

  <header class="header">
    <div>
      <h1>Code Audit — ${root}</h1>
      <div class="header-meta">${escapeHtml(report.timestamp)} &nbsp;·&nbsp; ${report.durationMs}ms &nbsp;·&nbsp; ${fmt(loc.totals.files)} files</div>
    </div>
    <div class="score-hero">
      <div class="score-num">${score.score}</div>
      <div class="grade-badge ${gradeClass(score.grade)}">${score.grade}</div>
    </div>
  </header>

  <div class="grid">

    <div class="card">
      <h2>Health Score Breakdown</h2>
      ${(
        [
          ['Comment Coverage', score.breakdown.commentCoverage],
          ['Complexity',       score.breakdown.complexity],
          ['Duplication',      score.breakdown.duplication],
          ['Dead Code',        score.breakdown.deadCode],
        ] as const
      )
        .map(([label, pts]) => {
          return `<div class="breakdown-row">
            <div class="breakdown-label">${label}</div>
            ${scoreBar(pts, label)}
            <div class="pts">${pts}/100</div>
          </div>`;
        })
        .join('')}
    </div>

    <div class="card">
      <h2>Summary Statistics</h2>
      <div class="stats-row">
        <div><div class="stat">${fmt(loc.totals.code)}</div><div class="stat-label">Lines of Code</div></div>
        <div><div class="stat">${fmt(loc.totals.files)}</div><div class="stat-label">Files</div></div>
        <div><div class="stat">${complexity.projectAvg}</div><div class="stat-label">Avg Complexity</div></div>
      </div>
      <div class="stats-row">
        <div><div class="stat">${duplication.duplicationRate}%</div><div class="stat-label">Duplication Rate</div></div>
        <div><div class="stat">${deadCode.deadRatio}%</div><div class="stat-label">Dead Exports</div></div>
        <div><div class="stat">${dependencies.totalDependencies}</div><div class="stat-label">Dependencies</div></div>
      </div>
    </div>

  </div>

  <section class="section card">
    <h2>Language Breakdown</h2>
    <table>
      <thead><tr><th>Language</th><th>Files</th><th>Total Lines</th><th>Code Lines</th><th>Comments</th></tr></thead>
      <tbody>${langRows}</tbody>
    </table>
  </section>

  ${
    complexity.hotspots.length > 0
      ? `<section class="section card">
    <h2>Complexity Hotspots</h2>
    <table>
      <thead><tr><th>File</th><th>Max Complexity</th><th>Avg Complexity</th><th>Functions</th></tr></thead>
      <tbody>${hotspotRows}</tbody>
    </table>
  </section>`
      : ''
  }

  ${
    duplication.blocks.length > 0
      ? `<section class="section card">
    <h2>Duplicated Blocks</h2>
    <table>
      <thead><tr><th>Block Size</th><th>Occurrences</th><th>Locations</th></tr></thead>
      <tbody>${dupRows}</tbody>
    </table>
  </section>`
      : ''
  }

  ${
    deadCode.deadExports.length > 0
      ? `<section class="section card">
    <h2>Potentially Dead Exports</h2>
    <table>
      <thead><tr><th>Symbol</th><th>Type</th><th>File</th><th>Line</th></tr></thead>
      <tbody>${deadRows}</tbody>
    </table>
  </section>`
      : ''
  }

  ${
    dependencies.manifests.length > 0
      ? `<section class="section card">
    <h2>Dependencies</h2>
    <table>
      <thead><tr><th>Manifest</th><th>Kind</th><th>Dependencies</th><th>Dev Dependencies</th><th>Lock File</th></tr></thead>
      <tbody>${depRows}</tbody>
    </table>
  </section>`
      : ''
  }

  ${
    worstRows.length > 0
      ? `<section class="section card">
    <h2>Files Needing Attention</h2>
    <table>
      <thead><tr><th>File</th><th>Score</th><th>Grade</th><th>Issues</th></tr></thead>
      <tbody>${worstRows}</tbody>
    </table>
  </section>`
      : ''
  }

  <footer>Generated by codelumos &nbsp;·&nbsp; ${escapeHtml(report.timestamp)}</footer>
</main>
</body>
</html>`;
}
