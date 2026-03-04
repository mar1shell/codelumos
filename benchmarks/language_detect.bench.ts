import { bench, describe } from 'vitest';
import { readFile, open } from 'node:fs/promises';
import { writeFileSync, unlinkSync } from 'node:fs';
import { detectLanguage } from '../src/scanner/languageMap.js';

const tempFile = 'bench_temp_file.ts';
writeFileSync(tempFile, 'console.log("hello");\n'.repeat(50000));

async function detectUnoptimized(absPath: string) {
  let firstLine: string | undefined;
  try {
    const head = await readFile(absPath, { encoding: 'utf8' });
    firstLine = head.split('\n')[0];
  } catch {}
  return detectLanguage(absPath, firstLine);
}

async function detectOptimized(absPath: string) {
  let language = detectLanguage(absPath);
  if (language === 'Unknown') {
    let firstLine: string | undefined;
    try {
      const fd = await open(absPath, 'r');
      const buf = Buffer.alloc(256);
      const { bytesRead } = await fd.read(buf, 0, 256, 0);
      await fd.close();
      const head = buf.toString('utf8', 0, bytesRead);
      firstLine = head.split('\n')[0];
    } catch {}
    language = detectLanguage(absPath, firstLine);
  }
  return language;
}

describe('Language Detection', () => {
  bench('Unoptimized (Reads entire file)', async () => {
    await detectUnoptimized(tempFile);
  });

  bench('Optimized (Avoids read if possible)', async () => {
    await detectOptimized(tempFile);
  });
});
