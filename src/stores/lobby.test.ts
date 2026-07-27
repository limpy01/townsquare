import { beforeEach, describe, expect, it } from "vitest";

import { pinia } from "../pinia";
import { useLobbyStore } from "./lobby";

describe("lobby Pinia store", () => {
  const lobby = useLobbyStore(pinia);

  beforeEach(() => {
    lobby.$reset();
  });

  it("updates connection state and deduplicates room lifecycle events", () => {
    lobby.setAllowReconnect(false);
    lobby.setIsReconnecting(true);
    lobby.setPing(42);
    lobby.setRooms(["1234"]);
    lobby.addRoom("1234");
    lobby.addRoom("5678");
    lobby.removeRoom("1234");

    expect(lobby.$state).toEqual({
      allowReconnect: false,
      isReconnecting: true,
      ping: 42,
      rooms: ["5678"],
    });
  });
});
