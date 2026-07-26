import { describe, expect, it, vi } from "vitest";
import {
  dispatchSessionInboundMessage,
  type SessionInboundTarget,
} from "./session-message-dispatcher";

const createTarget = (isSpectator: boolean): SessionInboundTarget =>
  ({
    _isSpectator: isSpectator,
    applyIncomingPlayerSwap: vi.fn(),
    applyIncomingPlayerMove: vi.fn(),
    applyIncomingPlayerRemove: vi.fn(),
    applyIncomingNomination: vi.fn(),
    applyIncomingMarkedPlayer: vi.fn(),
    applyIncomingNight: vi.fn(),
    applyIncomingVoteHistoryAllowed: vi.fn(),
    applyIncomingVotingSpeed: vi.fn(),
    applyIncomingVoteInProgress: vi.fn(),
    clearIncomingVoteHistory: vi.fn(),
  }) as unknown as SessionInboundTarget;

describe("session inbound message dispatcher", () => {
  it("routes feedback-bearing chat messages to the transport handler", () => {
    const target = createTarget(true);
    const handleChat = vi.fn();
    target._handleChat = handleChat;

    const params = { message: "hello" };
    dispatchSessionInboundMessage(target, "chat", params, "feedback-1");

    expect(handleChat).toHaveBeenCalledWith(params, "feedback-1");
  });

  it("records a spectator nomination close before updating nomination state", () => {
    const target = createTarget(true);

    dispatchSessionInboundMessage(target, "nomination", undefined, undefined);

    expect(target.applyIncomingNomination).toHaveBeenCalledWith(undefined);
  });

  it("does not apply storyteller-only player changes to a host client", () => {
    const target = createTarget(false);

    dispatchSessionInboundMessage(target, "swap", [0, 1], undefined);

    expect(target.applyIncomingPlayerSwap).not.toHaveBeenCalled();
  });
});
