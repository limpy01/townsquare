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
import Modal from "./Modal.vue";
import { showInputModal } from "../../services/input-modal";
import store from "../../store";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";

const modals = useModalStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const input = ref("");
const edition = computed(() => scenario.edition ?? ({} as any));

const gamestate = computed(() =>
  JSON.stringify({
    bluffs: playerState.bluffs.map(({ id }) => id),
    edition: edition.value.isOfficial
      ? { id: edition.value.id }
      : edition.value,
    roles: edition.value.isOfficial ? "" : store.getters.customRolesStripped,
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
    const data: any = JSON.parse(input.value || gamestate.value);
    const { bluffs, edition, roles, fabled, players } = data;
    if (roles && !session.isSpectator) {
      store.commit("setCustomRoles", roles);
    }
    if (edition && !session.isSpectator) {
      store.commit("setEdition", edition);
      const states = [];
      if (edition.state && edition.state.length > 0) {
        edition.state.forEach((state: any) => {
          states.push({ [state.stateName]: state.stateDescription });
        });
      } else if (edition.status && edition.status.length > 0) {
        edition.status.forEach((state: any) => {
          states.push({ [state.name]: state.skill });
        });
      }
      const names = {
        townsfolk: edition.townsfolksName ? edition.townsfolksName : "镇民",
        outsider: edition.outsidersName ? edition.outsidersName : "外来者",
        minion: edition.minionsName ? edition.minionsName : "爪牙",
        demon: edition.demonsName ? edition.demonsName : "恶魔",
      };
      store.commit("setTeamsNames", names);
    }
    if (bluffs.length) {
      bluffs.forEach((role: any, index: number) => {
        store.commit("players/setBluff", {
          index,
          role: scenario.roles.get(role) || {},
        });
      });
    }
    if (fabled && !session.isSpectator) {
      const fabledNoSt = fabled.filter((role: any) => role.id != "storyteller");
      store.commit("players/setFabled", {
        fabled: fabledNoSt.map(
          (f: any) =>
            (scenario.fabled as Map<any, any>).get(f) ||
            (scenario.fabled as Map<any, any>).get(f.id) ||
            f,
        ),
      });
    }
    if (players && players.length > 0) {
      const mappedPlayers = playerState.players;
      for (let index = 0; index < players.length; index++) {
        if (index >= mappedPlayers.length) {
          if (!session.isSpectator) {
            store.commit("players/add", "");
          } else {
            break;
          }
        }
        const player = players[index];
        const role: any = scenario.roles.get(player.role) || {};
        const mappedPlayer = mappedPlayers[index];
        if (
          (role.team != "traveler" && mappedPlayer.role.team != "traveler") ||
          !session.isSpectator
        ) {
          store.commit("players/update", {
            player: mappedPlayer,
            property: "role",
            value: role,
          });
          store.commit("players/update", {
            player: mappedPlayer,
            property: "reminders",
            value: player.reminders,
          });
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
    const data: any = JSON.parse(input.value || gamestate.value);
    const { bluffs, edition, roles, fabled, players } = data;
    if (roles) store.commit("setCustomRoles", roles);
    if (edition) store.commit("setEdition", edition);
    if (bluffs.length) {
      bluffs.forEach((role: any, index: number) => {
        store.commit("players/setBluff", {
          index,
          role: scenario.roles.get(role) || {},
        });
      });
    }
    if (fabled) {
      const fabledNoSt = fabled.filter((role: any) => role.id != "storyteller");
      store.commit("players/setFabled", {
        fabled: fabledNoSt.map(
          (f: any) =>
            (scenario.fabled as Map<any, any>).get(f) ||
            (scenario.fabled as Map<any, any>).get(f.id) ||
            f,
        ),
      });
    }
    if (players) {
      store.commit(
        "players/set",
        players.map((player: any) => ({
          ...player,
          role:
            scenario.roles.get(player.role) ||
            store.getters.rolesJSONbyId.get(player.role) ||
            {},
        })),
      );
    }
  } catch (error) {
    await showLoadError(error);
  }
}
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

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
