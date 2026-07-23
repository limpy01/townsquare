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
});
