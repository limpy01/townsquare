import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useProfileStore } from "./profile";

describe("profile store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("tracks the player name and uploaded avatar", () => {
    const profile = useProfileStore();

    profile.setPlayerName("Alice");
    profile.updatePlayerAvatar("alice.webp");

    expect(profile.$state).toEqual({
      playerName: "Alice",
      playerAvatar: "alice.webp",
    });
  });
});
