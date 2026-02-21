"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncPool = asyncPool;
// lib/asyncPool.ts
async function asyncPool(concurrency, items, worker) {
    const results = new Array(items.length);
    let i = 0;
    const runners = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length)
                return;
            results[idx] = await worker(items[idx], idx);
        }
    });
    await Promise.all(runners);
    return results;
}
