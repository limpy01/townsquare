<template>
  <Modal
    class="game-state"
    v-if="modals.gameState"
    @close="modals.toggle('gameState')"
  >
    <h3>当前游戏状态</h3>
    <textarea
      :value="gamestate"
      @input.stop="updateInput"
      @click="selectAll"
      @keyup.stop=""
    ></textarea>
    <div class="button-group">
      <div class="button townsfolk" @click="copy">
        <font-awesome-icon icon="copy" /> 复制JSON
      </div>
      <div class="button demon" @click="loadGrimoire">
        <font-awesome-icon icon="cog" /> 加载魔典
      </div>
      <div class="button" @click="loadState" v-if="!session.isSpectator">
        <font-awesome-icon icon="cog" /> 加载状态（不推荐）
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import {
  parseGameState,
  type GameState,
} from "@townsquare/contracts/game-state";
import type { ScenarioCatalogRole } from "@townsquare/domain";
import Modal from "./Modal.vue";
import { showInputModal } from "../../services/input-modal";
import { emitLegacyMutation } from "../../store/legacy-effects";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";
import { getCustomRolesStripped, rolesJSONbyId } from "../../store/selectors";

type GameStateEdition = Record<string, unknown> & {
  id?: string;
  isOfficial?: boolean;
  state?: unknown;
  status?: unknown;
  townsfolksName?: string;
  outsidersName?: string;
  minionsName?: string;
  demonsName?: string;
};

type GameStatePlayer = GameState["players"][number];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getRoleId = (value: unknown) =>
  typeof value === "string"
    ? value
    : isRecord(value) && typeof value.id === "string"
    ? value.id
    : undefined;

const emptyRole: ScenarioCatalogRole = { id: "", team: "" };

const modals = useModalStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const input = ref("");
const edition = computed<GameStateEdition>(
  () => scenario.edition as GameStateEdition,
);

function setCustomRoles(roles: unknown) {
  if (!scenario.setCustomRoles(roles)) return false;
  emitLegacyMutation("setCustomRoles", roles);
  return true;
}

function setEdition(value: unknown) {
  const fabled = scenario.setEdition(value);
  emitLegacyMutation("setEdition", value);
  if (fabled) emitLegacyMutation("players/setFabled", { fabled });
}

function updatePlayer(player: unknown, property: string, value: unknown) {
  const payload = { player, property, value };
  playerState.update(payload);
  emitLegacyMutation("players/update", payload);
}

function setBluff(index: number, role: unknown) {
  const payload = { index, role };
  playerState.setBluff(payload);
  emitLegacyMutation("players/setBluff", payload);
}

function setFabled(fabled: unknown[]) {
  const payload = { fabled };
  playerState.setFabled(payload);
  emitLegacyMutation("players/setFabled", payload);
}

const gamestate = computed(() =>
  JSON.stringify({
    bluffs: playerState.bluffs.map(({ id }) => id),
    edition: edition.value.isOfficial
      ? { id: edition.value.id }
      : edition.value,
    roles: edition.value.isOfficial
      ? ""
      : getCustomRolesStripped(scenario.roles.values()),
    fabled: playerState.fabled.map((fabled) =>
      fabled.isCustom ? fabled : { id: fabled.id },
    ),
    players: playerState.players.map((player) => ({
      ...player,
      role: player.role.id || {},
    })),
  }),
);

function updateInput(event: Event) {
  input.value = (event.target as HTMLTextAreaElement).value;
}

function selectAll(event: Event) {
  (event.target as HTMLTextAreaElement).select();
}

function parseInput(): GameState {
  return parseGameState(JSON.parse(input.value || gamestate.value));
}

function copy() {
  navigator.clipboard.writeText(input.value || gamestate.value);
}

async function showLoadError(error: unknown) {
  await showInputModal({
    inputType: "alert",
    inputModal: "text",
    inputData: {
      name: ["无法加载JSON：" + error],
    },
  }).catch(() => null);
}

async function loadGrimoire() {
  try {
    const data = parseInput();
    const { bluffs, edition, roles, fabled, players } = data;
    if (roles && !session.isSpectator) {
      setCustomRoles(roles);
    }
    if (edition && !session.isSpectator) {
      setEdition(edition);
      const states = [];
      if (Array.isArray(edition.state) && edition.state.length > 0) {
        edition.state.forEach((state) => {
          if (!isRecord(state)) return;
          states.push({
            [String(state.stateName ?? "")]: state.stateDescription,
          });
        });
      } else if (Array.isArray(edition.status) && edition.status.length > 0) {
        edition.status.forEach((state) => {
          if (!isRecord(state)) return;
          states.push({ [String(state.name ?? "")]: state.skill });
        });
      }
      const names = {
        townsfolk:
          typeof edition.townsfolksName === "string"
            ? edition.townsfolksName
            : "镇民",
        outsider:
          typeof edition.outsidersName === "string"
            ? edition.outsidersName
            : "外来者",
        minion:
          typeof edition.minionsName === "string"
            ? edition.minionsName
            : "爪牙",
        demon:
          typeof edition.demonsName === "string" ? edition.demonsName : "恶魔",
      };
      scenario.setTeamsNames(names);
      emitLegacyMutation("setTeamsNames", names);
    }
    if (bluffs.length) {
      bluffs.forEach((role, index) => {
        setBluff(index, scenario.roles.get(role) || {});
      });
    }
    if (fabled && !session.isSpectator) {
      const fabledNoSt = fabled.filter(
        (role) => getRoleId(role) !== "storyteller",
      );
      setFabled(
        fabledNoSt.map((f) => scenario.fabled.get(getRoleId(f) ?? "") ?? f),
      );
    }
    if (players && players.length > 0) {
      const mappedPlayers = playerState.players;
      for (let index = 0; index < players.length; index++) {
        if (index >= mappedPlayers.length) {
          if (!session.isSpectator) {
            const added = playerState.add("");
            emitLegacyMutation("players/add", { name: added.name });
          } else {
            break;
          }
        }
        const player = players[index] as GameStatePlayer;
        const role =
          scenario.roles.get(getRoleId(player.role) ?? "") ?? emptyRole;
        const mappedPlayer = mappedPlayers[index];
        if (
          (role.team != "traveler" && mappedPlayer.role.team != "traveler") ||
          !session.isSpectator
        ) {
          updatePlayer(mappedPlayer, "role", role);
          updatePlayer(mappedPlayer, "reminders", player.reminders);
        }
      }
    }
    modals.toggle("gameState");
  } catch (error) {
    await showLoadError(error);
  }
}

async function loadState() {
  if (session.isSpectator) return;
  const prompt = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: {
      name: ["确定要加载所有状态吗？（包括玩家、头像等）"],
    },
  }).catch(() => null);
  if (prompt === null || !prompt) return;

  try {
    const data = parseInput();
    const { bluffs, edition, roles, fabled, players } = data;
    if (roles) setCustomRoles(roles);
    if (edition) setEdition(edition);
    if (bluffs.length) {
      bluffs.forEach((role, index) => {
        setBluff(index, scenario.roles.get(role) || {});
      });
    }
    if (fabled) {
      const fabledNoSt = fabled.filter(
        (role) => getRoleId(role) !== "storyteller",
      );
      setFabled(
        fabledNoSt.map((f) => scenario.fabled.get(getRoleId(f) ?? "") ?? f),
      );
    }
    if (players) {
      const mapped = players.map((player) => ({
        ...player,
        role:
          scenario.roles.get(getRoleId(player.role) ?? "") ||
          rolesJSONbyId.get(getRoleId(player.role) ?? "") ||
          {},
      }));
      playerState.setPlayers(mapped);
      emitLegacyMutation("players/set", mapped);
    }
  } catch (error) {
    await showLoadError(error);
  }
}
</script>

<style lang="scss" scoped>
@use "../../vars.scss" as *;

h3 {
  margin: 0 40px;
}

textarea {
  background: transparent;
  color: white;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid rgba(255, 255, 255, 0.5);
  width: 60vw;
  height: 30vh;
  max-width: 100%;
  margin: 5px 0;
}
</style>
