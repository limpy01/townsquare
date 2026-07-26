import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import { useRoleActivityStore } from "../stores/role-activity";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
import persistence from "./persistence";
import { gameEvents } from "./game-events";

const createStorage = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial));
  const storage: Record<string, any> = {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: unknown) => entries.set(key, String(value)),
  };
  for (const key of Object.keys(initial)) {
    Object.defineProperty(storage, key, {
      get: () => entries.get(key),
      set: (value) => entries.set(key, String(value)),
    });
  }
  return storage;
};

afterEach(() => vi.unstubAllGlobals());

describe("persistence compatibility plugin", () => {
  beforeEach(() => {
    useChatStore(pinia).$reset();
    useLegacyOptionsStore(pinia).$reset();
    useRoleActivityStore(pinia).$reset();
    useSessionIdentityStore(pinia).$reset();
    useVotingStore(pinia).$reset();
  });

  it("restores the version-zero storage fixture without changing its values", () => {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "../../packages/test-fixtures/storage/legacy-v0.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as Record<string, string>;
    const localStorage = createStorage(fixture);
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    unsubscribe?.();

    expect(localStorage.getItem("playerAvatar")).toBe(
      fixture.playerProfileImage,
    );
    expect(localStorage.getItem("playerProfileImage")).toBeNull();
    expect(useSessionIdentityStore(pinia)).toMatchObject({
      sessionId: "room1234",
      claimedSeat: 4,
    });
    expect(useVotingStore(pinia).playerVotes).toBe(2);
    expect(useLegacyOptionsStore(pinia).useOldOrder).toEqual({
      pithag: true,
      professor: false,
    });
  });

  it("restores the legacy session tuple and persists a changed session ID", () => {
    const localStorage = createStorage({
      session: JSON.stringify([true, "room1234"]),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    expect(useSessionIdentityStore(pinia)).toMatchObject({
      isSpectator: true,
      sessionId: "room1234",
    });

    gameEvents.publish(
      { type: "session/setSessionId", payload: "nextroom" },
      { session: { isSpectator: false } },
    );

    unsubscribe?.();

    expect(localStorage.getItem("session")).toBe(
      JSON.stringify([false, "nextroom"]),
    );
  });

  it("does not let malformed persisted group chats block a new group", () => {
    const localStorage = createStorage({ groupChats: "{" });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    expect(() =>
      gameEvents.publish(
        {
          type: "session/addGroupChat",
          payload: {
            chatId: "group-a",
            players: [{ id: "player-a" }],
          },
        },
        {},
      ),
    ).not.toThrow();

    unsubscribe?.();
    expect(localStorage.getItem("groupChats")).toBe(
      JSON.stringify([{ id: "group-a", playerIds: ["player-a"], keep: false }]),
    );
  });

  it("keeps only valid legacy groups when adding a new group", () => {
    const localStorage = createStorage({
      groupChats: JSON.stringify([
        { id: "group-a", playerIds: ["player-a"], keep: true },
        { id: "bad-group", playerIds: [1] },
      ]),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    gameEvents.publish(
      {
        type: "session/addGroupChat",
        payload: {
          chatId: "group-b",
          players: [{ id: "player-b" }],
        },
      },
      {},
    );

    unsubscribe?.();
    expect(localStorage.getItem("groupChats")).toBe(
      JSON.stringify([
        { id: "group-a", playerIds: ["player-a"], keep: true },
        { id: "group-b", playerIds: ["player-b"], keep: false },
      ]),
    );
  });

  it("ignores persisted group members without string player IDs", () => {
    const localStorage = createStorage({
      groupChats: JSON.stringify([{ id: "group-a", playerIds: [1] }]),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    unsubscribe?.();

    expect(useChatStore(pinia).groups).toEqual([]);
  });

  it("drops malformed role-state records without blocking a valid update", () => {
    const localStorage = createStorage({
      isRole: JSON.stringify({ imp: "not-a-record", wraith: { active: true } }),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    gameEvents.publish(
      {
        type: "session/setIsRole",
        payload: { role: "wraith", property: "active", value: false },
      },
      {},
    );

    unsubscribe?.();
    expect(useRoleActivityStore(pinia).wraith.active).toBe(true);
    expect(localStorage.getItem("isRole")).toBeNull();
  });

  it("serializes only valid player and role records", () => {
    const localStorage = createStorage();
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence();

    gameEvents.publish(
      { type: "players/setBluff" },
      { players: { bluffs: [{ id: "imp" }, null, { id: 1 }] } },
    );
    gameEvents.publish(
      { type: "players/update" },
      {
        players: {
          players: [
            { id: "alice", role: { id: "chef" } },
            { id: "bob", role: "invalid" },
            null,
          ],
        },
      },
    );

    unsubscribe?.();

    expect(localStorage.getItem("bluffs")).toBe(JSON.stringify(["imp"]));
    expect(localStorage.getItem("players")).toBe(
      JSON.stringify([
        { id: "alice", role: "chef" },
        { id: "bob", role: {} },
      ]),
    );
  });
});
