"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inflightOnce = inflightOnce;
const inflight = {};
/**
 * In-flight dedupe + TTL.
 * Hvis samme key kommer inn mens request jobber (eller nylig ferdig),
 * så gjenbrukes samme promise.
 */
function inflightOnce(key, ttlMs, fn) {
    const now = Date.now();
    const existing = inflight[key];
    if (existing && existing.expires > now) {
        return existing.promise;
    }
    const p = fn().finally(() => {
        // la entry bli liggende til TTL utløper (gjenbruk resultat/promise innenfor ttl)
        // (ingen cleanup her; memory footprint er liten hvis keys er begrenset)
    });
    inflight[key] = { expires: now + ttlMs, promise: p };
    return p;
}
