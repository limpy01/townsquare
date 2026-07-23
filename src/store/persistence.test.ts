import { afterEach, describe, expect, it, vi } from "vitest";
import persistence from "./persistence";
import { mutationBus } from "./mutation-bus";

const createStorage = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial));

  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: unknown) => entries.set(key, String(value)),
  };
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
});
