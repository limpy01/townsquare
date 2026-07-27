<template>
  <Modal
    v-if="modals.input"
    @close="close"
    :name="'input'"
    :type="inputState.inputModal"
  >
    <span v-if="!!warningMessage" class="warning">{{ warningMessage }}</span>
    <div v-if="inputState.inputModal === 'input'">
      <form class="input-box" @submit.prevent="confirmInput">
        <div v-for="n in inputLength" :key="n">
          <label>{{ inputNames[n - 1] }}</label>
          <input
            type="text"
            :id="'input-' + n"
            :ref="(element) => setInputRef(n, element)"
            autocomplete="off"
            @focus="typing"
            @blur="notTyping"
            v-model="input[n - 1]"
          />
        </div>
        <div class="input-actions">
          <button type="submit" class="confirm">确认</button>
          <button type="button" @click="close">取消</button>
        </div>
      </form>
    </div>
    <div v-else-if="inputState.inputModal === 'confirm'">
      <form
        class="input-box confirm-box"
        @submit.prevent="confirmYes"
        tabindex="-1"
      >
        <label>{{ inputNames[0] }}</label>
        <div class="input-actions">
          <button type="submit" class="confirm" ref="confirmYesButton">
            确认
          </button>
          <button type="button" @click="close" class="cancel">取消</button>
        </div>
      </form>
    </div>
    <div v-else-if="inputState.inputModal === 'text'">
      <form class="input-box text-box" @submit.prevent="close" tabindex="-1">
        <label>{{ inputNames[0] }}</label>
        <div class="input-actions">
          <button type="submit" class="confirm" ref="confirmClose">关闭</button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import Modal from "./Modal.vue";
import { useLobbyStore } from "../../stores/lobby";
import { useInputStore } from "../../stores/input";
import { useInteractionStore } from "../../stores/interaction";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";

const modals = useModalStore();
const inputState = useInputStore();
const interaction = useInteractionStore();
const lobby = useLobbyStore();
const players = usePlayersStore();
const input = ref([""]);
const warningMessage = ref("");
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const inputRefs = ref<Record<number, HTMLInputElement>>({});
const confirmYesButton = ref<HTMLButtonElement | null>(null);
const confirmClose = ref<HTMLButtonElement | null>(null);
const inputNames = computed(() => inputState.inputData.name ?? []);
const inputLength = computed(() => inputState.inputData.length ?? 0);

watch(
  () => inputState.inputData.placeholder,
  (placeholder) => {
    if (Array.isArray(placeholder) && placeholder.length > 0) {
      input.value = [...placeholder];
    }
  },
  { immediate: true },
);

watch(
  () => modals.input,
  (isOpen) => {
    if (!isOpen) return;

    nextTick(() => {
      if (inputState.inputModal === "input") {
        selectInput(1);
      } else if (inputState.inputModal === "confirm") {
        confirmYesButton.value?.focus();
      } else if (inputState.inputModal === "text") {
        confirmClose.value?.focus();
      }
    });
  },
);

onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));

function setInputRef(index: number, element: unknown) {
  if (element instanceof HTMLInputElement) inputRefs.value[index] = element;
}

function selectInput(index: number) {
  inputRefs.value[index]?.select();
}

function typing() {
  interaction.setTyping(true);
}

function notTyping() {
  interaction.setTyping(false);
}

function confirmInput() {
  const allowEmpty = ["bootlegger"];
  if (
    inputState.inputModal === "input" &&
    !allowEmpty.includes(inputState.inputType) &&
    (input.value.length <= 0 || input.value.some((item) => item === ""))
  ) {
    close();
    return;
  }
  switch (inputState.inputType) {
    case "background":
      break;
    case "changeName":
      {
        if (
          (input.value[0] ?? "").trim() === "" ||
          (input.value[0] ?? "").trim() === "空座位" ||
          (input.value[0] ?? "").trim() === "说书人"
        ) {
          warningMessage.value = "昵称非法！";
          nextTick(() => selectInput(1));
          return;
        }
      }
      break;
    case "hostSession":
      {
        const sessionId = input.value[0] ?? "";
        const numPlayers = input.value[1] ?? "";
        if (
          !Number(sessionId) ||
          Number(sessionId) < 0 ||
          Number(sessionId) >= 10000
        ) {
          warningMessage.value = "请输入大于0小于10000的数字！";
          return;
        }
        if (lobby.rooms?.includes(Number(sessionId).toString())) {
          warningMessage.value = `房间"${Number(sessionId)}"已经存在说书人！`;
          return;
        }
        if (!Number(numPlayers) || Number(numPlayers) <= 0) {
          warningMessage.value = "请输入正确人数！";
          return;
        }
      }
      break;
    case "joinSession":
      {
        let sessionId = input.value[0] ?? "";
        if (sessionId.match(/^https?:\/\//i)) {
          sessionId = sessionId.split("#").pop() ?? "";
        }
        if (!lobby.rooms?.includes(sessionId)) {
          warningMessage.value = `房间"${sessionId}"不存在！`;
          return;
        }
      }
      break;
    case "seatNum":
      {
        let seatNum = Number(input.value[0]);
        if (
          !seatNum ||
          Math.floor(seatNum) != seatNum ||
          seatNum > players.players.length
        ) {
          warningMessage.value = "无效的座位号！";
          return;
        }
      }
      break;
    case "bootlegger":
      break;
    case "timer":
      break;
    case "pronouns":
      break;
    case "changeNameSt":
      if (
        (input.value[0] ?? "").trim() === "" ||
        (input.value[0] ?? "").trim() === "空座位" ||
        (input.value[0] ?? "").trim() === "说书人"
      ) {
        warningMessage.value = "昵称非法！";
        nextTick(() => selectInput(1));
        return;
      }
      break;
    case "reminder":
      break;
    case "json":
      break;
  }

  if (inputState.inputResolver) inputState.resolve(input.value);

  close();
}

function confirmYes() {
  inputState.resolve(true);
  close();
}

function close() {
  interaction.setTyping(false);
  input.value = [""];
  warningMessage.value = "";
  inputState.close();

  nextTick(() => document.getElementById("app")?.focus());
}

function handleResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}
</script>

<style scoped lang="scss">
@use "sass:color";
@use "../../vars.scss" as *;

.input-box {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

.input-actions {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.input-box input[type="text"] {
  width: 100%;
  padding: 10px 15px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 20px;
  height: 35px;
  box-sizing: border-box;
}

.input-box input:focus {
  outline: none;
}

.input-box button {
  padding: 8px 15px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-weight: bold;
}

.input-box button.confirm {
  background-color: #0a65dd;
  color: white;
  transition: background-color 0.3s;
}

.input-box button.confirm:focus {
  outline: none;
}

.input-box button.confirm:hover {
  background-color: color.adjust(#0a65dd, $lightness: -10%);
}

.input-box button[type="button"] {
  background-color: #e84b20;
  color: white;
  transition: background-color 0.3s;
}

.input-box button[type="button"]:hover {
  background-color: color.adjust(#e84b20, $lightness: -10%);
}

.warning {
  color: red;
}
</style>
