import { afterEach, describe, expect, it, vi } from "vitest";
import { pinia } from "../pinia";
import { useChatStore } from "../stores/chat";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { usePlayersStore } from "../stores/players";
import { useProfileStore } from "../stores/profile";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useVotingStore } from "../stores/voting";
import { SessionChatController } from "./session-chat-controller";
import { SessionPlayerDeliveryController } from "./session-player-delivery-controller";
import { SessionSeatController } from "./session-seat-controller";
import { SessionVotingController } from "./session-voting-controller";

const resetStores = () => {
  useChatStore(pinia).$reset();
  usePlayersStore(pinia).$reset();
  useProfileStore(pinia).$reset();
  useSessionIdentityStore(pinia).$reset();
  useMessageOutboxStore(pinia).$reset();
  useVotingStore(pinia).$reset();
};

describe("session domain controllers", () => {
  it("sends each seated player only their assigned role", () => {
    const players = usePlayersStore(pinia);
    const first = players.add("First");
    const second = players.add("Second");
    first.id = "first";
    second.id = "second";
    first.role = { id: "washerwoman", team: "townsfolk" };
    second.role = { id: "imp", team: "demon" };
    const send = vi.fn();
    const controller = new SessionPlayerDeliveryController({
      isSpectator: () => false,
      send,
      sendDirect: vi.fn(),
    });

    controller.distributeRoles();

    expect(send).toHaveBeenCalledWith("direct", {
      first: ["player", { index: 0, property: "role", value: "washerwoman" }],
      second: ["player", { index: 1, property: "role", value: "imp" }],
    });
  });

  it("keeps nomination, secret vote and vote traffic on the v1 commands", () => {
    const players = usePlayersStore(pinia);
    const first = players.add("First");
    const second = players.add("Second");
    first.id = "first";
    second.id = "second";
    first.role = { id: "washerwoman", team: "townsfolk" };
    second.role = { id: "imp", team: "demon" };
    const voting = useVotingStore(pinia);
    voting.setNomination([0, 1], { isSecretVote: false, claimedSeat: -1 });
    voting.vote([0, true]);
    const send = vi.fn();
    const controller = new SessionVotingController({
      isSpectator: () => false,
      send,
      sendDirect: vi.fn(),
    });

    controller.nomination([0, 1]);
    controller.setSecretVote(true);
    controller.vote([0]);
    controller.setVoteInProgress();
    controller.nomination(undefined);

    expect(send).toHaveBeenNthCalledWith(1, "votingSpeed", 500);
    expect(send).toHaveBeenNthCalledWith(2, "nomination", [0, 1]);
    expect(send).toHaveBeenNthCalledWith(3, "secretVote", true);
    expect(send).toHaveBeenNthCalledWith(4, "vote", [0, true, true]);
    expect(send).toHaveBeenNthCalledWith(5, "isVoteInProgress", false);
    expect(send).toHaveBeenNthCalledWith(6, "votingSpeed", 500);
    expect(send).toHaveBeenNthCalledWith(7, "nomination", null);
  });

  it("queues group chat membership for every selected player", () => {
    const chat = useChatStore(pinia);
    chat.addGroup({
      chatId: "group-1",
      players: [
        { id: "first", name: "First" },
        { id: "second", name: "Second" },
      ],
    });
    const controller = new SessionChatController({
      isSpectator: () => false,
      request: vi.fn(),
      queueChat: vi.fn(),
      addGroupChat: vi.fn(),
      removeGroupChat: vi.fn(),
      removeGroupChatMember: vi.fn(),
    });

    controller.sendAddGroupChat({
      chatId: "group-1",
      players: [{ id: "first" }, { id: "second" }],
    });

    expect(useMessageOutboxStore(pinia).queue).toEqual([
      expect.objectContaining({
        type: "direct",
        playerId: "first",
        command: "addGroupChat",
        params: ["first", "second"],
      }),
      expect.objectContaining({
        type: "direct",
        playerId: "second",
        command: "addGroupChat",
        params: ["first", "second"],
      }),
    ]);
  });

  it("accepts only valid spectator seat claims and retains the profile payload", () => {
    useSessionIdentityStore(pinia).setPlayerId("player-1");
    useProfileStore(pinia).setPlayerName("Player");
    useProfileStore(pinia).updatePlayerAvatar("avatar.webp");
    usePlayersStore(pinia).add("empty");
    const sendDirect = vi.fn();
    const controller = new SessionSeatController({
      isSpectator: () => true,
      sendDirect,
      recordPing: vi.fn(),
      removeGroupChatMember: vi.fn(),
    });

    controller.claimSeat("0");
    controller.claimSeat(0);

    expect(sendDirect).toHaveBeenCalledTimes(1);
    expect(sendDirect).toHaveBeenCalledWith("host", "claim", [
      0,
      "player-1",
      "Player",
      "avatar.webp",
    ]);
  });
});

afterEach(resetStores);
