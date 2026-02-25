import { readFileContent } from '../scanner/fileScanner.js';
import type { ScannedFile, LocResult, LocFileResult, LocLanguageSummary } from '../types.js';

// ---------------------------------------------------------------------------
// Comment syntax per language
// ---------------------------------------------------------------------------

interface CommentSyntax {
  single: RegExp[];
  blockStart: RegExp;
  blockEnd: RegExp;
}

const COMMENT_SYNTAX: Partial<Record<string, CommentSyntax>> = {
  TypeScript: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  JavaScript: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  'C++': {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  C: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  'C#': {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Java: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Go: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Rust: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Swift: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Kotlin: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Scala: {
    single: [/^\s*\/\//],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
  Python: {
    single: [/^\s*#/],
    blockStart: /^(\s*"""|''')/,
    blockEnd: /"""|'''/,
  },
  Ruby: {
    single: [/^\s*#/],
    blockStart: /^=begin/,
    blockEnd: /^=end/,
  },
  Shell: {
    single: [/^\s*#/],
    blockStart: /(?!)/,
    blockEnd: /(?!)/,
  },
  PHP: {
    single: [/^\s*\/\//, /^\s*#/],
    blockStart: /\/\*/,
    blockEnd: /\*\//,
  },
};

// ---------------------------------------------------------------------------
// Line classifier
// ---------------------------------------------------------------------------

interface LineStats {
  total: number;
  code: number;
  blank: number;
  comment: number;
}

function classifyLines(content: string, language: string): LineStats {
  const syntax = COMMENT_SYNTAX[language];
  const lines = content.split('\n');
  let blank = 0;
  let comment = 0;
  let inBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      blank++;
      continue;
    }

    if (syntax) {
      // Check for block comment end
      if (inBlock) {
        comment++;
        if (syntax.blockEnd.test(line)) {
          inBlock = false;
        }
        continue;
      }

      // Check for single-line comment
      if (syntax.single.some((re) => re.test(line))) {
        comment++;
        continue;
      }

      // Check for block comment start
      if (syntax.blockStart.test(line)) {
        comment++;
        // Check if it also ends on same line
        if (!syntax.blockEnd.test(line.replace(syntax.blockStart, ''))) {
          inBlock = true;
        }
        continue;
      }
    }

    // It's a code line
    void line; // used above
  }

  const total = lines.length;
  const code = total - blank - comment;

  return { total, code, blank, comment };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function analyzeLocForFiles(
  files: ScannedFile[],
  contentCache?: Map<string, string>,
): Promise<LocResult> {
  const fileResults: LocFileResult[] = [];
  const langMap = new Map<string, LocLanguageSummary>();

  for (const file of files) {
    const content = await readFileContent(file.path, contentCache);
    if (content === null) continue;

    const stats = classifyLines(content, file.language);

    const fileResult: LocFileResult = {
      path: file.relativePath,
      language: file.language,
      ...stats,
    };
    fileResults.push(fileResult);

    // Aggregate per language
    const existing = langMap.get(file.language);
    if (existing === undefined) {
      langMap.set(file.language, {
        language: file.language,
        files: 1,
        total: stats.total,
        code: stats.code,
        blank: stats.blank,
        comment: stats.comment,
      });
    } else {
      existing.files++;
      existing.total += stats.total;
      existing.code += stats.code;
      existing.blank += stats.blank;
      existing.comment += stats.comment;
    }
  }

  const byLanguage = [...langMap.values()].sort((a, b) => b.code - a.code);

  const totals = fileResults.reduce(
    (acc, f) => ({
      files: acc.files + 1,
      total: acc.total + f.total,
      code: acc.code + f.code,
      blank: acc.blank + f.blank,
      comment: acc.comment + f.comment,
    }),
    { files: 0, total: 0, code: 0, blank: 0, comment: 0 },
  );

  return { files: fileResults, byLanguage, totals };
}

/** Exported for testing */
export { classifyLines };
