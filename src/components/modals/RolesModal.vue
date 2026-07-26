<template>
  <Modal
    class="roles"
    v-if="modals.roles && nonTravelers >= 5"
    @close="modals.toggle('roles')"
  >
    <h3>为当前{{ nonTravelers }}名玩家选择角色</h3>
    <ul class="tokens" v-for="(teamRoles, team) in roleSelection" :key="team">
      <li class="count" :class="[team]">
        {{ teamRoles.reduce((a, { selected }) => a + selected, 0) }} /
        {{ game[nonTravelers - 5]?.[team] ?? 0 }}
      </li>
      <li
        v-for="role in teamRoles"
        :class="[role.team, role.selected ? 'selected' : '']"
        :key="role.id"
        @click="role.selected = role.selected ? 0 : 1"
        :style="tokenWidth"
      >
        <Token :role="role" />
        <font-awesome-icon icon="exclamation-triangle" v-if="role.setup" />
        <div class="buttons" v-if="allowMultiple">
          <font-awesome-icon
            icon="minus-circle"
            @click.stop="role.selected--"
          />
          <span>{{ role.selected > 1 ? "x" + role.selected : "" }}</span>
          <font-awesome-icon icon="plus-circle" @click.stop="role.selected++" />
        </div>
      </li>
    </ul>
    <div class="warningSetup" v-if="hasSelectedSetupRoles">
      <font-awesome-icon icon="exclamation-triangle" />
      <span>
        警告:
        目前选择的角色会修改游戏的初始角色配置！随机分发器不会识别这些角色的功能。建议说书人手动调整要分发的角色。
      </span>
    </div>
    <div class="warningReview" v-if="review.isReview">
      <font-awesome-icon icon="exclamation-triangle" />
      <span> 警告: 正在使用复盘视角，如果即将进行游戏请先关闭复盘视角！ </span>
    </div>
    <label class="multiple" :class="{ checked: allowMultiple }">
      <font-awesome-icon :icon="allowMultiple ? 'check-square' : 'square'" />
      <input type="checkbox" name="allow-multiple" v-model="allowMultiple" />
      允许重复角色
    </label>
    <div class="button-group">
      <div
        class="button"
        @click="assignRoles(true)"
        :class="{
          disabled: selectedRoles > nonTravelers || !selectedRoles,
        }"
      >
        <font-awesome-icon
          icon="exclamation-triangle"
          v-if="review.isReview"
          style="color: yellow"
        />
        <font-awesome-icon icon="people-arrows" v-else />
        随机分配{{ selectedRoles }}个角色
      </div>
      <div
        v-if="review.isReview"
        class="button"
        @click="assignRoles(false)"
        :class="{
          disabled: selectedRoles > nonTravelers || !selectedRoles,
        }"
      >
        <font-awesome-icon icon="people-arrows" />
        关闭复盘并随机分配
      </div>
      <div
        class="button"
        @click="drawRoles()"
        :class="{
          disabled: selectedRoles > nonTravelers || !selectedRoles,
        }"
      >
        抽取角色（线下）
      </div>
      <div class="button" @click="selectRandomRoles">
        <font-awesome-icon icon="random" />
        随机角色
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { ScenarioCatalogRole } from "@townsquare/domain";
import Modal from "./Modal.vue";
import gameJSON from "../../game.json";
import Token from "../Token.vue";
import { useDrawStore } from "../../stores/draw";
import { emitGameEvent } from "../../store/game-events";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useReviewStore } from "../../stores/review";
import { useScenarioStore } from "../../stores/scenario";

const randomElement = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];
const modals = useModalStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const draw = useDrawStore();
const review = useReviewStore();
const players = computed(() => playerState.players);
type SelectableRole = ScenarioCatalogRole & { selected: number };
type GameComposition = Record<string, number>;

const roles = scenario.roles;
const roleSelection = ref<Record<string, SelectableRole[]>>({});
const game = gameJSON as unknown as GameComposition[];
const allowMultiple = ref(false);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const nonTravelers = computed(() =>
  Math.min(
    players.value.filter((player) => player.role.team !== "traveler").length,
    15,
  ),
);
const selectedRoles = computed(() =>
  Object.values(roleSelection.value)
    .flat()
    .reduce((total, role) => total + role.selected, 0),
);
const hasSelectedSetupRoles = computed(() =>
  Object.values(roleSelection.value)
    .flat()
    .some((role) => role.selected && role.setup),
);
const tokenWidth = computed(() =>
  windowWidth.value * 0.06 >= 80 ? "width: 6vw" : "width: 80px",
);

function handleResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}
function selectedAndShuffledRoles() {
  return Object.values(roleSelection.value)
    .flatMap((teamRoles) =>
      teamRoles.flatMap((role) => Array(role.selected).fill(role)),
    )
    .map((role) => [Math.random(), role] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, role]) => role);
}
function selectRandomRoles() {
  const selection: Record<string, SelectableRole[]> = {};
  roles.forEach((role) => {
    (selection[role.team] ??= []).push({ ...role, selected: 0 });
  });
  for (const team of Object.keys(selection))
    if (!["townsfolk", "outsider", "minion", "demon"].includes(team))
      delete selection[team];
  const composition = game[Math.max(5, nonTravelers.value) - 5];
  Object.keys(composition ?? {}).forEach((team) => {
    for (let index = 0; index < (composition?.[team] ?? 0); index++) {
      const available = selection[team]?.filter((role) => !role.selected) ?? [];
      const selected = randomElement(available);
      if (selected) selected.selected = 1;
    }
  });
  roleSelection.value = selection;
}
function assignRoles(allowReview = true) {
  if (selectedRoles.value > nonTravelers.value || !selectedRoles.value) return;
  if (!allowReview && review.isReview) {
    review.setReview(false);
    emitGameEvent("session/setIsReview", false);
  }
  const assigned = selectedAndShuffledRoles();
  players.value.forEach((player) => {
    if (player.role.team !== "traveler" && assigned.length) {
      const payload = {
        player,
        property: "role",
        value: assigned.pop(),
      };
      playerState.update(payload);
      emitGameEvent("players/update", payload);
    }
  });
  modals.toggle("roles");
}
function drawRoles() {
  if (selectedRoles.value > nonTravelers.value || !selectedRoles.value) return;
  draw.setRoles(selectedAndShuffledRoles());
  modals.toggle("roles");
  modals.toggle("draw");
}

onMounted(() => {
  if (!Object.keys(roleSelection.value).length) selectRandomRoles();
  window.addEventListener("resize", handleResize);
});
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
watch(() => scenario.roles, selectRandomRoles);
</script>

<style lang="scss" scoped>
@use "../../vars.scss" as *;

ul.tokens {
  padding-left: 5%;
  li {
    border-radius: 50%;
    // width: 120px;
    margin: 5px;
    opacity: 0.5;
    transition: all 250ms;
    &.selected {
      opacity: 1;
      .buttons {
        display: flex;
      }
      .fa-exclamation-triangle {
        display: block;
      }
    }
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
    .fa-exclamation-triangle {
      position: absolute;
      color: red;
      filter: drop-shadow(0 0 3px black) drop-shadow(0 0 3px black);
      top: 5px;
      right: -5px;
      font-size: 150%;
      display: none;
    }
    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      font-weight: bold;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
      span {
        flex-grow: 1;
      }
      svg {
        opacity: 0.25;
        cursor: pointer;
        &:hover {
          opacity: 1;
          color: red;
        }
      }
    }
  }
  .count {
    opacity: 1;
    position: absolute;
    left: 0;
    font-weight: bold;
    font-size: 75%;
    width: 5%;
    display: flex;
    align-items: center;
    justify-content: center;
    &:after {
      content: " ";
      display: block;
      padding-top: 100%;
    }
    &.townsfolk {
      color: $townsfolk;
    }
    &.outsider {
      color: $outsider;
    }
    &.minion {
      color: $minion;
    }
    &.demon {
      color: $demon;
    }
  }
}

.roles .modal {
  .multiple {
    display: block;
    text-align: center;
    cursor: pointer;
    &.checked,
    &:hover {
      color: red;
    }
    &.checked {
      margin-top: 10px;
    }
    svg {
      margin-right: 5px;
    }
    input {
      display: none;
    }
  }

  .warningSetup {
    color: red;
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    svg {
      font-size: 150%;
      vertical-align: middle;
    }
    span {
      display: none;
      text-align: center;
      position: absolute;
      right: -20px;
      bottom: 30px;
      width: 420px;
      background: rgba(0, 0, 0, 0.75);
      padding: 5px;
      border-radius: 10px;
      border: 2px solid black;
    }
    &:hover span {
      display: block;
    }
  }

  .warningReview {
    color: yellow;
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 10;
    svg {
      font-size: 150%;
      vertical-align: middle;
    }
    span {
      display: none;
      text-align: center;
      position: absolute;
      left: -20px;
      bottom: 30px;
      width: 420px;
      background: rgba(0, 0, 0, 0.75);
      padding: 5px;
      border-radius: 10px;
      border: 2px solid black;
    }
    &:hover span {
      display: block;
    }
  }
}
</style>
