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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
import { emitLegacyMutation } from "./store/legacy-effects";
import TownSquare from "./components/TownSquare.vue";
import TownInfo from "./components/TownInfo.vue";
import Menu from "./components/Menu.vue";
import ImageCropper from "./components/ImageCropper.vue";
import RolesModal from "./components/modals/RolesModal.vue";
import DrawModal from "./components/modals/DrawModal.vue";
import EditionModal from "./components/modals/EditionModal.vue";
import Intro from "./components/Intro.vue";
import ReferenceModal from "./components/modals/ReferenceModal.vue";
import Vote from "./components/Vote.vue";
import Gradients from "./components/Gradients.vue";
import NightOrderModal from "./components/modals/NightOrderModal.vue";
import FabledModal from "./components/modals/FabledModal.vue";
import VoteHistoryModal from "./components/modals/VoteHistoryModal.vue";
import GameStateModal from "./components/modals/GameStateModal.vue";
import InputModal from "./components/modals/InputModal.vue";
import GroupChatModal from "./components/modals/GroupChatModal.vue";
import VersionModal from "./components/modals/VersionModal.vue";
import LegalModal from "./components/modals/LegalModal.vue";

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
      emitLegacyMutation("toggleGrimoire", false);

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
        emitLegacyMutation("session/setPlayerName", finalName);
        session.setSessionId(sessionId);
        emitLegacyMutation("session/setSessionId", sessionId);
      } else {
        // User cancelled input, so don't join the session
        session.setSessionId("");
        emitLegacyMutation("session/setSessionId", "");
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
      emitLegacyMutation("toggleGrimoire");
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
@use "vars" as *;
@use "media";

@font-face {
  font-family: "Papyrus";
  src: url("assets/fonts/papyrus.eot"); /* IE9*/
  src:
    url("assets/fonts/papyrus.eot?#iefix") format("embedded-opentype"),
    /* IE6-IE8 */ url("assets/fonts/papyrus.woff2") format("woff2"),
    /* chrome firefox */ url("assets/fonts/papyrus.woff") format("woff"),
    /* chrome firefox */ url("assets/fonts/papyrus.ttf") format("truetype"),
    /* chrome firefox opera Safari, Android, iOS 4.2+*/
      url("assets/fonts/papyrus.svg#PapyrusW01") format("svg"); /* iOS 4.1- */
}

@font-face {
  font-family: PiratesBay;
  src: url("assets/fonts/piratesbay.ttf");
  font-display: swap;
}

html,
body {
  font-size: 1.2em;
  line-height: 1.4;
  background: url("assets/background.jpg") center center;
  background-size: cover;
  color: white;
  height: 100%;
  font-family: "Roboto Condensed", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  padding: 0;
  margin: 0;
  overflow: hidden;
}

@include media.responsive;

* {
  box-sizing: border-box;
  position: relative;
}

a {
  color: $townsfolk;
  &:hover {
    color: $demon;
  }
}

h1,
h2,
h3,
h4,
h5 {
  margin: 0;
  text-align: center;
  font-family: PiratesBay, sans-serif;
  letter-spacing: 1px;
  font-weight: normal;
}

ul {
  list-style-type: none;
  margin: 0;
  padding: 0;
}

#townsquare-app {
  height: 100%;
  background-position: center center;
  background-size: cover;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;

  // disable all animations
  &.static *,
  &.static *:after,
  &.static *:before {
    transition: none !important;
    animation: none !important;
  }
}

#app {
  height: 100%;
}

#version {
  position: absolute;
  text-align: right;
  right: 10px;
  bottom: 10px;
  font-size: 60%;
  opacity: 0.5;
}

.blur-enter-active,
.blur-leave-active {
  transition: all 250ms;
  filter: blur(0);
}
.blur-enter,
.blur-leave-to {
  opacity: 0;
  filter: blur(20px);
}

// Buttons
.button-group {
  display: flex;
  align-items: center;
  justify-content: center;
  align-content: center;
  .button {
    margin: 5px 0;
    border-radius: 0;
    &:first-child {
      border-top-left-radius: 15px;
      border-bottom-left-radius: 15px;
    }
    &:last-child {
      border-top-right-radius: 15px;
      border-bottom-right-radius: 15px;
    }
  }
}
.button {
  padding: 0;
  border: solid 0.125em transparent;
  border-radius: 15px;
  box-shadow:
    inset 0 1px 1px #9c9c9c,
    0 0 10px #000;
  background:
    radial-gradient(at 0 -15%, rgba(#fff, 0.07) 70%, rgba(#fff, 0) 71%) 0 0/ 80%
      90% no-repeat content-box,
    linear-gradient(#4e4e4e, #040404) content-box,
    linear-gradient(#292929, #010101) border-box;
  color: white;
  font-weight: bold;
  text-shadow: 1px 1px rgba(0, 0, 0, 0.5);
  line-height: 170%;
  margin: 5px auto;
  cursor: pointer;
  transition: all 200ms;
  white-space: nowrap;
  &:hover {
    color: red;
  }
  &.disabled {
    color: gray;
    cursor: default;
    opacity: 0.75;
  }
  &:before,
  &:after {
    content: " ";
    display: inline-block;
    width: 10px;
    height: 10px;
  }
  &.townsfolk {
    background:
      radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#0031ad, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #001142) border-box;
    box-shadow:
      inset 0 1px 1px #002c9c,
      0 0 10px #000;
    &:hover:not(.disabled) {
      color: #008cf7;
    }
  }
  &.demon {
    background:
      radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#ad0000, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #420000) border-box;
    box-shadow:
      inset 0 1px 1px #9c0000,
      0 0 10px #000;
  }
}

/* video background */
video#background {
  position: absolute;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Night phase backdrop */
#townsquare-app > .backdrop {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  top: 0;
  pointer-events: none;
  background: black;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 1) 0%,
    rgba(1, 22, 46, 1) 50%,
    rgba(0, 39, 70, 1) 100%
  );
  opacity: 0;
  transition: opacity 1s ease-in-out;
  &:after {
    content: " ";
    display: block;
    width: 100%;
    padding-right: 2000px;
    height: 100%;
    background: url("assets/clouds.png") repeat;
    background-size: 2000px auto;
    animation: move-background 120s linear infinite;
    opacity: 0.3;
  }
}

@keyframes move-background {
  from {
    transform: translate3d(-2000px, 0px, 0px);
  }
  to {
    transform: translate3d(0px, 0px, 0px);
  }
}

#townsquare-app.night > .backdrop {
  opacity: 0.5;
}

#townsquare-app:focus {
  outline: none;
}
</style>
