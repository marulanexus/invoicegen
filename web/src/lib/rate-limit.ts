/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Suitable for single-instance / low-volume protection of sensitive endpoints.
 * For multi-instance production scale, swap this for a shared store
 * (e.g. Upstash Redis) behind the same `rateLimit()` signature.
 */

const globalForRl = globalThis as unknown as {
  __rlBuckets?: Map<string, number[]>;
};
const buckets = (globalForRl.__rlBuckets ??= new Map<string, number[]>());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000
): RateLimitResult {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (hits.length >= limit) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - hits[0])) / 1000);
    buckets.set(key, hits);
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  hits.push(now);
  buckets.set(key, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  return { ok: true, remaining: limit - hits.length };
}

/** Derive a client key from a request (best-effort IP, falls back to UA). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? req.headers.get("user-agent") ?? "anon";
}
