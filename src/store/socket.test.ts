import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSession } from "./socket";
import {
  decodeSessionMessage,
  encodeSessionMessage,
} from "./session-socket-protocol";

const createStore = (
  commit = vi.fn(),
  session: Partial<{
    playerId: string;
    sessionId: string;
    stSecret: string;
    stId: string;
    claimedSeat: number;
    isListening: boolean;
    isSpectator: boolean;
  }> = {},
) => ({
  commit,
  state: {
    players: { players: [], fabled: [] },
    session: {
      playerId: "player-1",
      sessionId: "",
      stSecret: "",
      stId: "",
      claimedSeat: -1,
      isListening: false,
      isSpectator: false,
      ...session,
    },
    grimoire: { isNight: false },
    roles: new Map(),
    states: [],
    teamsNames: {},
    firstNight: [],
    otherNight: [],
  },
});

describe("session socket message decoder", () => {
  it("decodes valid legacy envelopes", () => {
    expect(decodeSessionMessage('["ping", ["player-1", "latency"]]')).toEqual({
      command: "ping",
      params: ["player-1", "latency"],
    });
  });

  it("rejects malformed JSON and protocol envelopes", () => {
    expect(decodeSessionMessage("not json")).toBeNull();
    expect(decodeSessionMessage('[42, "payload"]')).toBeNull();
    expect(decodeSessionMessage('["setRooms", []]')).toBeNull();
    expect(decodeSessionMessage({ command: "ping" })).toBeNull();
  });

  it("encodes v1 session messages with an explicit feedback slot", () => {
    expect(encodeSessionMessage("isNight", true)).toBe(
      '["isNight",true,false]',
    );
    expect(encodeSessionMessage("feedback", 42, 42)).toBe('["feedback",42,42]');
  });

  it("releases ping and outbound queue timers when disconnected", () => {
    vi.useFakeTimers();
    const session = new LiveSession(createStore());

    session._ping();
    session._startSendQueue();
    expect(vi.getTimerCount()).toBe(2);

    session.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores malformed persisted chat messages when clearing the outbox", () => {
    const commit = vi.fn();
    const session = new LiveSession(createStore(commit, { stId: "host-a" }));
    const checkQueue = (
      session as unknown as {
        _checkQueue(message: {
          type: string;
          command: string;
          params: unknown;
          playerId: string;
          id: number;
        }): void;
      }
    )._checkQueue;

    checkQueue.call(session, {
      type: "direct",
      command: "chat",
      params: { message: "missing recipient" },
      playerId: "host",
      id: 1,
    });

    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects non-scalar session channels before opening a socket", async () => {
    const commit = vi.fn();
    const session = new LiveSession(createStore(commit));
    const disconnect = vi.spyOn(session, "disconnect");
    const alertPopup = vi
      .spyOn(session, "_alertPopup")
      .mockResolvedValue(undefined);

    await session.connect({ channel: "12" });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(alertPopup).toHaveBeenCalledWith("无效的房间号！");
    expect(commit).toHaveBeenCalledWith("session/setSessionId", "");
  });

  it("ignores malformed inbound alert payloads", async () => {
    const session = new LiveSession(createStore());
    const showModal = vi.spyOn(session, "showInputModal");

    await session._alertPopup({ text: "not an alert string" });

    expect(showModal).not.toHaveBeenCalled();
  });

  it("rejects malformed talking and timer payloads before sending", () => {
    const session = new LiveSession(createStore());
    const send = vi.spyOn(session, "_send");
    (session as unknown as { _isSpectator: boolean })._isSpectator = false;

    session.setTalking({ seatNum: "0", isTalking: true });
    session.setTimer(-1);
    session.startTimer(Number.NaN);

    expect(send).not.toHaveBeenCalled();
  });

  it("ignores non-numeric queue acknowledgements", () => {
    const commit = vi.fn();
    const session = new LiveSession(createStore(commit));

    session._deleteFromQueue("not-a-queue-id");

    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects non-integer seat claims before sending", () => {
    const session = new LiveSession(createStore());
    const sendDirect = vi.spyOn(session, "_sendDirect");

    session.claimSeat("0");

    expect(sendDirect).not.toHaveBeenCalled();
  });

  it("clears a departed seat through the session command boundary", () => {
    const commit = vi.fn();
    const session = new LiveSession(createStore(commit, { claimedSeat: 2 }));

    session._updateLeaveSeat();

    expect(commit).toHaveBeenCalledWith("session/claimSeat", -1);
  });
});

afterEach(() => vi.useRealTimers());
