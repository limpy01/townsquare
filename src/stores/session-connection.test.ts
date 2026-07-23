import { beforeEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useSessionConnectionStore } from "./session-connection";

describe("session connection Pinia store", () => {
  const connection = useSessionConnectionStore(pinia);

  beforeEach(() => connection.$reset());

  it("tracks ephemeral WebSocket connection metrics", () => {
    connection.setIsReconnecting(true);
    connection.setIsHostAllowed(true);
    connection.setIsJoinAllowed(false);
    connection.setPlayerCount(6);
    connection.setPing(42);

    expect(connection.$state).toEqual({
      isReconnecting: true,
      isHostAllowed: true,
      isJoinAllowed: false,
      playerCount: 6,
      ping: 42,
    });
  });
});
