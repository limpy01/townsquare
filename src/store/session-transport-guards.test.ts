import { describe, expect, it } from "vitest";
import {
  gameStatePlayerProperties,
  isAddGroupChatPayload,
  isChatOutboxPayload,
  isLegacyRuntimeRole,
  isSessionOutboundState,
  isTimerSeconds,
  parseSetTalkingPayload,
} from "./session-transport-guards";

describe("session transport guards", () => {
  it("accepts the stable outbound payload shapes", () => {
    expect(isLegacyRuntimeRole({ id: "imp" })).toBe(true);
    expect(
      isChatOutboxPayload({ message: "hello", receivingPlayerId: "player-a" }),
    ).toBe(true);
    expect(
      isAddGroupChatPayload({
        chatId: "group-a",
        players: [{ id: "player-a", name: "Alice" }],
      }),
    ).toBe(true);
    expect(isSessionOutboundState({ session: { sessionId: "room" } })).toBe(
      true,
    );
    expect(parseSetTalkingPayload({ seatNum: 2, isTalking: true })).toEqual({
      seatNum: 2,
      isTalking: true,
    });
    expect(isTimerSeconds(0)).toBe(true);
    expect(gameStatePlayerProperties).toContain("votes");
  });

  it("rejects malformed transport values before they reach a session", () => {
    expect(isLegacyRuntimeRole({ id: 1 })).toBe(false);
    expect(isChatOutboxPayload({ message: "hello" })).toBe(false);
    expect(
      isAddGroupChatPayload({ chatId: "group-a", players: [{ id: 1 }] }),
    ).toBe(false);
    expect(isSessionOutboundState({ session: null })).toBe(false);
    expect(
      parseSetTalkingPayload({ seatNum: "2", isTalking: true }),
    ).toBeNull();
    expect(isTimerSeconds(-1)).toBe(false);
    expect(isTimerSeconds(Number.NaN)).toBe(false);
  });
});
