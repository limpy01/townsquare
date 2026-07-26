import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionWebSocketClient } from "./session-websocket-client";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly addEventListener = vi.fn();
  readonly send = vi.fn();
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly endpoint: string) {
    FakeWebSocket.instances.push(this);
  }

  close(code = 1000): void {
    this.readyState = 3;
    this.onclose?.({ code, reason: "" } as CloseEvent);
  }
}

describe("session WebSocket client", () => {
  it("delegates lifecycle callbacks and only sends through an open socket", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = new SessionWebSocketClient();
    const onMessage = vi.fn();
    const onOpen = vi.fn();
    const onClose = vi.fn();

    client.open("wss://example.test/ws", { onMessage, onOpen, onClose });
    const socket = FakeWebSocket.instances[0];
    expect(socket?.endpoint).toBe("wss://example.test/ws");
    expect(socket?.addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );

    socket?.onopen?.();
    client.send("payload");
    socket?.onclose?.({ code: 1006, reason: "interrupted" } as CloseEvent);

    expect(onOpen).toHaveBeenCalledOnce();
    expect(socket?.send).toHaveBeenCalledWith("payload");
    expect(onClose).toHaveBeenCalledWith({
      code: 1006,
      reason: "interrupted",
    });
    expect(client.isConnected).toBe(false);
  });

  it("closes an existing connection before replacing it", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const client = new SessionWebSocketClient();
    const handlers = {
      onMessage: vi.fn(),
      onOpen: vi.fn(),
      onClose: vi.fn(),
    };

    client.open("wss://example.test/first", handlers);
    const firstSocket = FakeWebSocket.instances[0];
    client.open("wss://example.test/second", handlers);

    expect(firstSocket?.readyState).toBe(3);
    expect(FakeWebSocket.instances[1]?.endpoint).toBe(
      "wss://example.test/second",
    );
  });
});

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});
