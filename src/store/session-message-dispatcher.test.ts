import { describe, expect, it, vi } from "vitest";
import {
  dispatchSessionInboundMessage,
  type SessionInboundTarget,
} from "./session-message-dispatcher";

const createTarget = (
  isSpectator: boolean,
  commit = vi.fn(),
): SessionInboundTarget =>
  ({
    _isSpectator: isSpectator,
    _store: { commit, state: { players: { players: ["player-1"] } } },
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
    const commit = vi.fn();
    const target = createTarget(true, commit);

    dispatchSessionInboundMessage(target, "nomination", undefined, undefined);

    expect(commit).toHaveBeenNthCalledWith(1, "session/addHistory", [
      "player-1",
    ]);
    expect(commit).toHaveBeenNthCalledWith(2, "session/addVoteSelected", {
      selected: false,
      players: ["player-1"],
      save: true,
    });
    expect(commit).toHaveBeenNthCalledWith(3, "session/nomination", {
      nomination: undefined,
    });
  });

  it("does not apply storyteller-only player changes to a host client", () => {
    const commit = vi.fn();
    const target = createTarget(false, commit);

    dispatchSessionInboundMessage(target, "swap", [0, 1], undefined);

    expect(commit).not.toHaveBeenCalled();
  });
});
