import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useMessageOutboxStore } from "./message-outbox";

describe("message outbox store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });
  afterEach(() => vi.useRealTimers());

  it("queues messages and expires unique feedback guards", () => {
    const outbox = useMessageOutboxStore();
    outbox.add({
      type: "direct",
      playerId: "player",
      command: "chat",
      params: "hello",
      id: 1,
    });

    expect(outbox.checkUnique("feedback")).toBe(true);
    expect(outbox.checkUnique("feedback")).toBe(false);
    outbox.remove(0);
    vi.advanceTimersByTime(1000 * 60 * 3);

    expect(outbox.queue).toEqual([]);
    expect(outbox.checkUnique("feedback")).toBe(true);
  });
});
