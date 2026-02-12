// lib/inflight.ts
type Entry<T> = {
  expires: number;
  promise: Promise<T>;
};

const inflight: Record<string, Entry<any>> = {};

/**
 * In-flight dedupe + TTL.
 * Hvis samme key kommer inn mens request jobber (eller nylig ferdig),
 * så gjenbrukes samme promise.
 */
export function inflightOnce<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = inflight[key];

  if (existing && existing.expires > now) {
    return existing.promise as Promise<T>;
  }

  const p = fn().finally(() => {
    // la entry bli liggende til TTL utløper (gjenbruk resultat/promise innenfor ttl)
    // (ingen cleanup her; memory footprint er liten hvis keys er begrenset)
  });

  inflight[key] = { expires: now + ttlMs, promise: p };
  return p;
}