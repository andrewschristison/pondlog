import { describe, expect, it } from "vitest";
import { RateLimiter } from "../src/rate-limiter.js";

describe("RateLimiter", () => {
  it("starts full and decrements per acquire", async () => {
    const rl = new RateLimiter({ maxTokens: 3, refillRate: 3, refillIntervalMs: 1000 });
    expect(rl.availableTokens()).toBe(3);
    await rl.acquire();
    await rl.acquire();
    expect(rl.availableTokens()).toBe(1);
  });

  it("blocks when exhausted, resolves after refill", async () => {
    const rl = new RateLimiter({ maxTokens: 1, refillRate: 1, refillIntervalMs: 50 });
    await rl.acquire();
    const start = Date.now();
    await rl.acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });

  it("rejects invalid options", () => {
    expect(
      () => new RateLimiter({ maxTokens: 0, refillRate: 1, refillIntervalMs: 1 }),
    ).toThrow();
  });
});
