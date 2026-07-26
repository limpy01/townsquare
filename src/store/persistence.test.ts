import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
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
    const commit = vi.fn();
    const unsubscribe = persistence({ commit, getters: {}, state: {} });

    unsubscribe?.();

    expect(localStorage.getItem("playerAvatar")).toBe(
      fixture.playerProfileImage,
    );
    expect(localStorage.getItem("playerProfileImage")).toBeNull();
    expect(commit).toHaveBeenCalledWith("session/setSessionId", "room1234");
    expect(commit).toHaveBeenCalledWith("session/claimSeat", 4);
    expect(commit).toHaveBeenCalledWith("session/setPlayerVotes", 2);
    expect(commit).toHaveBeenCalledWith("session/setUseOldOrder", {
      pithag: true,
      professor: false,
    });
  });

  it("restores the legacy session tuple and persists a changed session ID", () => {
    const localStorage = createStorage({
      session: JSON.stringify([true, "room1234"]),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const commit = vi.fn();
    const unsubscribe = persistence({
      commit,
      getters: {},
      state: {},
    });

    expect(commit).toHaveBeenCalledWith("session/setSpectator", true);
    expect(commit).toHaveBeenCalledWith("session/setSessionId", "room1234");

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
    const unsubscribe = persistence({ commit: vi.fn(), state: {} });

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
    const unsubscribe = persistence({ commit: vi.fn(), state: {} });

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
    const commit = vi.fn();
    const unsubscribe = persistence({ commit, state: {} });

    unsubscribe?.();

    expect(commit).not.toHaveBeenCalledWith(
      "session/addGroupChat",
      expect.anything(),
    );
  });

  it("drops malformed role-state records without blocking a valid update", () => {
    const localStorage = createStorage({
      isRole: JSON.stringify({ imp: "not-a-record", chef: { active: true } }),
    });
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const commit = vi.fn();
    const unsubscribe = persistence({ commit, state: {} });

    gameEvents.publish(
      {
        type: "session/setIsRole",
        payload: { role: "chef", property: "active", value: false },
      },
      {},
    );

    unsubscribe?.();
    expect(commit).toHaveBeenCalledWith("session/setIsRole", {
      role: "chef",
      property: "active",
      value: true,
      st: true,
    });
    expect(localStorage.getItem("isRole")).toBeNull();
  });

  it("serializes only valid player and role records", () => {
    const localStorage = createStorage();
    vi.stubGlobal("window", { location: { pathname: "/" }, localStorage });
    const unsubscribe = persistence({ commit: vi.fn(), state: {} });

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
