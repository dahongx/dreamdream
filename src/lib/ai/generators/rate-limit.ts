/**
 * In-memory rate limiter for the AI authoring helpers.
 *
 * v1 contract: 20 calls per user per rolling hour. Stored in a single
 * Map keyed by userId; entries auto-evict when their oldest event drops
 * out of the window.
 *
 * v1 trade-off: one Vercel deploy = one Map = no per-region sync, no
 * persistence on restart. Good enough for solo creator usage; W10.5
 * would swap to Redis (Upstash) when traffic warrants it.
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_CALLS = 20;

const log = new Map<string, number[]>();

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(userId: string): RateLimitVerdict {
  const now = Date.now();
  const events = (log.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (events.length >= MAX_CALLS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: events[0] + WINDOW_MS,
    };
  }
  events.push(now);
  log.set(userId, events);
  return {
    allowed: true,
    remaining: MAX_CALLS - events.length,
    resetAt: now + WINDOW_MS,
  };
}
