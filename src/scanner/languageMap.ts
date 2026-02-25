// ---------------------------------------------------------------------------
// Language detection by file extension and shebang line
// ---------------------------------------------------------------------------

/** Map from file extension (without dot) to language display name */
const EXTENSION_MAP: Record<string, string> = {
  // TypeScript
  ts: 'TypeScript',
  tsx: 'TypeScript',
  mts: 'TypeScript',
  cts: 'TypeScript',
  // JavaScript
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  // Python
  py: 'Python',
  pyw: 'Python',
  pyi: 'Python',
  // Go
  go: 'Go',
  // Rust
  rs: 'Rust',
  // Java
  java: 'Java',
  // C / C++
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cxx: 'C++',
  cc: 'C++',
  hpp: 'C++',
  hxx: 'C++',
  // C#
  cs: 'C#',
  // Ruby
  rb: 'Ruby',
  // PHP
  php: 'PHP',
  // Swift
  swift: 'Swift',
  // Kotlin
  kt: 'Kotlin',
  kts: 'Kotlin',
  // Scala
  scala: 'Scala',
  sc: 'Scala',
  // Shell
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  fish: 'Shell',
  // CSS / styling
  css: 'CSS',
  scss: 'SCSS',
  sass: 'SCSS',
  less: 'LESS',
  // HTML / templates
  html: 'HTML',
  htm: 'HTML',
  vue: 'Vue',
  svelte: 'Svelte',
  // Markup / data
  md: 'Markdown',
  mdx: 'Markdown',
  json: 'JSON',
  jsonc: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  svg: 'XML',
  // Config
  env: 'Dotenv',
  // SQL
  sql: 'SQL',
  // GraphQL
  graphql: 'GraphQL',
  gql: 'GraphQL',
  // Protocol Buffers
  proto: 'Protobuf',
  // Terraform
  tf: 'Terraform',
  tfvars: 'Terraform',
  // Dockerfile
  dockerfile: 'Dockerfile',
};

/** Map from shebang interpreter to language */
const SHEBANG_MAP: Record<string, string> = {
  node: 'JavaScript',
  'ts-node': 'TypeScript',
  python: 'Python',
  python3: 'Python',
  ruby: 'Ruby',
  bash: 'Shell',
  sh: 'Shell',
  zsh: 'Shell',
  perl: 'Perl',
  php: 'PHP',
};

/**
 * Detect the language of a file given its path and optionally the first line
 * of its content (for shebang detection).
 */
export function detectLanguage(filePath: string, firstLine?: string): string {
  const basename = filePath.split('/').pop() ?? filePath;
  const lowerBasename = basename.toLowerCase();

  // Special filenames with no extension
  if (lowerBasename === 'dockerfile') return 'Dockerfile';
  if (lowerBasename === 'makefile' || lowerBasename === 'gnumakefile') return 'Makefile';
  if (lowerBasename === 'gemfile' || lowerBasename === 'rakefile') return 'Ruby';
  if (lowerBasename === 'pipfile') return 'Python';

  // Dotfiles — ignore-style and config files with no meaningful extension
  const IGNORE_DOTFILES = new Set([
    '.gitignore',
    '.gitattributes',
    '.gitmodules',
    '.dockerignore',
    '.npmignore',
    '.prettierignore',
    '.eslintignore',
    '.hgignore',
    '.bzrignore',
    '.cvsignore',
  ]);
  if (IGNORE_DOTFILES.has(lowerBasename)) return 'Ignore';

  const CONFIG_DOTFILES: Record<string, string> = {
    '.editorconfig': 'Config',
    '.env': 'Dotenv',
    '.npmrc': 'Config',
    '.yarnrc': 'Config',
    '.babelrc': 'JSON',
    '.prettierrc': 'JSON',
    '.eslintrc': 'JSON',
    '.stylelintrc': 'JSON',
    '.browserslistrc': 'Config',
    '.nvmrc': 'Config',
    '.node-version': 'Config',
    '.python-version': 'Config',
    '.ruby-version': 'Config',
    '.tool-versions': 'Config',
  };
  if (CONFIG_DOTFILES[lowerBasename] !== undefined) return CONFIG_DOTFILES[lowerBasename];

  // .env.* variants — e.g. .env.local, .env.production
  if (lowerBasename.startsWith('.env.') || lowerBasename === '.env') return 'Dotenv';

  // Extension-based detection
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = basename.slice(dotIndex + 1).toLowerCase();
    const fromExt = EXTENSION_MAP[ext];
    if (fromExt !== undefined) return fromExt;
  }

  // Shebang-based detection
  if (firstLine?.startsWith('#!')) {
    const parts = firstLine.replace('#!', '').trim().split(/\s+/);
    // Handle /usr/bin/env python3 style
    const interpreter = parts[parts.length - 1]?.split('/').pop() ?? '';
    const fromShebang = SHEBANG_MAP[interpreter];
    if (fromShebang !== undefined) return fromShebang;
  }

  return 'Unknown';
}

/**
 * Returns all known language names (for filtering etc.)
 */
export function knownLanguages(): string[] {
  return [...new Set(Object.values(EXTENSION_MAP))];
}
