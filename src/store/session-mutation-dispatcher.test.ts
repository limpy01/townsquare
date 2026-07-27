import { describe, expect, it, vi } from "vitest";
import {
  dispatchSessionMutation,
  type SessionOutboundState,
  type SessionOutboundTarget,
} from "./session-mutation-dispatcher";

function createTarget() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    distributeGrimoire: vi.fn(),
    sendPlayer: vi.fn(),
    sendPlayerPronouns: vi.fn(),
    _stopSendQueue: vi.fn(),
    getPendingMessageCount: vi.fn(() => 0),
    setIsReview: vi.fn(),
  } as unknown as SessionOutboundTarget;
}

function createState(
  session: Partial<SessionOutboundState["session"]> = {},
): SessionOutboundState {
  return {
    session: {
      sessionId: undefined,
      ...session,
    },
  };
}

describe("dispatchSessionMutation", () => {
  it("connects or disconnects when the session id changes", () => {
    const target = createTarget();

    dispatchSessionMutation(
      target,
      { type: "session/setSessionId" },
      createState({ sessionId: "room-1" }),
    );
    dispatchSessionMutation(
      target,
      { type: "session/setSessionId" },
      createState(),
    );

    expect(target.connect).toHaveBeenCalledWith("room-1");
    expect(target.disconnect).toHaveBeenCalledOnce();
  });

  it("sends pronoun updates through their dedicated command", () => {
    const target = createTarget();
    const pronouns = { property: "pronouns", value: "they/them" };
    const name = { property: "name", value: "Pat" };

    dispatchSessionMutation(
      target,
      { type: "players/update", payload: pronouns },
      createState(),
    );
    dispatchSessionMutation(
      target,
      { type: "players/update", payload: name },
      createState(),
    );

    expect(target.sendPlayerPronouns).toHaveBeenCalledWith(pronouns);
    expect(target.sendPlayer).toHaveBeenCalledWith(name);
  });

  it("only stops the send queue after its final item is removed", () => {
    const target = createTarget();

    (target.getPendingMessageCount as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(0);
    dispatchSessionMutation(
      target,
      { type: "session/deleteMessageQueue" },
      createState(),
    );
    dispatchSessionMutation(
      target,
      { type: "session/deleteMessageQueue" },
      createState(),
    );

    expect(target._stopSendQueue).toHaveBeenCalledOnce();
  });

  it("distributes the full grimoire when review mode is enabled", () => {
    const target = createTarget();

    dispatchSessionMutation(
      target,
      { type: "session/setIsReview", payload: true },
      createState(),
    );

    expect(target.setIsReview).toHaveBeenCalledWith(true);
    expect(target.distributeGrimoire).toHaveBeenCalledWith({ all: true });
  });
});
