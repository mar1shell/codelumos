// File B — contains same block as fileA.ts (intentional duplication for testing)

export function helperB(): void {
  const data = [1, 2, 3, 4, 5];
  const results = [];
  for (const item of data) {
    if (item > 2) {
      results.push(item * 2);
    }
  }
  console.log(results);
}

export function uniqueToB(): string {
  return 'only in B';
}
