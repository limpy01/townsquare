import { afterEach, describe, expect, it, vi } from "vitest";
import persistence from "./persistence";
import { mutationBus } from "./mutation-bus";

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

    mutationBus.emit(
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
      mutationBus.emit(
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
});
