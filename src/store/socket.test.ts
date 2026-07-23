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
});

afterEach(() => vi.useRealTimers());
