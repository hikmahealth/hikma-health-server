type RateLimiterConfig = {
  windowMs: number;
  maxRequests: number;
};

type RateLimiterEntry = { timestamps: number[] };

/**
 * Creates an in-memory sliding-window rate limiter.
 * Tracks request timestamps per key (typically IP) and rejects
 * requests that exceed the configured threshold.
 */
export const createRateLimiter = (config: RateLimiterConfig) => {
  const store = new Map<string, RateLimiterEntry>();

  // Clean up expired entries every 60s to prevent memory leaks
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < config.windowMs,
      );
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 60_000);
  cleanup.unref?.(); // Don't prevent process from exiting

  return {
    check(
      key: string,
    ): { allowed: true } | { allowed: false; retryAfterMs: number } {
      const now = Date.now();
      const entry = store.get(key) ?? { timestamps: [] };
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < config.windowMs,
      );

      if (entry.timestamps.length >= config.maxRequests) {
        const retryAfterMs = config.windowMs - (now - entry.timestamps[0]);
        return { allowed: false, retryAfterMs };
      }

      entry.timestamps.push(now);
      store.set(key, entry);
      return { allowed: true };
    },
  };
};

/** Extract client IP from request headers. */
export const getClientIp = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
};

/** Build a 429 Too Many Requests response. */
export const tooManyRequestsResponse = (retryAfterMs: number): Response =>
  new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(retryAfterMs / 1000)),
      },
    },
  );
