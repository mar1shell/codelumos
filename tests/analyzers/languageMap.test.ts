import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/scanner/languageMap.js';

describe('detectLanguage', () => {
  it('detects TypeScript by extension', () => {
    expect(detectLanguage('src/foo.ts')).toBe('TypeScript');
    expect(detectLanguage('src/component.tsx')).toBe('TypeScript');
  });

  it('detects JavaScript by extension', () => {
    expect(detectLanguage('index.js')).toBe('JavaScript');
    expect(detectLanguage('app.mjs')).toBe('JavaScript');
  });

  it('detects Python by extension', () => {
    expect(detectLanguage('main.py')).toBe('Python');
    expect(detectLanguage('types.pyi')).toBe('Python');
  });

  it('detects Go by extension', () => {
    expect(detectLanguage('main.go')).toBe('Go');
  });

  it('detects Rust by extension', () => {
    expect(detectLanguage('lib.rs')).toBe('Rust');
  });

  it('detects CSS / SCSS', () => {
    expect(detectLanguage('styles.css')).toBe('CSS');
    expect(detectLanguage('styles.scss')).toBe('SCSS');
  });

  it('detects JSON / YAML', () => {
    expect(detectLanguage('config.json')).toBe('JSON');
    expect(detectLanguage('.github/workflow.yml')).toBe('YAML');
  });

  it('detects Dockerfile by filename', () => {
    expect(detectLanguage('Dockerfile')).toBe('Dockerfile');
  });

  it('detects via shebang when extension is absent', () => {
    expect(detectLanguage('myscript', '#!/usr/bin/env python3')).toBe('Python');
    expect(detectLanguage('run', '#!/bin/bash')).toBe('Shell');
    expect(detectLanguage('server', '#!/usr/bin/env node')).toBe('JavaScript');
  });

  it('returns Unknown for unrecognized files', () => {
    expect(detectLanguage('mystery.xyz')).toBe('Unknown');
  });
});
