import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSessionIdentityStore } from "./session-identity";

describe("session identity store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("normalizes room IDs and tracks player session identity", () => {
    const identity = useSessionIdentityStore();
    identity.setSessionId("Room ID! 123456789");
    identity.setSpectator(true);
    identity.setPlayerId("player-a");
    identity.claimSeat(3);

    expect(identity.$state).toMatchObject({
      sessionId: "roomid1234",
      isSpectator: true,
      playerId: "player-a",
      claimedSeat: 3,
    });
  });
});
