<template>
  <Modal v-if="modals.role && availableRoles.length" @close="close">
    <h3>
      为
      {{
        playerIndex >= 0 && players.length
          ? players[playerIndex].name
          : "伪装身份"
      }}
      选择角色
    </h3>
    <ul class="tokens" v-if="tab === 'editionRoles' || !otherTravelers.size">
      <li
        v-for="role in availableRoles"
        v-show="
          (!role.id && !role.name) ||
          ['townsfolk', 'outsider', 'minion', 'demon'].includes(role.team) ||
          (role.team == 'traveler' &&
            (!session.isSpectator || (isShowTraveler && playerIndex < 0)))
        "
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <ul
      class="tokens"
      v-if="tab === 'editionRolesFull' || !otherTravelers.size"
    >
      <li
        v-for="role in availableRoles"
        v-show="
          (!role.id && !role.name) ||
          ['townsfolk', 'outsider', 'minion', 'demon'].includes(role.team) ||
          (role.team == 'traveler' &&
            (!session.isSpectator || (isShowTraveler && playerIndex < 0)))
        "
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <ul class="tokens" v-if="tab === 'otherTravelers' && otherTravelers.size">
      <li
        v-for="role in otherTravelers.values()"
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <div
      class="button-group"
      v-if="otherTravelers.size && !session.isSpectator"
    >
      <span
        class="button"
        :class="{ townsfolk: tab === 'editionRoles' }"
        @click="tab = 'editionRoles'"
      >
        <span v-if="playerIndex >= 0">剧本角色</span>
        <span v-else>不在场角色</span>
      </span>
      <span
        v-if="playerIndex < 0"
        class="button"
        :class="{ townsfolk: tab === 'editionRolesFull' }"
        @click="tab = 'editionRolesFull'"
      >
        全部角色
      </span>
      <span
        v-if="playerIndex >= 0"
        class="button"
        :class="{ townsfolk: tab === 'otherTravelers' }"
        @click="tab = 'otherTravelers'"
        >其他旅行者</span
      >
    </div>
    <div
      v-if="session.isSpectator && playerIndex < 0"
      class="check-box"
      @click="toggleShowTraveler()"
    >
      <span>显示旅行者</span> &nbsp;
      <em>
        <font-awesome-icon
          :icon="['fas', isShowTraveler ? 'check-square' : 'square']"
        />
      </em>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Modal from "./Modal.vue";
import Token from "../Token.vue";
import { emitLegacyMutation } from "../../store/legacy-effects";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";

const { playerIndex } = defineProps<{ playerIndex: number }>();
const modals = useModalStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const players = computed(() => playerState.players);
const roles = scenario.roles as Map<string, any>;
const otherTravelers = scenario.otherTravelers as Map<string, any>;
const tab = ref("editionRoles");
const isShowTraveler = ref(false);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

const availableRoles = computed(() => {
  const available = Array.from(roles.values()).filter(
    (role) =>
      tab.value === "editionRolesFull" ||
      playerIndex >= 0 ||
      !players.value.some((player) => player.role.id === role.id),
  );
  return [...available, {}];
});

const tokenWidth = computed(() =>
  windowWidth.value * 0.06 >= 80 ? "width: 6vw" : "width: 80px",
);

onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));

function handleResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}

function setRole(role: any) {
  if (playerIndex < 0) {
    const payload = {
      index: playerIndex * -1 - 1,
      role,
    };
    playerState.setBluff(payload);
    emitLegacyMutation("players/setBluff", payload);
  } else {
    if (session.isSpectator && role.team === "traveler") return;
    const payload = {
      player: players.value[playerIndex],
      property: "role",
      value: role,
    };
    playerState.update(payload);
    emitLegacyMutation("players/update", payload);
  }
  tab.value = "editionRoles";
  modals.toggle("role");
}

function close() {
  tab.value = "editionRoles";
  modals.toggle("role");
}

function toggleShowTraveler() {
  isShowTraveler.value = !isShowTraveler.value;
}
</script>

<style scoped lang="scss">
@import "../../vars.scss";

ul.tokens li {
  border-radius: 50%;
  // width: 120px;
  margin: 1%;
  transition: transform 500ms ease;

  &.townsfolk {
    box-shadow:
      0 0 10px $townsfolk,
      0 0 10px #004cff;
  }
  &.outsider {
    box-shadow:
      0 0 10px $outsider,
      0 0 10px $outsider;
  }
  &.minion {
    box-shadow:
      0 0 10px $minion,
      0 0 10px $minion;
  }
  &.demon {
    box-shadow:
      0 0 10px $demon,
      0 0 10px $demon;
  }
  &.traveler {
    box-shadow:
      0 0 10px $traveler,
      0 0 10px $traveler;
  }
  &:hover {
    transform: scale(1.2);
    z-index: 10;
  }
}

.check-box {
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;

  margin-left: auto;
  margin-right: auto;

  cursor: pointer;
  &:hover {
    color: red;
  }
}
</style>
