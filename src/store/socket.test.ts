import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSession } from "./socket";
import {
  decodeSessionMessage,
  encodeSessionMessage,
} from "./session-socket-protocol";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { useSessionConnectionStore } from "../stores/session-connection";
import { useSessionIdentityStore } from "../stores/session-identity";
import { usePlayersStore } from "../stores/players";
import { useVotingStore } from "../stores/voting";
import { pinia } from "../pinia";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly send = vi.fn();
  readonly addEventListener = vi.fn(
    (_event: string, _listener: EventListener) => undefined,
  );
  readyState = 1;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  close(code = 1000): void {
    this.readyState = 3;
    this.onclose?.({ code, reason: "" } as CloseEvent);
  }

  emitClose(code: number, reason = ""): void {
    this.readyState = 3;
    this.onclose?.({ code, reason } as CloseEvent);
  }
}

const setSessionIdentity = (
  state: Partial<ReturnType<typeof useSessionIdentityStore>["$state"]>,
) => useSessionIdentityStore(pinia).$patch(state);

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
    const session = new LiveSession();

    session._ping();
    session._startSendQueue();
    expect(vi.getTimerCount()).toBe(2);

    session.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores malformed persisted chat messages when clearing the outbox", () => {
    const session = new LiveSession();
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

    expect(useMessageOutboxStore(pinia).queue).toEqual([]);
  });

  it("rejects non-scalar session channels before opening a socket", async () => {
    const session = new LiveSession();
    const disconnect = vi.spyOn(session, "disconnect");
    const alertPopup = vi
      .spyOn(session, "_alertPopup")
      .mockResolvedValue(undefined);

    await session.connect({ channel: "12" });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(alertPopup).toHaveBeenCalledWith("无效的房间号！");
    expect(useSessionIdentityStore(pinia).sessionId).toBe("");
  });

  it("ignores malformed inbound alert payloads", async () => {
    const session = new LiveSession();
    const showModal = vi.spyOn(session, "showInputModal");

    await session._alertPopup({ text: "not an alert string" });

    expect(showModal).not.toHaveBeenCalled();
  });

  it("rejects malformed talking and timer payloads before sending", () => {
    const session = new LiveSession();
    const send = vi.spyOn(session, "_send");
    (session as unknown as { _isSpectator: boolean })._isSpectator = false;

    session.setTalking({ seatNum: "0", isTalking: true });
    session.setTimer(-1);
    session.startTimer(Number.NaN);

    expect(send).not.toHaveBeenCalled();
  });

  it("ignores non-numeric queue acknowledgements", () => {
    const session = new LiveSession();

    session._deleteFromQueue("not-a-queue-id");

    expect(useMessageOutboxStore(pinia).queue).toEqual([]);
  });

  it("rejects non-integer seat claims before sending", () => {
    const session = new LiveSession();
    const sendDirect = vi.spyOn(session, "_sendDirect");

    session.claimSeat("0");

    expect(sendDirect).not.toHaveBeenCalled();
  });

  it("applies inbound player and voting changes through Pinia actions", () => {
    const session = new LiveSession();
    const players = usePlayersStore(pinia);
    players.add("first");
    players.add("second");
    (session as unknown as { _isSpectator: boolean })._isSpectator = true;

    session.applyIncomingPlayerSwap([0, 1]);
    session.applyIncomingNight(true);
    session.applyIncomingVotingSpeed(250);
    session.applyIncomingVoteInProgress(true);

    expect(players.players.map((player) => player.name)).toEqual([
      "second",
      "first",
    ]);
    expect(useVotingStore(pinia)).toMatchObject({
      votingSpeed: 250,
      isVoteInProgress: true,
    });
  });

  it("clears a departed seat through the session command boundary", () => {
    setSessionIdentity({ claimedSeat: 2 });
    const session = new LiveSession();

    session._updateLeaveSeat();

    expect(useSessionIdentityStore(pinia).claimedSeat).toBe(-1);
  });

  it("reconnects an interrupted socket after the documented delay", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    setSessionIdentity({ playerId: "player-1", stSecret: "host-secret" });
    const session = new LiveSession();

    await session.connect("12");
    const firstSocket = FakeWebSocket.instances.at(-1);
    expect(firstSocket?.url).toContain("/12/player-1/host?auth=host-secret");

    firstSocket?.emitClose(1006);
    expect(useSessionConnectionStore(pinia).isReconnecting).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(FakeWebSocket.instances).toHaveLength(2);

    session.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not reconnect a deliberately closed socket", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeWebSocket);
    setSessionIdentity({ playerId: "player-1", stSecret: "host-secret" });
    const session = new LiveSession();

    await session.connect("12");
    FakeWebSocket.instances.at(-1)?.emitClose(1000);

    expect(useSessionConnectionStore(pinia).isReconnecting).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(useSessionIdentityStore(pinia).sessionId).toBe("");
    expect(useSessionIdentityStore(pinia).isSpectator).toBe(false);
  });

  it("requests spectator bootstrap data before starting ping", () => {
    vi.useFakeTimers();
    setSessionIdentity({ playerId: "player-1" });
    const session = new LiveSession();
    (session as unknown as { _isSpectator: boolean })._isSpectator = true;
    const sendDirect = vi.spyOn(session, "_sendDirect");
    const request = vi.spyOn(session, "_request");
    const send = vi.spyOn(session, "_send");

    session._onOpen();

    expect(sendDirect).toHaveBeenNthCalledWith(
      1,
      "host",
      "getGamestate",
      "player-1",
    );
    expect(sendDirect).toHaveBeenNthCalledWith(
      2,
      "host",
      "getStId",
      "player-1",
    );
    expect(request).toHaveBeenCalledWith("checkAllowJoin", "player-1");
    expect(send).toHaveBeenCalledWith("ping", ["player-1", "latency"]);

    session.disconnect();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns a timed-out join attempt to the intro state", async () => {
    vi.useFakeTimers();
    setSessionIdentity({ sessionId: "12", stSecret: "host-secret" });
    const session = new LiveSession();
    const showInputModal = vi
      .spyOn(session, "showInputModal")
      .mockResolvedValue(true);

    session.checkAllowJoin();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(showInputModal).toHaveBeenCalledWith({
      inputType: "alert",
      inputModal: "text",
      inputData: { name: ["连接失败，请重新进入房间！"] },
    });
    expect(useSessionIdentityStore(pinia).sessionId).toBe("");
    expect(useSessionIdentityStore(pinia).isSpectator).toBe(false);
  });

  it("routes queued messages in order through the unchanged v1 helpers", () => {
    const session = new LiveSession();
    const outbox = useMessageOutboxStore(pinia);
    const send = vi.spyOn(session, "_send").mockImplementation(() => undefined);
    const sendDirect = vi
      .spyOn(session, "_sendDirect")
      .mockImplementation(() => undefined);
    const request = vi
      .spyOn(session, "_request")
      .mockImplementation(() => undefined);

    outbox.add({
      type: "direct",
      playerId: "player-a",
      command: "chat",
      params: { message: "one" },
      id: 1,
    });
    outbox.add({
      type: "request",
      playerId: "host",
      command: "avatar",
      params: "player-a",
      id: 2,
    });
    outbox.add({
      type: "broadcast",
      playerId: "",
      command: "isNight",
      params: true,
      id: 3,
    });

    session._sendQueue();

    expect(sendDirect).toHaveBeenCalledWith(
      "player-a",
      "chat",
      { message: "one" },
      1,
    );
    expect(request).toHaveBeenCalledWith("avatar", "host", "player-a", 2);
    expect(send).toHaveBeenCalledWith("isNight", true, 3);
    const helperCalls = [
      sendDirect.mock.invocationCallOrder[0] ?? -1,
      request.mock.invocationCallOrder[0] ?? -1,
      send.mock.invocationCallOrder[0] ?? -1,
    ];
    expect(helperCalls).toEqual(
      [...helperCalls].sort((left, right) => left - right),
    );
  });
});

afterEach(() => {
  useMessageOutboxStore(pinia).$reset();
  useSessionConnectionStore(pinia).$reset();
  useSessionIdentityStore(pinia).$reset();
  usePlayersStore(pinia).$reset();
  useVotingStore(pinia).$reset();
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

beforeEach(() => {
  useMessageOutboxStore(pinia).$reset();
  useSessionConnectionStore(pinia).$reset();
  useSessionIdentityStore(pinia).$reset();
  usePlayersStore(pinia).$reset();
  useVotingStore(pinia).$reset();
});
