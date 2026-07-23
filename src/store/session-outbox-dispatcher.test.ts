import { describe, expect, it, vi } from "vitest";

import { dispatchSessionOutboxMessage } from "./session-outbox-dispatcher";

const createTransport = () => ({
  send: vi.fn(),
  sendDirect: vi.fn(),
  request: vi.fn(),
  uploadFile: vi.fn(),
});

describe("session outbox dispatcher", () => {
  it("routes persisted queue entries through their v1 transport helpers", () => {
    const transport = createTransport();

    dispatchSessionOutboxMessage(
      {
        type: "direct",
        playerId: "player-a",
        command: "chat",
        params: { message: "hello" },
        id: 1,
      },
      transport,
    );
    dispatchSessionOutboxMessage(
      {
        type: "request",
        playerId: "host",
        command: "deleteMessage",
        params: ["direct", 1],
        id: 2,
      },
      transport,
    );
    dispatchSessionOutboxMessage(
      {
        type: "uploadFile",
        playerId: "player-a",
        command: "uploadAvatar",
        params: "data:image/png;base64,AA==",
        id: 3,
      },
      transport,
    );
    dispatchSessionOutboxMessage(
      {
        type: "broadcast",
        playerId: "",
        command: "isNight",
        params: true,
        id: 4,
      },
      transport,
    );

    expect(transport.sendDirect).toHaveBeenCalledWith(
      "player-a",
      "chat",
      { message: "hello" },
      1,
    );
    expect(transport.request).toHaveBeenCalledWith(
      "deleteMessage",
      "host",
      ["direct", 1],
      2,
    );
    expect(transport.uploadFile).toHaveBeenCalledWith(
      "uploadAvatar",
      "player-a",
      "data:image/png;base64,AA==",
      3,
    );
    expect(transport.send).toHaveBeenCalledWith("isNight", true, 4);
  });
});
