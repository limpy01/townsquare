import { describe, expect, it } from "vitest";
import {
  buildSessionSocketUrl,
  sessionTransportTiming,
} from "./session-transport-lifecycle";

describe("session transport lifecycle", () => {
  it("preserves the legacy host and spectator socket endpoints", () => {
    expect(
      buildSessionSocketUrl("wss://example.test/ws/", {
        channel: "12",
        playerId: "player-1",
        isSpectator: false,
        hostSecret: "secret",
      }),
    ).toBe("wss://example.test/ws/12/player-1/host?auth=secret");
    expect(
      buildSessionSocketUrl("wss://example.test/ws/", {
        channel: "12",
        playerId: "player-1",
        isSpectator: true,
        hostSecret: "unused",
      }),
    ).toBe("wss://example.test/ws/12/player-1");
  });

  it("keeps the legacy timing values centralized", () => {
    expect(sessionTransportTiming).toEqual({
      pingIntervalMs: 3_000,
      reconnectDelayMs: 3_000,
      sendQueueIntervalMs: 1_500,
    });
  });
});
