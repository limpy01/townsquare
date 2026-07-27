import { describe, expect, it, vi } from "vitest";
import { createPersistenceWriter } from "./persistence-writer";

const createStorage = (initial: Record<string, string> = {}) => {
  const entries = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => entries.delete(key),
    setItem: (key: string, value: string) => entries.set(key, value),
  };
};

describe("persistence writer", () => {
  it("projects player snapshots while dropping malformed legacy records", () => {
    const storage = createStorage();
    const writer = createPersistenceWriter({
      storage,
      getChatHistories: () => undefined,
      updatePageTitle: vi.fn(),
    });

    writer(
      { type: "players/update" },
      {
        players: {
          players: [
            { id: "alice", role: { id: "chef" }, alive: true },
            { id: "bob", role: { label: "missing-id" } },
            null,
          ],
        },
      },
    );

    expect(JSON.parse(storage.getItem("players") ?? "[]")).toEqual([
      { id: "alice", role: "chef", alive: true },
      { id: "bob", role: {} },
    ]);
  });

  it("keeps vote histories in lockstep and strips transient vote fields", () => {
    const storage = createStorage({
      votes: JSON.stringify([{ id: "old" }, { id: "remove" }]),
      votesSelected: JSON.stringify([{ id: "old" }, { id: "remove" }]),
    });
    const writer = createPersistenceWriter({
      storage,
      getChatHistories: () => undefined,
      updatePageTitle: vi.fn(),
    });
    const selectedVote = { id: "new", save: true, players: ["alice"] };

    writer({ type: "session/addVoteSelected", payload: selectedVote }, {});
    writer({ type: "session/clearVoteHistory", payload: [1] }, {});

    expect(selectedVote).toEqual({ id: "new", save: false });
    expect(JSON.parse(storage.getItem("votes") ?? "[]")).toEqual([
      { id: "old" },
    ]);
    expect(JSON.parse(storage.getItem("votesSelected") ?? "[]")).toEqual([
      { id: "old" },
      { id: "new", save: false },
    ]);

    writer({ type: "session/clearVoteHistory", payload: [] }, {});
    expect(storage.getItem("votes")).toBeNull();
    expect(storage.getItem("votesSelected")).toBeNull();
  });

  it("repairs malformed groups and applies the full group lifecycle", () => {
    const storage = createStorage({
      groupChats: JSON.stringify([
        { id: "keep", playerIds: ["alice"], keep: true },
        { id: "broken", playerIds: [42] },
      ]),
    });
    const writer = createPersistenceWriter({
      storage,
      getChatHistories: () => undefined,
      updatePageTitle: vi.fn(),
    });

    writer(
      {
        type: "session/addGroupChat",
        payload: { chatId: "team", players: [{ id: "bob" }, { id: "cora" }] },
      },
      {},
    );
    writer(
      {
        type: "session/removeGroupChatMember",
        payload: { chatId: "team", player: { id: "bob" } },
      },
      {},
    );
    writer({ type: "session/toggleGroupKeep", payload: "team" }, {});
    writer(
      { type: "session/removeGroupChat", payload: { chatId: "keep" } },
      {},
    );

    expect(JSON.parse(storage.getItem("groupChats") ?? "[]")).toEqual([
      { id: "team", playerIds: ["cora"], keep: true },
    ]);
  });

  it("stores only meaningful role state and mirrors grimoire visibility", () => {
    const storage = createStorage();
    const updatePageTitle = vi.fn();
    const writer = createPersistenceWriter({
      storage,
      getChatHistories: () => undefined,
      updatePageTitle,
    });

    writer(
      {
        type: "session/setIsRole",
        payload: { role: "chef", property: "active", value: true },
      },
      {},
    );
    writer(
      {
        type: "session/setIsRole",
        payload: { role: "chef", property: "active", value: false },
      },
      {},
    );
    writer({ type: "toggleGrimoire" }, { grimoire: { isPublic: false } });
    writer({ type: "toggleGrimoire" }, { grimoire: { isPublic: true } });

    expect(storage.getItem("isRole")).toBeNull();
    expect(storage.getItem("isGrimoire")).toBeNull();
    expect(updatePageTitle).toHaveBeenNthCalledWith(1, false);
    expect(updatePageTitle).toHaveBeenNthCalledWith(2, true);
  });
});
