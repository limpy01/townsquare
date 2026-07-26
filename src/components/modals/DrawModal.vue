<template>
  <Modal v-if="modals.draw" @close="close" class="roles">
    <h3>请抽取角色</h3>
    <ul class="tokens">
      <li
        v-for="role in draw.roles"
        v-show="Object.keys(displayRole).length === 0"
        :key="role.id"
        @click="storeRole(role)"
        :style="tokenWidth"
      >
        <Token style="visibility: hidden" :role="role" />
        <div class="life"></div>
      </li>
    </ul>
    <ul v-if="Object.keys(displayRole).length !== 0">
      <Token :role="displayRole" />
    </ul>
    <div class="multiple">
      <span v-if="Object.keys(displayRole).length === 0">
        <span v-if="drawnRoles.length !== nonTravelerLength"
          >请为{{
            drawingIndex + 1 + nextConsecutiveTravelerNumber
          }}号抽取身份</span
        >
      </span>
      <span v-else
        >请点击确认后交给
        <span v-if="drawnRoles.length === nonTravelerLength">说书人</span>
        <span v-else>下一名玩家</span>
      </span>
    </div>
    <div
      class="button-group"
      v-if="otherTravelers.size && !session.isSpectator"
    >
      <span
        class="button"
        v-if="Object.keys(displayRole).length === 0"
        @click="finishDraw()"
      >
        <span v-if="drawnRoles.length === nonTravelerLength"
          >分配已抽取角色至魔典</span
        >
        <span v-else>随机分配剩余角色</span>
      </span>
      <span class="button" v-else @click="nextRole()"> 确定 </span>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { type DrawRole, useDrawStore } from "../../stores/draw";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";
import { emitLegacyMutation } from "../../store/legacy-effects";
import Modal from "./Modal.vue";
import Token from "../Token.vue";

defineProps<{ playerIndex?: number }>();

const modals = useModalStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const draw = useDrawStore();
const players = computed(() => playerState.players);
const otherTravelers = computed(() => scenario.otherTravelers);
const displayRole = ref<DrawRole | Record<string, never>>({});
const drawingIndex = ref(0);
const drawnRoles = ref<DrawRole[]>([]);
const windowWidth = ref(window.innerWidth);
const tokenWidth = computed(() =>
  windowWidth.value * 0.06 >= 80 ? "width: 6vw" : "width: 80px",
);
const nonTravelerLength = computed(
  () =>
    players.value.filter((player) => player.role.team !== "traveler").length,
);
const nextConsecutiveTravelerNumber = computed(() => {
  let count = 0;
  for (let index = drawingIndex.value; index < players.value.length; index++) {
    if (players.value[index].role?.team === "traveler") count++;
    else break;
  }
  return count;
});

function handleResize() {
  windowWidth.value = window.innerWidth;
}

function storeRole(role: DrawRole) {
  if (Object.keys(displayRole.value).length) displayRole.value = {};
  const index = draw.roles.indexOf(role);
  if (index < 0) return;
  const [selectedRole] = draw.roles.splice(index, 1);
  if (!selectedRole) return;
  displayRole.value = selectedRole;
  drawnRoles.value.push(displayRole.value);
}

function nextRole() {
  displayRole.value = {};
  drawingIndex.value++;
  while (
    drawingIndex.value < players.value.length &&
    players.value[drawingIndex.value].role.team === "traveler"
  ) {
    drawingIndex.value++;
  }
}

function finishDraw() {
  const selectedRoles = [...drawnRoles.value, ...draw.roles];
  let skip = 0;
  for (let index = 0; index < selectedRoles.length; index++) {
    while (players.value[index + skip].role.team === "traveler") skip++;
    const payload = {
      player: players.value[index + skip],
      property: "role",
      value: selectedRoles[index],
    };
    playerState.update(payload);
    emitLegacyMutation("players/update", payload);
  }
  close();
}

function close() {
  displayRole.value = {};
  drawingIndex.value = 0;
  drawnRoles.value = [];
  draw.clearRoles();
  modals.toggle("draw");
}

onMounted(() => {
  window.addEventListener("resize", handleResize);
  drawingIndex.value = players.value.findIndex(
    (player) => player.role.team !== "traveler",
  );
});
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
</script>

<style scoped lang="scss">
@use "../../vars.scss" as *;

ul.tokens {
  li {
    border-radius: 50%;
    width: 120px;
    margin: 5px;
    transition: all 250ms;
    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    }
  }
  .life {
    border-radius: 50%;
    width: 100%;
    background: url("../../assets/life.png") center center;
    background-size: 100%;
    border: 3px solid black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    position: absolute;
    left: 0;
    top: 0;

    &:before {
      content: " ";
      display: block;
      padding-top: 100%;
    }

    &:hover {
      transform: scale(1.2);
    }
  }
}
.roles .modal {
  .multiple {
    display: block;
    text-align: center;
  }
}
</style>
