// File A — contains a block that's duplicated in fileB.ts

export function helperA(): void {
  const data = [1, 2, 3, 4, 5];
  const results = [];
  for (const item of data) {
    if (item > 2) {
      results.push(item * 2);
    }
  }
  console.log(results);
}

export function uniqueToA(): string {
  return 'only in A';
}
