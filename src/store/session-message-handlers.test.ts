import { describe, expect, it, vi } from "vitest";
import { handleChatMessage } from "./session-message-handlers/chat";
import { handleConnectionMessage } from "./session-message-handlers/connection";
import { handleGameStateMessage } from "./session-message-handlers/game-state";
import { handlePlayerMessage } from "./session-message-handlers/player";
import { handleVotingMessage } from "./session-message-handlers/voting";
import type { SessionInboundTarget } from "./session-message-target";

const createTarget = (
  isSpectator: boolean,
  commit = vi.fn(),
): SessionInboundTarget =>
  ({
    _isSpectator: isSpectator,
    _store: { commit, state: { players: { players: ["player-1"] } } },
  }) as unknown as SessionInboundTarget;

describe("session message domain handlers", () => {
  it("routes connection lifecycle commands and preserves claim ordering", () => {
    const target = createTarget(true);
    target._updateSeat = vi.fn();
    target._createChatHistory = vi.fn();

    expect(handleConnectionMessage(target, "claim", [1, true])).toBe(true);
    expect(target._updateSeat).toHaveBeenCalledWith([1, true]);
    expect(target._createChatHistory).toHaveBeenCalledWith([1, true]);
  });

  it("routes game state messages and leaves unrelated commands untouched", () => {
    const target = createTarget(true);
    target._updateGamestate = vi.fn();

    expect(handleGameStateMessage(target, "gs", { gamestate: [] })).toBe(true);
    expect(target._updateGamestate).toHaveBeenCalledWith({ gamestate: [] });
    expect(handleGameStateMessage(target, "chat", {})).toBe(false);
  });

  it("keeps storyteller clients from applying player list mutations", () => {
    const commit = vi.fn();
    const host = createTarget(false, commit);
    const spectator = createTarget(true, commit);

    expect(handlePlayerMessage(host, "swap", [0, 1])).toBe(true);
    expect(commit).not.toHaveBeenCalled();
    expect(handlePlayerMessage(spectator, "swap", [0, 1])).toBe(true);
    expect(commit).toHaveBeenCalledWith("players/swap", [0, 1]);
  });

  it("records a spectator nomination close before replacing nomination state", () => {
    const commit = vi.fn();
    const target = createTarget(true, commit);

    expect(handleVotingMessage(target, "nomination", undefined)).toBe(true);
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

  it("forwards chat feedback without applying it to another domain", () => {
    const target = createTarget(true);
    target._handleChat = vi.fn();

    expect(
      handleChatMessage(target, "chat", { message: "hello" }, "feedback-1"),
    ).toBe(true);
    expect(target._handleChat).toHaveBeenCalledWith(
      { message: "hello" },
      "feedback-1",
    );
  });
});
