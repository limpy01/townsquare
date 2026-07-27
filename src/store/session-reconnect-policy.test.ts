import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionReconnectPolicy } from "./session-reconnect-policy";

describe("session reconnect policy", () => {
  it("replaces an existing retry and executes the latest callback once", () => {
    vi.useFakeTimers();
    const policy = new SessionReconnectPolicy(3_000);
    const firstRetry = vi.fn();
    const secondRetry = vi.fn();

    policy.schedule(firstRetry);
    policy.schedule(secondRetry);
    vi.advanceTimersByTime(3_000);

    expect(firstRetry).not.toHaveBeenCalled();
    expect(secondRetry).toHaveBeenCalledOnce();
  });

  it("cancels a scheduled retry", () => {
    vi.useFakeTimers();
    const policy = new SessionReconnectPolicy(3_000);
    const retry = vi.fn();

    policy.schedule(retry);
    policy.cancel();
    vi.advanceTimersByTime(3_000);

    expect(retry).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.useRealTimers());
