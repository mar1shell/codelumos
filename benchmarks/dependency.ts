import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';

const NUM_DIRS = 1000;
const TEMP_DIR = join(tmpdir(), 'codelumos-bench-' + Date.now());

// Setup
console.log(`Setting up benchmark in ${TEMP_DIR}...`);
mkdirSync(TEMP_DIR, { recursive: true });

const scenarios = ['npm', 'yarn', 'pnpm', 'none'];
const dirs: string[] = [];

for (let i = 0; i < NUM_DIRS; i++) {
  const dir = join(TEMP_DIR, `dir-${i}`);
  mkdirSync(dir);
  dirs.push(dir);

  const scenario = scenarios[i % scenarios.length];
  if (scenario === 'npm') {
    writeFileSync(join(dir, 'package-lock.json'), '{}');
  } else if (scenario === 'yarn') {
    writeFileSync(join(dir, 'yarn.lock'), '');
  } else if (scenario === 'pnpm') {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '');
  }
}

// 1. Sync Implementation (Baseline)
function checkSync(dir: string): boolean {
  return (
    existsSync(resolve(dir, 'package-lock.json')) ||
    existsSync(resolve(dir, 'yarn.lock')) ||
    existsSync(resolve(dir, 'pnpm-lock.yaml'))
  );
}

// 2. Async Sequential Implementation
async function checkAccess(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function checkAsyncSequential(dir: string): Promise<boolean> {
  // We use await in the condition, effectively sequential
  return (
    (await checkAccess(resolve(dir, 'package-lock.json'))) ||
    (await checkAccess(resolve(dir, 'yarn.lock'))) ||
    (await checkAccess(resolve(dir, 'pnpm-lock.yaml')))
  );
}

// 3. Async Parallel Implementation
async function checkAsyncParallel(dir: string): Promise<boolean> {
  const results = await Promise.all([
    checkAccess(resolve(dir, 'package-lock.json')),
    checkAccess(resolve(dir, 'yarn.lock')),
    checkAccess(resolve(dir, 'pnpm-lock.yaml')),
  ]);
  return results.some((r) => r);
}

async function runBenchmark() {
  console.log('Running benchmark...');

  // Warmup
  for (let i = 0; i < 100; i++) {
    checkSync(dirs[i]);
    await checkAsyncSequential(dirs[i]);
    await checkAsyncParallel(dirs[i]);
  }

  // Measure Sync
  const startSync = performance.now();
  for (const dir of dirs) {
    checkSync(dir);
  }
  const endSync = performance.now();
  const timeSync = endSync - startSync;
  console.log(`Sync (Baseline): ${timeSync.toFixed(2)}ms`);

  // Measure Async Sequential
  const startAsyncSeq = performance.now();
  for (const dir of dirs) {
    await checkAsyncSequential(dir);
  }
  const endAsyncSeq = performance.now();
  const timeAsyncSeq = endAsyncSeq - startAsyncSeq;
  console.log(`Async Sequential: ${timeAsyncSeq.toFixed(2)}ms`);

  // Measure Async Parallel
  const startAsyncPar = performance.now();
  // We can also parallelize the loop itself for max throughput, but let's stick to per-dir parallel for now
  // ensuring we await each dir processing to be fair to the loop structure of the scanner
  for (const dir of dirs) {
    await checkAsyncParallel(dir);
  }
  const endAsyncPar = performance.now();
  const timeAsyncPar = endAsyncPar - startAsyncPar;
  console.log(`Async Parallel:   ${timeAsyncPar.toFixed(2)}ms`);

  // Cleanup
  console.log('Cleaning up...');
  rmSync(TEMP_DIR, { recursive: true, force: true });
}

runBenchmark().catch(console.error);
