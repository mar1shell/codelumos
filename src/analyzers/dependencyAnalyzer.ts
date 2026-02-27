import { readFileContent } from '../scanner/fileScanner.js';
import { resolve, dirname } from 'node:path';
import { access } from 'node:fs/promises';
import type { ScannedFile, DependencyResult, DependencyManifest, DependencyKind } from '../types.js';

// ---------------------------------------------------------------------------
// Dependency Analyzer
//
// Parses package.json (npm), requirements.txt (pip), and go.mod (Go) to
// summarize dependencies and flag missing lock files.
// ---------------------------------------------------------------------------

async function checkFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function parsePackageJson(
  file: ScannedFile,
): Promise<DependencyManifest | null> {
  const content = await readFileContent(file.path);
  if (content === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const pkg = parsed as Record<string, unknown>;
  const deps = Object.keys(
    (typeof pkg['dependencies'] === 'object' && pkg['dependencies'] !== null
      ? pkg['dependencies']
      : {}) as Record<string, unknown>,
  );
  const devDeps = Object.keys(
    (typeof pkg['devDependencies'] === 'object' && pkg['devDependencies'] !== null
      ? pkg['devDependencies']
      : {}) as Record<string, unknown>,
  );

  const dir = dirname(file.path);
  const lockChecks = await Promise.all([
    checkFileExists(resolve(dir, 'package-lock.json')),
    checkFileExists(resolve(dir, 'yarn.lock')),
    checkFileExists(resolve(dir, 'pnpm-lock.yaml')),
  ]);
  const hasLockFile = lockChecks.some((exists) => exists);

  return {
    kind: 'npm' as DependencyKind,
    path: file.relativePath,
    hasLockFile,
    dependencies: deps,
    devDependencies: devDeps,
  };
}

async function parseRequirementsTxt(
  file: ScannedFile,
): Promise<DependencyManifest | null> {
  const content = await readFileContent(file.path);
  if (content === null) return null;

  const deps = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('-'))
    .map((l) => l.split(/[>=<!~^]/)[0]?.trim() ?? l);

  const dir = dirname(file.path);
  const lockChecks = await Promise.all([
    checkFileExists(resolve(dir, 'Pipfile.lock')),
    checkFileExists(resolve(dir, 'poetry.lock')),
    checkFileExists(resolve(dir, 'requirements.lock')),
  ]);
  const hasLockFile = lockChecks.some((exists) => exists);

  return {
    kind: 'pip' as DependencyKind,
    path: file.relativePath,
    hasLockFile,
    dependencies: deps,
    devDependencies: [],
  };
}

// Go regexes - pre-compiled for performance
const GO_REQUIRE_BLOCK_RE = /^require\s*\(([^)]*)\)/ms;
const GO_SINGLE_REQUIRE_RE = /^require\s+(\S+)/gm;

async function parseGoMod(
  file: ScannedFile,
): Promise<DependencyManifest | null> {
  const content = await readFileContent(file.path);
  if (content === null) return null;

  const deps: string[] = [];

  const blockMatch = GO_REQUIRE_BLOCK_RE.exec(content);
  if (blockMatch?.[1] !== undefined) {
    for (const line of blockMatch[1].split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        const pkg = trimmed.split(/\s+/)[0];
        if (pkg !== undefined) deps.push(pkg);
      }
    }
  }

  let match: RegExpExecArray | null;
  GO_SINGLE_REQUIRE_RE.lastIndex = 0;
  while ((match = GO_SINGLE_REQUIRE_RE.exec(content)) !== null) {
    if (match[1] !== undefined) deps.push(match[1]);
  }

  const dir = dirname(file.path);
  const hasLockFile = await checkFileExists(resolve(dir, 'go.sum'));

  return {
    kind: 'go' as DependencyKind,
    path: file.relativePath,
    hasLockFile,
    dependencies: deps,
    devDependencies: [],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeDependencies(files: ScannedFile[]): Promise<DependencyResult> {
  const manifests: DependencyManifest[] = [];

  for (const file of files) {
    const base = (file.relativePath.split('/').pop() ?? '').toLowerCase();

    let manifest: DependencyManifest | null = null;

    if (base === 'package.json') {
      manifest = await parsePackageJson(file);
    } else if (base === 'requirements.txt') {
      manifest = await parseRequirementsTxt(file);
    } else if (base === 'go.mod') {
      manifest = await parseGoMod(file);
    }

    if (manifest !== null) manifests.push(manifest);
  }

  const totalDependencies = manifests.reduce((s, m) => s + m.dependencies.length, 0);
  const totalDevDependencies = manifests.reduce((s, m) => s + m.devDependencies.length, 0);
  const missingLockFiles = manifests
    .filter((m) => !m.hasLockFile)
    .map((m) => m.path);

  return { manifests, totalDependencies, totalDevDependencies, missingLockFiles };
}
