import { afterEach, describe, expect, it, vi } from "vitest";
import { pinia } from "../pinia";
import { useLobbyStore } from "../stores/lobby";
import { useSessionIdentityStore } from "../stores/session-identity";
import LiveLobby from "./lobby-transport";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  readonly readyState = 1;
  private listeners = new Map<string, (event: any) => void>();

  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.set(type, listener);
  }

  close() {}

  emit(type: string, event: any) {
    this.listeners.get(type)?.(event);
  }
}

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});

describe("lobby transport", () => {
  it("routes a decoded room list into the Pinia lobby store", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const lobby = useLobbyStore(pinia);
    lobby.$reset();
    useSessionIdentityStore(pinia).setPlayerId("player-1");
    const transport = new LiveLobby();

    transport.connect();
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("lobby socket was not created");
    socket.emit("message", {
      data: JSON.stringify(["setRooms", ["1234", "5678"]]),
    });

    expect(lobby.rooms).toEqual(["1234", "5678"]);
    transport.disconnect();
  });

  it("ignores malformed room lists", () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const lobby = useLobbyStore(pinia);
    lobby.$reset();
    useSessionIdentityStore(pinia).setPlayerId("player-1");
    const transport = new LiveLobby();

    transport.connect();
    const socket = FakeWebSocket.instances[0];
    if (!socket) throw new Error("lobby socket was not created");
    socket.emit("message", {
      data: JSON.stringify(["setRooms", ["1234", 5678]]),
    });

    expect(lobby.rooms).toBeNull();
    transport.disconnect();
  });
});
