<template>
  <Modal v-if="modals.fabled && fabled.length" @close="modals.toggle('fabled')">
    <h3>选择一个传奇角色</h3>
    <ul class="tokens">
      <li
        v-for="role in fabled"
        :key="role.id"
        @click="setFabled(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Modal from "./Modal.vue";
import Token from "../Token.vue";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { emitLegacyMutation } from "../../store/legacy-effects";

const modals = useModalStore();
const players = usePlayersStore();
const scenario = useScenarioStore();
const windowWidth = ref(window.innerWidth);
const fabled = computed(() =>
  Array.from(scenario.fabled.values()).filter(
    (role: any) =>
      !players.fabled.some((fable) => fable.id === role.id) ||
      role.id === "deusexfiascoold2",
  ),
);
const tokenWidth = computed(() =>
  windowWidth.value * 0.06 >= 80 ? "width: 6vw" : "width: 80px",
);

function setFabled(role: any) {
  const payload = { fabled: role };
  players.setFabled(payload);
  emitLegacyMutation("players/setFabled", payload);
  modals.toggle("fabled");
}

function handleResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
</script>

<style scoped lang="scss">
@use "../../vars.scss" as *;

ul.tokens li {
  border-radius: 50%;
  // width: 120px;
  margin: 0.5%;
  transition: transform 500ms ease;

  &:hover {
    transform: scale(1.2);
    z-index: 10;
  }
}
</style>
