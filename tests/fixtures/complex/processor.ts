// Complex TypeScript file with high cyclomatic complexity

export function processData(input: unknown[]): unknown[] {
  const results: unknown[] = [];

  for (const item of input) {
    if (typeof item === 'string') {
      if (item.length > 10) {
        results.push(item.toUpperCase());
      } else if (item.length > 5) {
        results.push(item.toLowerCase());
      } else {
        results.push(item);
      }
    } else if (typeof item === 'number') {
      if (item > 100) {
        results.push(item * 2);
      } else if (item > 50) {
        results.push(item + 10);
      } else if (item > 0) {
        results.push(item);
      } else {
        results.push(0);
      }
    } else if (Array.isArray(item)) {
      if (item.length > 0) {
        results.push(...item);
      }
    } else {
      results.push(null);
    }
  }

  return results;
}

export function validateEmail(email: string): boolean {
  if (!email) return false;
  if (email.length < 3) return false;
  if (!email.includes('@')) return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain || !domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

export function parseQueryString(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!qs) return result;
  const clean = qs.startsWith('?') ? qs.slice(1) : qs;
  for (const pair of clean.split('&')) {
    const [key, value] = pair.split('=');
    if (key && key.length > 0) {
      result[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  return result;
}
