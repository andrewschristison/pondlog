export interface RateLimiterOptions {
  maxTokens: number;
  refillRate: number;
  refillIntervalMs: number;
}

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillIntervalMs: number;
  private lastRefill: number;
  private waiters: Array<() => void> = [];

  constructor(opts: RateLimiterOptions) {
    if (opts.maxTokens <= 0 || opts.refillRate <= 0 || opts.refillIntervalMs <= 0) {
      throw new Error("RateLimiter: maxTokens, refillRate, and refillIntervalMs must be positive");
    }
    this.maxTokens = opts.maxTokens;
    this.refillRate = opts.refillRate;
    this.refillIntervalMs = opts.refillIntervalMs;
    this.tokens = opts.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const tokensToAdd = (elapsed / this.refillIntervalMs) * this.refillRate;
    if (tokensToAdd >= 1) {
      this.tokens = Math.min(this.maxTokens, this.tokens + Math.floor(tokensToAdd));
      this.lastRefill = now;
      this.drainWaiters();
    }
  }

  private drainWaiters(): void {
    while (this.waiters.length > 0 && this.tokens >= 1) {
      const next = this.waiters.shift();
      if (!next) break;
      this.tokens -= 1;
      next();
    }
  }

  private msUntilNextToken(): number {
    const msPerToken = this.refillIntervalMs / this.refillRate;
    const elapsed = Date.now() - this.lastRefill;
    const remainder = elapsed % msPerToken;
    return Math.max(1, msPerToken - remainder);
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiters.push(resolve);
      const tick = (): void => {
        this.refill();
        if (this.waiters.length > 0) {
          setTimeout(tick, this.msUntilNextToken());
        }
      };
      setTimeout(tick, this.msUntilNextToken());
    });
  }

  /** For tests/diagnostics. */
  availableTokens(): number {
    this.refill();
    return this.tokens;
  }
}
