import { describe, expect, it, vi } from "vitest";
import { hydratePersistence } from "./persistence-hydrator";

const createStorage = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => entries.set(key, value),
  };
};

describe("persistence hydrator", () => {
  it("restores independent session, chat, group, and role-state snapshots", () => {
    const commit = vi.fn();
    hydratePersistence(
      { commit, state: { roles: new Map([["chef", { id: "chef" }]]) } },
      createStorage({
        claimedSeat: "4",
        session: JSON.stringify([true, "room1234"]),
        playerVotes: "2",
        chatHistory: JSON.stringify([
          { id: "alice", chat: [{ text: "hello" }] },
          { id: 42, chat: [] },
        ]),
        groupChats: JSON.stringify([
          { id: "team", playerIds: ["alice", "bob"], keep: true },
          { id: "broken", playerIds: [1] },
        ]),
        isRole: JSON.stringify({ chef: { active: true } }),
      }),
    );

    expect(commit).toHaveBeenCalledWith("session/claimSeat", 4);
    expect(commit).toHaveBeenCalledWith("session/setSpectator", true);
    expect(commit).toHaveBeenCalledWith("session/setSessionId", "room1234");
    expect(commit).toHaveBeenCalledWith("session/setPlayerVotes", 2);
    expect(commit).toHaveBeenCalledWith("session/createChatHistory", "alice");
    expect(commit).toHaveBeenCalledWith("session/updateChatReceived", {
      playerId: "alice",
      message: { text: "hello" },
    });
    expect(commit).toHaveBeenCalledWith("session/addGroupChat", {
      chatId: "team",
      playerIds: ["alice", "bob"],
      keep: true,
    });
    expect(commit).toHaveBeenCalledWith("session/setIsRole", {
      role: "chef",
      property: "active",
      value: true,
      st: true,
    });
  });

  it("rejects malformed schema-backed values without blocking valid recovery", () => {
    const commit = vi.fn();
    hydratePersistence(
      { commit, state: {} },
      createStorage({
        claimedSeat: "-3",
        session: JSON.stringify(["not-a-boolean", 42]),
        playerVotes: "Infinity",
        isReview: JSON.stringify("yes"),
        secretVote: JSON.stringify({ value: true }),
        stId: "host-id",
      }),
    );

    expect(commit).toHaveBeenCalledWith("session/setStId", "host-id");
    expect(commit).not.toHaveBeenCalledWith(
      "session/claimSeat",
      expect.anything(),
    );
    expect(commit).not.toHaveBeenCalledWith(
      "session/setSessionId",
      expect.anything(),
    );
    expect(commit).not.toHaveBeenCalledWith(
      "session/setPlayerVotes",
      expect.anything(),
    );
    expect(commit).not.toHaveBeenCalledWith(
      "session/setIsReview",
      expect.anything(),
    );
    expect(commit).not.toHaveBeenCalledWith(
      "session/setSecretVote",
      expect.anything(),
    );
  });
});
