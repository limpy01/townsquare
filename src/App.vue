<template>
  <div
    id="townsquare-app"
    @keyup="keyup"
    @keydown="keydown"
    tabindex="-1"
    :class="{
      night: grimoire.isNight,
      static: grimoire.isStatic,
    }"
    :style="{
      backgroundImage: grimoire.background
        ? `url('${grimoire.background}')`
        : '',
    }"
  >
    <video
      id="background"
      v-if="grimoire.background && grimoire.background.match(/\.(mp4|webm)$/i)"
      :src="grimoire.background"
      autoplay
      loop
    ></video>
    <div class="backdrop"></div>
    <transition name="blur">
      <Intro v-if="!players.length" @trigger="handleTrigger($event)"></Intro>
      <TownInfo v-else-if="!voting.nomination"></TownInfo>
      <Vote v-else></Vote>
    </transition>
    <TownSquare></TownSquare>
    <Menu ref="menu" @trigger="handleTrigger($event)"></Menu>
    <ImageCropper ref="imageCropper" />
    <EditionModal />
    <FabledModal />
    <RolesModal />
    <DrawModal />
    <ReferenceModal />
    <NightOrderModal />
    <VoteHistoryModal />
    <GameStateModal />
    <InputModal ref="input" />
    <GroupChatModal />
    <VersionModal />
    <LegalModal />
    <Gradients />
    <!-- <span id="version">v{{ version }}</span> -->
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { parseDynamicInitResponse } from "@townsquare/contracts/dynamic-init";
import { useLobbyStore } from "./stores/lobby";
import { useInteractionStore } from "./stores/interaction";
import { useAudioStore } from "./stores/audio";
import { useVotingStore } from "./stores/voting";
import { useProfileStore } from "./stores/profile";
import { usePlayersStore } from "./stores/players";
import { useGrimoireStore } from "./stores/grimoire";
import { useSessionIdentityStore } from "./stores/session-identity";
import { useModalStore } from "./stores/modals";
import { useInputStore } from "./stores/input";
import { useAppMetaStore } from "./stores/app-meta";
import { showInputModal } from "./services/input-modal";
import { apiBase } from "./config";
import { emitGameEvent } from "./store/game-events";
import TownSquare from "./components/TownSquare.vue";
import TownInfo from "./components/TownInfo.vue";
import Menu from "./components/Menu.vue";
import ImageCropper from "./components/ImageCropper.vue";
import Intro from "./components/Intro.vue";
import Vote from "./components/Vote.vue";
import Gradients from "./components/Gradients.vue";
import InputModal from "./components/modals/InputModal.vue";

const RolesModal = defineAsyncComponent(
  () => import("./components/modals/RolesModal.vue"),
);
const DrawModal = defineAsyncComponent(
  () => import("./components/modals/DrawModal.vue"),
);
const EditionModal = defineAsyncComponent(
  () => import("./components/modals/EditionModal.vue"),
);
const ReferenceModal = defineAsyncComponent(
  () => import("./components/modals/ReferenceModal.vue"),
);
const NightOrderModal = defineAsyncComponent(
  () => import("./components/modals/NightOrderModal.vue"),
);
const FabledModal = defineAsyncComponent(
  () => import("./components/modals/FabledModal.vue"),
);
const VoteHistoryModal = defineAsyncComponent(
  () => import("./components/modals/VoteHistoryModal.vue"),
);
const GameStateModal = defineAsyncComponent(
  () => import("./components/modals/GameStateModal.vue"),
);
const GroupChatModal = defineAsyncComponent(
  () => import("./components/modals/GroupChatModal.vue"),
);
const VersionModal = defineAsyncComponent(
  () => import("./components/modals/VersionModal.vue"),
);
const LegalModal = defineAsyncComponent(
  () => import("./components/modals/LegalModal.vue"),
);

const grimoire = useGrimoireStore();
const session = useSessionIdentityStore();
const lobby = useLobbyStore();
const modals = useModalStore();
const playersState = usePlayersStore();
const players = computed(() => playersState.players);
const voting = useVotingStore();
const profile = useProfileStore();
const interaction = useInteractionStore();
const audio = useAudioStore();
const appMeta = useAppMetaStore();
const menu = ref<InstanceType<typeof Menu> | null>(null);
const imageCropper = ref<InstanceType<typeof ImageCropper> | null>(null);

async function initialize() {
  const pathname = window.location.pathname;
  const sessionId = window.location.hash.substr(1);

  if (pathname === "/") {
    void fetchInit();

    if (sessionId && session.sessionId === "") {
      // Set initial session state
      session.setSpectator(true);
      grimoire.toggle("isPublic", false);
      emitGameEvent("toggleGrimoire", false);

      let finalName = profile.playerName;

      if (!finalName) {
        const input = await showInputModal({
          inputType: "changeName",
          inputModal: "input",
          inputData: {
            name: ["输入玩家昵称"],
            length: 1,
            placeholder: [""],
          },
        }).catch(() => {
          return null;
        });
        if (input === null) return;

        finalName = Array.isArray(input) ? input[0] ?? "" : "";
      }

      // Now handle the result
      if (finalName) {
        profile.setPlayerName(finalName);
        emitGameEvent("session/setPlayerName", finalName);
        session.setSessionId(sessionId);
        emitGameEvent("session/setSessionId", sessionId);
      } else {
        // User cancelled input, so don't join the session
        session.setSessionId("");
        emitGameEvent("session/setSessionId", "");
      }
    } else if (
      pathname === "/" &&
      sessionId &&
      sessionId != session.sessionId
    ) {
      await showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: [`已经在房间${session.sessionId}中，如需换房间请退出重进！`],
        },
      }).catch(() => {
        return null;
      });
      return;
    }
    // Clear hash after processing
    window.location.hash = "";
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
}

async function fetchInit() {
  try {
    const response = await fetch(`${apiBase}/dynamic/init`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const { payload } = parseDynamicInitResponse(await response.json());
    appMeta.setLatestVersion(payload.version);
    appMeta.setFloatingNotice(payload.floatingNotice);
    if (
      appMeta.version !== appMeta.latestVersion ||
      appMeta.latestVersion !== appMeta.lastVersion
    ) {
      modals.toggle("version");
    }
  } catch {
    return null;
  }
}

function handleVisibilityChange() {
  lobby.setAllowReconnect(document.visibilityState === "visible");
}

function keyup({ key, ctrlKey, metaKey }: KeyboardEvent) {
  if (ctrlKey || metaKey) return;
  if (interaction.isTyping && key != "Escape") return;
  switch (key.toLocaleLowerCase()) {
    case "m":
      grimoire.toggle("isMenuOpen");
      break;
    case "g":
      grimoire.toggle("isPublic");
      emitGameEvent("toggleGrimoire");
      break;
    // case "a":
    //   this.$refs.menu.addPlayer();
    //   break;
    case "h":
      menu.value?.hostSession();
      break;
    case "j":
      menu.value?.joinSession();
      break;
    case "r":
      modals.toggle("reference");
      break;
    case "n":
      modals.toggle("nightOrder");
      break;
    case "e":
      if (session.isSpectator) return;
      modals.toggle("edition");
      break;
    case "c":
      if (session.isSpectator) return;
      modals.toggle("roles");
      break;
    case "f":
      if (session.isSpectator) return;
      modals.toggle("fabled");
      break;
    case "v":
      if (voting.voteHistory.length || !session.isSpectator) {
        modals.toggle("voteHistory");
      }
      break;
    case "d":
      if (session.isSpectator) return;
      modals.toggle("groupChat");
      break;
    case "s":
      if (session.isSpectator) return;
      menu.value?.toggleNight();
      break;
    case "t":
      if (session.isSpectator) return;
      menu.value?.setTimer();
      break;
    case "escape":
      if (modals.input) {
        useInputStore().close();
      } else {
        modals.closeAll();
      }
      break;
    case "f2":
      menu.value?.stopListening("keyboard");
      break;
  }
}

function keydown({ key, ctrlKey, metaKey }: KeyboardEvent) {
  if (ctrlKey || metaKey) return;
  switch (key.toLocaleLowerCase()) {
    case "f2":
      if (session.claimedSeat < 0 || audio.listeningFrame) return;
      menu.value?.startListening("keyboard");
      break;
  }
}

type AppTrigger = "hostSession" | "joinSession" | "uploadAvatar";

function handleTrigger([command]: [AppTrigger]) {
  switch (command) {
    case "hostSession":
      void menu.value?.hostSession();
      break;
    case "joinSession":
      void menu.value?.joinSession();
      break;
    case "uploadAvatar":
      void imageCropper.value?.uploadAvatar();
      break;
  }
}

onMounted(initialize);
onBeforeUnmount(() =>
  document.removeEventListener("visibilitychange", handleVisibilityChange),
);
</script>

<style lang="scss">
@use "styles/app-shell";
</style>
