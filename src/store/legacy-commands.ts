import { pinia } from "../pinia";
import { useAudioStore } from "../stores/audio";
import { useChatStore } from "../stores/chat";
import { useDistributionStore } from "../stores/distribution";
import { useGrimoireStore } from "../stores/grimoire";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { useModalStore } from "../stores/modals";
import { usePlayersStore } from "../stores/players";
import { useProfileStore } from "../stores/profile";
import { useReviewStore } from "../stores/review";
import { useRoleActivityStore } from "../stores/role-activity";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useSessionSettingsStore } from "../stores/session-settings";
import { useTimerStore } from "../stores/timer";
import { useVotingStore } from "../stores/voting";
import { emitLegacyMutation } from "./legacy-effects";

const emit = (type: string, payload?: unknown) =>
  emitLegacyMutation(type, payload);

/**
 * Temporary Options API boundary. It deliberately exposes the former command
 * vocabulary while executing Pinia actions directly, so component migration
 * does not keep Vuex alive as a runtime dependency.
 */
export const legacyCommit = (type: string, payload?: any) => {
  const grimoire = useGrimoireStore(pinia);
  const players = usePlayersStore(pinia);
  const session = useSessionIdentityStore(pinia);
  const voting = useVotingStore(pinia);

  switch (type) {
    case "setBackground":
      grimoire.set("background", payload);
      break;
    case "setAudioThreshold":
      grimoire.set("audioThreshold", payload);
      break;
    case "setZoom":
      grimoire.set("zoom", payload);
      break;
    case "toggleMuted":
      grimoire.toggle("isMuted", payload);
      break;
    case "toggleMenu":
      grimoire.toggle("isMenuOpen", payload);
      break;
    case "toggleNightOrder":
      grimoire.toggle("isNightOrder", payload);
      break;
    case "toggleStatic":
      grimoire.toggle("isStatic", payload);
      break;
    case "toggleNight":
      grimoire.toggle("isNight", payload);
      break;
    case "toggleGrimoire":
      grimoire.toggle("isPublic", payload);
      break;
    case "toggleImageOptIn":
      grimoire.toggle("isImageOptIn", payload);
      break;
    case "toggleForwardEvilInfo":
      grimoire.toggle("isForwardEvilInfo", payload);
      break;
    case "toggleModal":
      useModalStore(pinia).toggle(payload);
      break;
    case "setCustomRoles":
      useScenarioStore(pinia).setCustomRoles(payload);
      break;
    case "setSelectedEditions":
      useScenarioStore(pinia).setSelectedEditions(payload);
      break;
    case "setEdition":
      useScenarioStore(pinia).setEdition(payload);
      break;
    case "players/add": {
      const player = players.add(payload?.name ?? payload ?? "");
      if (players.fabled.length === 0) players.setFabled({ fabled: [] });
      return emit(type, payload ?? player);
    }
    case "players/clear":
      players.clear(payload);
      break;
    case "players/remove":
      players.remove(payload);
      break;
    case "players/swap":
      players.swap(payload);
      break;
    case "players/move":
      players.move(payload);
      break;
    case "players/set":
      players.setPlayers(payload);
      break;
    case "players/update":
      players.update(payload);
      break;
    case "players/setBluff":
      players.setBluff(payload);
      break;
    case "players/setFabled":
      players.setFabled(payload);
      break;
    case "players/setPlayerMessage":
      players.setPlayerMessage(payload);
      break;
    case "session/setPlayerName":
      useProfileStore(pinia).setPlayerName(payload);
      break;
    case "session/setSpectator":
      session.setSpectator(payload);
      break;
    case "session/setSessionId":
      session.setSessionId(payload);
      break;
    case "session/claimSeat":
      session.claimSeat(payload);
      break;
    case "session/createChatHistory":
      useChatStore(pinia).createHistory(payload);
      break;
    case "session/clearVoteHistory":
      voting.clearVoteHistory(payload);
      break;
    case "session/distributeRoles":
      useDistributionStore(pinia).setRoles(payload);
      break;
    case "session/distributeTypes":
      useDistributionStore(pinia).setTypes(payload);
      break;
    case "session/distributeBluffs":
      useDistributionStore(pinia).setBluffs(payload.val);
      break;
    case "session/distributeGrimoire":
      useDistributionStore(pinia).setGrimoire(payload.val);
      break;
    case "session/setPlayerVotes":
      voting.setPlayerVotes(payload);
      break;
    case "session/setSecretVote":
      voting.setSecretVote(payload);
      break;
    case "session/setMarkedPlayer":
      voting.setMarkedPlayer(payload, { isSecretVote: voting.isSecretVote });
      break;
    case "session/setNomination":
    case "session/nomination":
      voting.setNomination(payload, {
        isSecretVote: voting.isSecretVote,
        claimedSeat: session.claimedSeat,
      });
      break;
    case "session/setBootlegger":
      useSessionSettingsStore(pinia).setBootlegger(payload);
      break;
    case "session/setIsReview":
      useReviewStore(pinia).setReview(payload);
      break;
    case "session/setUseOldOrder":
      useLegacyOptionsStore(pinia).setUseOldOrder(payload);
      break;
    case "session/setUseOldRole":
      useLegacyOptionsStore(pinia).setUseOldRole(payload);
      break;
    case "session/startTimer":
      useTimerStore(pinia).startTimer(payload);
      break;
    case "session/stopTimer":
      useTimerStore(pinia).stopTimer();
      break;
    case "session/setTalking":
      useAudioStore(pinia).setTalking(payload.isTalking);
      players.setTalking({ ...payload, playerId: session.playerId });
      break;
    case "session/setIsRole":
      useRoleActivityStore(pinia).setRole(payload);
      break;
    case "session/deleteMessageQueue":
      useMessageOutboxStore(pinia).remove(payload);
      break;
    case "session/removeGroupChat": {
      const changes = useChatStore(pinia).removeGroup(payload.chatId);
      changes.forEach((change) => players.update(change));
      break;
    }
    case "session/updateChatSent":
      if (
        !session.isSpectator ||
        payload.sendingPlayerId === session.playerId
      ) {
        useMessageOutboxStore(pinia).add({
          type: "direct",
          playerId: payload.receivingPlayerId,
          command: "chat",
          params: payload,
          id: new Date().getTime(),
        });
      }
      break;
    default:
      throw new Error(`Unsupported legacy command: ${type}`);
  }
  return emit(type, payload);
};

export const legacyDispatch = (type: string, payload?: any) => {
  const players = usePlayersStore(pinia);
  switch (type) {
    case "players/randomize":
      players.randomize();
      break;
    case "players/clearRoles":
      players.clearRoles(useSessionIdentityStore(pinia).isSpectator);
      break;
    case "players/realivePlayers":
      players.realivePlayers();
      break;
    default:
      throw new Error(`Unsupported legacy action: ${type}`);
  }
  return emit(type, payload);
};

export const legacyCommands = {
  commit: legacyCommit,
  dispatch: legacyDispatch,
};
