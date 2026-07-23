import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useChatStore } from "./chat";

describe("chat store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("accumulates and clears storyteller unread messages", () => {
    const chat = useChatStore();

    chat.addStorytellerUnread(1);
    chat.addStorytellerUnread(2);
    chat.addStorytellerUnread(0);
    expect(chat.storytellerUnread).toBe(3);

    chat.clearStorytellerUnread();
    expect(chat.storytellerUnread).toBe(0);
  });

  it("keeps a separate history for each chat participant", () => {
    const chat = useChatStore();
    chat.createHistory("host");
    chat.addReceivedMessage({ message: "hello", playerId: "host" });
    chat.addReceivedMessage({ message: "ignored", playerId: "missing" });

    expect(chat.histories).toEqual([{ id: "host", chat: ["hello"] }]);
  });

  it("keeps group-chat membership alongside direct-message history", () => {
    const chat = useChatStore();
    chat.groups.push({
      id: "group-1",
      name: "群聊1",
      keep: false,
      players: [{ id: "player", name: "Alice" }],
    });

    expect(chat.groups[0]).toMatchObject({ id: "group-1", keep: false });
  });
});
