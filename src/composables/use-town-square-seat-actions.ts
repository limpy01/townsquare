import { ref } from "vue";
import type { useChatStore } from "../stores/chat";
import { emitGameEvent } from "../store/game-events";
import type { useModalStore } from "../stores/modals";
import type { usePlayersStore } from "../stores/players";
import type { useRoleActivityStore } from "../stores/role-activity";
import type { useSessionIdentityStore } from "../stores/session-identity";
import type { useVotingStore } from "../stores/voting";

type SeatActionOptions = {
  players: ReturnType<typeof usePlayersStore>;
  session: ReturnType<typeof useSessionIdentityStore>;
  voting: ReturnType<typeof useVotingStore>;
  chat: ReturnType<typeof useChatStore>;
  modals: ReturnType<typeof useModalStore>;
  roleActivity: ReturnType<typeof useRoleActivityStore>;
  openChat(playerIndex: number): void;
};

export function useTownSquareSeatActions({
  players,
  session,
  voting,
  chat,
  modals,
  roleActivity,
  openChat,
}: SeatActionOptions) {
  const selectedPlayer = ref(0);
  const swap = ref(-1);
  const move = ref(-1);
  const nominate = ref(-1);
  const publish = (type: string, payload?: unknown) =>
    emitGameEvent(type, payload);
  const setNomination = (payload?: unknown) => {
    voting.setNomination(payload as never, {
      isSecretVote: voting.isSecretVote,
      claimedSeat: session.claimedSeat,
    });
    publish("session/nomination", payload);
  };
  const updatePlayer = (payload: Parameters<typeof players.update>[0]) => {
    players.update(payload);
    publish("players/update", payload);
  };
  const cancel = () => {
    move.value = -1;
    swap.value = -1;
    nominate.value = -1;
  };
  const setUsingWraith = () => {
    const payload = {
      role: "wraith" as const,
      property: "using" as const,
      value: !roleActivity.wraith.using,
    };
    roleActivity.setRole(payload);
    publish("session/setIsRole", payload);
  };
  const claimSeat = (playerIndex: number) => {
    if (!session.isSpectator) return;
    const player = players.players[playerIndex];
    if (!player) return;
    const claimedSeat = session.playerId === player.id ? -1 : playerIndex;
    session.claimSeat(claimedSeat);
    publish("session/claimSeat", claimedSeat);
    if (claimedSeat >= 0 && session.stId) {
      chat.createHistory(session.stId);
      publish("session/createChatHistory", session.stId);
    }
  };
  const openReminderModal = (playerIndex: number) => {
    selectedPlayer.value = playerIndex;
    modals.toggle("reminder");
  };
  const openRoleModal = (playerIndex: number) => {
    const player = players.players[playerIndex];
    if (session.isSpectator && player?.role.team === "traveler") return;
    selectedPlayer.value = playerIndex;
    modals.toggle("role");
  };
  const removeFabled = (index: number) => {
    if (session.isSpectator) {
      if (index === 0 && session.claimedSeat >= 0) openChat(0);
      return;
    }
    players.setFabled({ index });
    publish("players/setFabled", { index });
  };
  const removePlayer = (playerIndex: number) => {
    if (session.isSpectator || voting.lockedVote) return;
    const { nomination } = voting;
    if (nomination) {
      if (nomination.includes(playerIndex)) setNomination();
      else if (nomination[0] > playerIndex || nomination[1] > playerIndex) {
        setNomination([
          nomination[0] > playerIndex ? nomination[0] - 1 : nomination[0],
          nomination[1] > playerIndex ? nomination[1] - 1 : nomination[1],
        ]);
      }
    }
    players.remove(playerIndex);
    publish("players/remove", playerIndex);
  };
  const swapPlayer = (from: number, to?: unknown) => {
    if (session.isSpectator || voting.lockedVote) return;
    if (to === undefined) {
      cancel();
      swap.value = from;
      return;
    }
    const swapTo = players.players.indexOf(to);
    if (voting.nomination) {
      const updated = voting.nomination.map((index) => {
        if (index === swap.value) return swapTo;
        if (index === swapTo) return swap.value;
        return index;
      });
      if (
        voting.nomination[0] !== updated[0] ||
        voting.nomination[1] !== updated[1]
      )
        setNomination(updated);
    }
    players.swap([swap.value, swapTo]);
    publish("players/swap", [swap.value, swapTo]);
    cancel();
  };
  const movePlayer = (from: number, to?: unknown) => {
    if (session.isSpectator || voting.lockedVote) return;
    if (to === undefined) {
      cancel();
      move.value = from;
      return;
    }
    const moveTo = players.players.indexOf(to);
    if (voting.nomination) {
      const updated = voting.nomination.map((index) => {
        if (index === move.value) return moveTo;
        if (index > move.value && index <= moveTo) return index - 1;
        if (index < move.value && index >= moveTo) return index + 1;
        return index;
      });
      if (
        voting.nomination[0] !== updated[0] ||
        voting.nomination[1] !== updated[1]
      )
        setNomination(updated);
    }
    players.move([move.value, moveTo]);
    publish("players/move", [move.value, moveTo]);
    cancel();
  };
  const nominatePlayer = (from: number, to?: unknown) => {
    if (session.isSpectator || voting.lockedVote) return;
    if (to === undefined) {
      cancel();
      if (from !== nominate.value) nominate.value = from;
      return;
    }
    setNomination({
      nomination: [nominate.value, players.players.indexOf(to)],
    });
    cancel();
  };
  const updatePlayerVotes = (playerIndex: number, change: 1 | -1) => {
    if (session.isSpectator) return;
    const player = players.players[playerIndex];
    if (!player) return;
    const votes = player.votes + change;
    if (votes < 1) return;
    updatePlayer({ player, property: "votes", value: votes });
  };
  const setStoryTeller = (playerIndex: number) => {
    if (session.isSpectator) return;
    const player = players.players[playerIndex];
    if (!player || (player.id && player.id !== "host")) return;
    const updates: Array<[string, string | boolean]> = player.id
      ? [
          ["id", ""],
          ["name", ""],
          ["isVoteless", false],
          ["isDead", false],
        ]
      : [
          ["id", "host"],
          ["name", "说书人"],
          ["isVoteless", true],
          ["isDead", true],
        ];
    updates.forEach(([property, value]) =>
      updatePlayer({ player, property, value }),
    );
  };

  return {
    selectedPlayer,
    swap,
    move,
    nominate,
    setUsingWraith,
    claimSeat,
    openReminderModal,
    openRoleModal,
    removeFabled,
    cancel,
    removePlayer,
    swapPlayer,
    movePlayer,
    nominatePlayer,
    addVote: (index: number) => updatePlayerVotes(index, 1),
    subtractVote: (index: number) => updatePlayerVotes(index, -1),
    setStoryTeller,
  };
}
