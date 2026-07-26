import { beforeEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { usePlayersStore } from "../stores/players";
import { useRoleActivityStore } from "../stores/role-activity";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
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
  beforeEach(() => {
    useChatStore(pinia).$reset();
    usePlayersStore(pinia).$reset();
    useRoleActivityStore(pinia).$reset();
    useSessionIdentityStore(pinia).$reset();
    useVotingStore(pinia).$reset();
  });

  it("restores session, chat, group, and role-state snapshots through Pinia actions", () => {
    const players = usePlayersStore(pinia);
    players.setPlayers([{ id: "alice" }, { id: "bob" }]);

    hydratePersistence(
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
        isRole: JSON.stringify({ wraith: { active: true } }),
      }),
    );

    expect(useSessionIdentityStore(pinia)).toMatchObject({
      claimedSeat: 4,
      isSpectator: true,
      sessionId: "room1234",
    });
    expect(useVotingStore(pinia).playerVotes).toBe(2);
    expect(useChatStore(pinia).histories).toEqual([
      { id: "alice", chat: [{ text: "hello" }] },
    ]);
    expect(useChatStore(pinia).groups).toEqual([
      expect.objectContaining({ id: "team", keep: true }),
    ]);
    expect(useRoleActivityStore(pinia).wraith.active).toBe(true);
  });

  it("rejects malformed schema-backed values without blocking valid recovery", () => {
    hydratePersistence(
      createStorage({
        claimedSeat: "-3",
        session: JSON.stringify(["not-a-boolean", 42]),
        playerVotes: "Infinity",
        isReview: JSON.stringify("yes"),
        secretVote: JSON.stringify({ value: true }),
        stId: "host-id",
      }),
    );

    expect(useSessionIdentityStore(pinia)).toMatchObject({
      stId: "host-id",
      claimedSeat: -1,
      sessionId: "",
    });
    expect(useVotingStore(pinia).playerVotes).toBe(1);
  });
});
