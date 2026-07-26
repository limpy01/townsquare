import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSession } from "./socket";
import {
  decodeSessionMessage,
  encodeSessionMessage,
} from "./session-socket-protocol";

describe("session socket message decoder", () => {
  it("decodes valid legacy envelopes", () => {
    expect(decodeSessionMessage('["ping", ["player-1", "latency"]]')).toEqual({
      command: "ping",
      params: ["player-1", "latency"],
    });
  });

  it("rejects malformed JSON and protocol envelopes", () => {
    expect(decodeSessionMessage("not json")).toBeNull();
    expect(decodeSessionMessage('[42, "payload"]')).toBeNull();
    expect(decodeSessionMessage('["setRooms", []]')).toBeNull();
    expect(decodeSessionMessage({ command: "ping" })).toBeNull();
  });

  it("encodes v1 session messages with an explicit feedback slot", () => {
    expect(encodeSessionMessage("isNight", true)).toBe(
      '["isNight",true,false]',
    );
    expect(encodeSessionMessage("feedback", 42, 42)).toBe('["feedback",42,42]');
  });

  it("releases ping and outbound queue timers when disconnected", () => {
    vi.useFakeTimers();
    const session = new LiveSession({
      commit: vi.fn(),
      state: {
        players: { players: [] },
        session: { playerId: "player-1", sessionId: "" },
      },
    });

    session._ping();
    session._startSendQueue();
    expect(vi.getTimerCount()).toBe(2);

    session.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores malformed persisted chat messages when clearing the outbox", () => {
    const commit = vi.fn();
    const session = new LiveSession({
      commit,
      state: {
        players: { players: [] },
        session: { playerId: "player-1", sessionId: "", stId: "host-a" },
      },
    });
    const checkQueue = (
      session as unknown as {
        _checkQueue(message: {
          type: string;
          command: string;
          params: unknown;
          playerId: string;
          id: number;
        }): void;
      }
    )._checkQueue;

    checkQueue.call(session, {
      type: "direct",
      command: "chat",
      params: { message: "missing recipient" },
      playerId: "host",
      id: 1,
    });

    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects non-scalar session channels before opening a socket", async () => {
    const commit = vi.fn();
    const session = new LiveSession({
      commit,
      state: {
        players: { players: [] },
        session: { playerId: "player-1", sessionId: "" },
      },
    });
    const disconnect = vi.spyOn(session, "disconnect");
    const alertPopup = vi
      .spyOn(session, "_alertPopup")
      .mockResolvedValue(undefined);

    await session.connect({ channel: "12" });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(alertPopup).toHaveBeenCalledWith("无效的房间号！");
    expect(commit).toHaveBeenCalledWith("session/setSessionId", "");
  });

  it("ignores malformed inbound alert payloads", async () => {
    const session = new LiveSession({
      commit: vi.fn(),
      state: {
        players: { players: [] },
        session: { playerId: "player-1", sessionId: "" },
      },
    });
    const showModal = vi.spyOn(session, "showInputModal");

    await session._alertPopup({ text: "not an alert string" });

    expect(showModal).not.toHaveBeenCalled();
  });
});

afterEach(() => vi.useRealTimers());
