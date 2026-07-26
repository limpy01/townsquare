import { afterEach, describe, expect, it, vi } from "vitest";
import type { OutboxMessage } from "../stores/message-outbox";
import { SessionOutboxController } from "./session-outbox-controller";

const createMessage = (id: number): OutboxMessage => ({
  type: "broadcast",
  playerId: "",
  command: "isNight",
  params: true,
  id,
});

describe("session outbox controller", () => {
  it("flushes immediately and on its configured interval", () => {
    vi.useFakeTimers();
    const queue = [createMessage(1)];
    const transport = {
      send: vi.fn(),
      sendDirect: vi.fn(),
      request: vi.fn(),
      uploadFile: vi.fn(),
    };
    const controller = new SessionOutboxController({
      intervalMs: 1_500,
      getQueue: () => queue,
      transport,
      onAcknowledged: vi.fn(),
      deleteAt: vi.fn(),
    });

    controller.start();
    vi.advanceTimersByTime(1_500);

    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send).toHaveBeenCalledWith("isNight", true, 1);
    controller.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("acknowledges and deletes only a matching integer queue id", () => {
    const queue = [createMessage(1), createMessage(2)];
    const onAcknowledged = vi.fn();
    const deleteAt = vi.fn();
    const controller = new SessionOutboxController({
      intervalMs: 1_500,
      getQueue: () => queue,
      transport: {
        send: vi.fn(),
        sendDirect: vi.fn(),
        request: vi.fn(),
        uploadFile: vi.fn(),
      },
      onAcknowledged,
      deleteAt,
    });

    expect(controller.acknowledge("2")).toBe(false);
    expect(controller.acknowledge(3)).toBe(false);
    expect(controller.acknowledge(2)).toBe(true);
    expect(onAcknowledged).toHaveBeenCalledWith(queue[1]);
    expect(deleteAt).toHaveBeenCalledWith(1);
    expect(controller.pendingCount).toBe(2);
  });
});

afterEach(() => vi.useRealTimers());
