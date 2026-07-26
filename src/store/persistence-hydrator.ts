import {
  persistedBooleanSchema,
  persistedFiniteNumberSchema,
  persistedSeatSchema,
  persistedSelectedEditionsSchema,
  persistedSessionSchema,
  persistedStringRecordSchema,
  persistedUseOldOrderSchema,
  persistedUseOldRoleSchema,
} from "@townsquare/contracts/local-storage";
import { rolesJSONbyId } from "./selectors";
import { pinia } from "../pinia";
import { useAppMetaStore } from "../stores/app-meta";
import { useChatStore } from "../stores/chat";
import { useGrimoireStore } from "../stores/grimoire";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import { usePlayersStore } from "../stores/players";
import { useProfileStore } from "../stores/profile";
import { useReviewStore } from "../stores/review";
import { useRoleActivityStore } from "../stores/role-activity";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useSessionSettingsStore } from "../stores/session-settings";
import { useVotingStore } from "../stores/voting";
import {
  readStoredArray,
  readStoredJson,
  readStoredRecord,
  readStoredWithSchema,
} from "./storage";
import {
  isRecord,
  readGroupChats,
  readLegacyRoleState,
} from "./persistence-codecs";
import type { PersistenceStorage } from "./persistence-types";

export function hydratePersistence(storage: PersistenceStorage): void {
  const appMeta = useAppMetaStore(pinia);
  const chat = useChatStore(pinia);
  const grimoire = useGrimoireStore(pinia);
  const legacyOptions = useLegacyOptionsStore(pinia);
  const players = usePlayersStore(pinia);
  const profile = useProfileStore(pinia);
  const review = useReviewStore(pinia);
  const roles = useRoleActivityStore(pinia);
  const scenario = useScenarioStore(pinia);
  const session = useSessionIdentityStore(pinia);
  const settings = useSessionSettingsStore(pinia);
  const voting = useVotingStore(pinia);
  const findRole = (roleId: string) =>
    scenario.roles.get(roleId) || rolesJSONbyId.get(roleId) || {};
  const lastVersion = storage.getItem("lastVersion");
  if (lastVersion) appMeta.setLastVersion(lastVersion);
  const background = storage.getItem("background");
  if (background) grimoire.set("background", background);
  if (storage.getItem("muted")) grimoire.toggle("isMuted", true);
  if (storage.getItem("static")) grimoire.toggle("isStatic", true);
  if (storage.getItem("imageOptIn")) grimoire.toggle("isImageOptIn", true);
  const zoom = storage.getItem("zoom");
  if (zoom) grimoire.set("zoom", parseFloat(zoom));
  const audioThreshold = storage.getItem("audioThreshold");
  if (audioThreshold) grimoire.set("audioThreshold", Number(audioThreshold));
  if (storage.getItem("isGrimoire")) grimoire.toggle("isPublic", false);

  const useOldOrder = readStoredWithSchema(
    storage,
    "useOldOrder",
    persistedUseOldOrderSchema,
  );
  if (useOldOrder) legacyOptions.setUseOldOrder(useOldOrder);
  const useOldRole = readStoredWithSchema(
    storage,
    "useOldRole",
    persistedUseOldRoleSchema,
  );
  if (useOldRole) legacyOptions.setUseOldRole(useOldRole);
  const isReview = readStoredWithSchema(
    storage,
    "isReview",
    persistedBooleanSchema,
  );
  if (isReview !== null) review.setReview(isReview);
  const selectedEditions = readStoredWithSchema(
    storage,
    "selectedEditions",
    persistedSelectedEditionsSchema,
  );
  if (selectedEditions) scenario.setSelectedEditions(selectedEditions);

  if (storage.getItem("roles") !== null) {
    scenario.setCustomRoles(readStoredArray(storage, "roles"));
    scenario.setEdition({ id: "custom" });
  }
  if (storage.getItem("states"))
    scenario.setStates(readStoredArray(storage, "states"));
  const teamsNames = readStoredWithSchema(
    storage,
    "teamsNames",
    persistedStringRecordSchema,
  );
  if (teamsNames) scenario.setTeamsNames(teamsNames);
  if (storage.getItem("firstNight"))
    scenario.setFirstNight(readStoredArray(storage, "firstNight"));
  if (storage.getItem("otherNight"))
    scenario.setOtherNight(readStoredArray(storage, "otherNight"));
  if (storage.getItem("edition") !== null)
    scenario.setEdition(readStoredRecord(storage, "edition"));
  if (storage.getItem("bluffs") !== null) {
    readStoredArray(storage, "bluffs").forEach((role, index) => {
      const roleId = typeof role === "string" ? role : "";
      players.setBluff({
        index,
        role: findRole(roleId),
      });
    });
  }
  if (storage.getItem("fabled") !== null) {
    players.setFabled({
      fabled: readStoredArray(storage, "fabled"),
      emptyFabled: true,
    });
  }
  if (storage.getItem("players")) {
    players.setPlayers(
      readStoredArray(storage, "players")
        .filter(isRecord)
        .map((player) => {
          const roleId = typeof player.role === "string" ? player.role : "";
          return {
            ...player,
            role: findRole(roleId),
          };
        }),
    );
  }

  const scalarSessions = [
    ["playerId", session.setPlayerId.bind(session)],
    ["stSecret", session.setStSecret.bind(session)],
    ["playerName", profile.setPlayerName.bind(profile)],
    ["stId", session.setStId.bind(session)],
  ] as const;
  scalarSessions.forEach(([key, set]) => {
    const value = storage.getItem(key);
    if (value) set(value);
  });
  const storedClaimedSeat = storage.getItem("claimedSeat");
  if (storedClaimedSeat !== null) {
    const claimedSeat = persistedSeatSchema.safeParse(
      Number(storedClaimedSeat),
    );
    if (claimedSeat.success) session.claimSeat(claimedSeat.data);
  }
  const storedSession = readStoredWithSchema(
    storage,
    "session",
    persistedSessionSchema,
  );
  if (storedSession) {
    const [spectator, sessionId] = storedSession;
    session.setSpectator(spectator);
    session.setSessionId(sessionId);
  }
  const playerVotes = readStoredWithSchema(
    storage,
    "playerVotes",
    persistedFiniteNumberSchema,
  );
  if (playerVotes !== null) voting.setPlayerVotes(playerVotes);
  if (storage.getItem("votes")) {
    readStoredArray(storage, "votes")
      .filter(isRecord)
      .forEach((vote) => {
        if (
          typeof vote.nominator === "string" &&
          typeof vote.nominee === "string" &&
          typeof vote.type === "string" &&
          typeof vote.mode === "string" &&
          typeof vote.votes === "number" &&
          typeof vote.majority === "number" &&
          Array.isArray(vote.votedPlayers)
        ) {
          voting.addVotes({
            timestamp: new Date(
              typeof vote.timestamp === "string" ? vote.timestamp : 0,
            ),
            nominator: vote.nominator,
            nominee: vote.nominee,
            type: vote.type,
            mode: vote.mode,
            votes: vote.votes,
            majority: vote.majority,
            votedPlayers: vote.votedPlayers.filter(
              (player): player is string => typeof player === "string",
            ),
            save: vote.save === true,
          });
        }
      });
  }
  if (storage.getItem("votesSelected")) {
    readStoredArray(storage, "votesSelected").forEach((vote) => {
      if (!isRecord(vote) || typeof vote.selected !== "boolean") return;
      const selection = {
        selected: vote.selected,
        ...(Array.isArray(vote.players) ? { players: vote.players } : {}),
        ...(vote.save === true ? { save: true } : {}),
      };
      voting.addVoteSelected(selection, {
        isVoteHistoryAllowed: voting.isVoteHistoryAllowed,
        isSpectator: session.isSpectator,
      });
    });
  }
  if (storage.getItem("customBootlegger")) {
    const bootlegger = readStoredJson(storage, "customBootlegger", "");
    if (typeof bootlegger === "string") settings.setBootlegger(bootlegger);
  }
  if (storage.getItem("chatHistory")) {
    readStoredArray(storage, "chatHistory")
      .filter(isRecord)
      .forEach((player) => {
        if (typeof player.id !== "string" || !Array.isArray(player.chat))
          return;
        const playerId = player.id;
        chat.createHistory(playerId);
        player.chat.forEach((message) =>
          chat.addReceivedMessage({
            message,
            playerId,
          }),
        );
      });
  }
  if (storage.getItem("groupChats")) {
    readGroupChats(storage).forEach((group) => {
      const groupPlayers = players.players.filter((player) =>
        group.playerIds.includes(player.id),
      );
      chat
        .addGroup({ chatId: group.id, players: groupPlayers, keep: group.keep })
        .forEach((change) => players.update(change));
    });
  }
  const avatar = storage.getItem("playerAvatar");
  if (avatar) profile.updatePlayerAvatar(avatar);
  const secretVote = readStoredWithSchema(
    storage,
    "secretVote",
    persistedBooleanSchema,
  );
  if (secretVote !== null) voting.setSecretVote(secretVote);
  if (storage.getItem("isRole")) {
    const roleState = readLegacyRoleState(storage);
    const role = Object.keys(roleState)[0];
    if (!role) return;
    const properties = roleState[role];
    if (!properties) return;
    Object.entries(properties).forEach(([property, value]) => {
      if (
        role === "wraith" &&
        (property === "active" ||
          property === "using" ||
          property === "st" ||
          property === "player" ||
          property === "prob" ||
          property === "probMax") &&
        (typeof value === "boolean" || typeof value === "number")
      )
        roles.setRole({ role, property, value, st: true });
    });
  }
}
