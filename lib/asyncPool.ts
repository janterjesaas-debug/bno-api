// lib/asyncPool.ts
export async function asyncPool<T, R>(
  concurrency: number,
  items: T[],
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;

  const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
  return results;
}