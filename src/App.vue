<template>
  <div
    id="app"
    @keyup="keyup"
    @keydown="keydown"
    tabindex="-1"
    :class="{
      night: grimoire.isNight,
      static: grimoire.isStatic
    }"
    :style="{
      backgroundImage: grimoire.background
        ? `url('${grimoire.background}')`
        : ''
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
      <TownInfo v-if="players.length && !session.nomination"></TownInfo>
      <Vote v-if="session.nomination"></Vote>
    </transition>
    <TownSquare></TownSquare>
    <Menu ref="menu" @trigger="handleTrigger($event)"></Menu>
    <ImageCropper ref="imageCropper"/>
    <EditionModal />
    <FabledModal />
    <RolesModal />
    <ReferenceModal />
    <NightOrderModal />
    <VoteHistoryModal />
    <GameStateModal />
    <InputModal ref="input"/>
    <GroupChatModal/>
    <VersionModal/>
    <Gradients />
    <!-- <span id="version">v{{ version }}</span> -->
  </div>
</template>

<script>
import { mapState } from "vuex";
import { version } from "../package.json";
import TownSquare from "./components/TownSquare";
import TownInfo from "./components/TownInfo";
import Menu from "./components/Menu";
import ImageCropper from "./components/ImageCropper";
import RolesModal from "./components/modals/RolesModal";
import EditionModal from "./components/modals/EditionModal";
import Intro from "./components/Intro";
import ReferenceModal from "./components/modals/ReferenceModal";
import Vote from "./components/Vote";
import Gradients from "./components/Gradients";
import NightOrderModal from "./components/modals/NightOrderModal";
import FabledModal from "@/components/modals/FabledModal";
import VoteHistoryModal from "@/components/modals/VoteHistoryModal";
import GameStateModal from "@/components/modals/GameStateModal";
import InputModal from "@/components/modals/InputModal.vue";
import GroupChatModal from "./components/modals/GroupChatModal.vue";
import VersionModal from "./components/modals/VersionModal.vue";

export default {
  components: {
    GameStateModal,
    VoteHistoryModal,
    FabledModal,
    NightOrderModal,
    Vote,
    ReferenceModal,
    Intro,
    TownInfo,
    TownSquare,
    Menu,
    ImageCropper,
    EditionModal,
    RolesModal,
    InputModal,
    GroupChatModal,
    VersionModal,
    Gradients
  },
  computed: {
    ...mapState(["grimoire", "session", "modals"]),
    ...mapState("players", ["players"])
  },
  data() {
    return {
      version
    };
  },
  async mounted() {
  this.$store.dispatch("checkVersion");
  
  // Original socket.js logic is now here
  const pathname = window.location.pathname;
  const sessionId = window.location.hash.substr(1);

  if (pathname === "/" && sessionId && this.session.sessionId === "") {
    
    // Set initial session state
    this.$store.commit("session/setSpectator", true);
    this.$store.commit("toggleGrimoire", false);

    let finalName = this.session.playerName; // Get existing name if any

    if (!finalName) {
      const input = await this.showInputModal({
        inputType: "changeName",
        inputModal: "input",
        inputData: {
          name: ["输入玩家昵称"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;
      
      finalName = input[0];
    }
    
    // Now handle the result
    if (finalName) {
      this.$store.commit("session/setPlayerName", finalName);
      this.$store.commit("session/setSessionId", sessionId);
    } else {
      // User cancelled input, so don't join the session
      this.$store.commit("session/setSessionId", "");
    }

  } else if (pathname === "/" && sessionId && sessionId != this.session.sessionId) {
    await this.showInputModal({
      inputType: "alert",
      inputModal: "text",
      inputData: {
        name: [`已经在房间${this.session.sessionId}中，如需换房间请退出重进！`],
      }
    }).catch(() => {
      return null;
    });
    return;
  }

  // Clear hash after processing
  window.location.hash = "";
  
  // You would also call your socket connection setup here if needed
  // this.setupSocketConnection(); 
},
  methods: {
    async showInputModal({ inputType, inputModal, inputData }) {
      return new Promise((resolve, reject) => {
        this.$store.commit("session/setInputResolver", resolve);
        this.$store.commit("session/setInputRejecter", reject);

        this.$store.commit("session/setInputType", inputType);
        this.$store.commit("session/setInputModal", inputModal);
        this.$store.commit("session/setInputData", inputData);

        this.$store.commit("toggleModal", "input");
      });
    },
    keyup({ key, ctrlKey, metaKey }) {
      if (ctrlKey || metaKey) return;
      if (this.session.isTyping && key != "Escape") return;
      switch (key.toLocaleLowerCase()) {
        case "m":
          this.$store.commit("toggleMenu");
          break;
        case "g":
          this.$store.commit("toggleGrimoire");
          break;
        // case "a":
        //   this.$refs.menu.addPlayer();
        //   break;
        case "h":
          this.$refs.menu.hostSession();
          break;
        case "j":
          this.$refs.menu.joinSession();
          break;
        case "r":
          this.$store.commit("toggleModal", "reference");
          break;
        case "n":
          this.$store.commit("toggleModal", "nightOrder");
          break;
        case "e":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "edition");
          break;
        case "c":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "roles");
          break;
        case "f":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "fabled");
          break;
        case "v":
          if (this.session.voteHistory.length || !this.session.isSpectator) {
            this.$store.commit("toggleModal", "voteHistory");
          }
          break;
        case "d":
          if (this.session.isSpectator) return;
          this.$store.commit("toggleModal", "groupChat");
          break;
        case "s":
          if (this.session.isSpectator) return;
          this.$refs.menu.toggleNight();
          break;
        case "t":
          if (this.session.isSpectator) return;
          this.$refs.menu.setTimer();
          break;
        case "escape":
          if (this.modals && this.modals.input) {
            this.$refs.input.close();
          } else {
            this.$store.commit("toggleModal");
          }
          break;
        case "f2":
          this.$refs.menu.stopListening('keyboard');
          break;
      }
    },
    keydown({ key, ctrlKey, metaKey }) {
      if (ctrlKey || metaKey) return;
      switch (key.toLocaleLowerCase()) {
        case "f2":
          if (this.session.claimedSeat < 0) return;
          if (this.session.listeningFrame) return;
          this.$refs.menu.startListening('keyboard');
          break;
      }
    },
    handleTrigger ([method]) {
      if (typeof this.$refs.menu[method] === 'function') {
        this.$refs.menu[method]();
      }
      if (typeof this.$refs.imageCropper[method] === 'function') {
        this.$refs.imageCropper[method]();
      }
    }
  }
};
</script>

<style lang="scss">
@import "vars";

@font-face {
  font-family: "Papyrus";
  src: url("assets/fonts/papyrus.eot"); /* IE9*/
  src: url("assets/fonts/papyrus.eot?#iefix") format("embedded-opentype"),
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

@import "media";

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

#app {
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
  box-shadow: inset 0 1px 1px #9c9c9c, 0 0 10px #000;
  background: radial-gradient(
        at 0 -15%,
        rgba(#fff, 0.07) 70%,
        rgba(#fff, 0) 71%
      )
      0 0/ 80% 90% no-repeat content-box,
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
    background: radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#0031ad, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #001142) border-box;
    box-shadow: inset 0 1px 1px #002c9c, 0 0 10px #000;
    &:hover:not(.disabled) {
      color: #008cf7;
    }
  }
  &.demon {
    background: radial-gradient(
          at 0 -15%,
          rgba(255, 255, 255, 0.07) 70%,
          rgba(255, 255, 255, 0) 71%
        )
        0 0/80% 90% no-repeat content-box,
      linear-gradient(#ad0000, rgba(5, 0, 0, 0.22)) content-box,
      linear-gradient(#292929, #420000) border-box;
    box-shadow: inset 0 1px 1px #9c0000, 0 0 10px #000;
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
#app > .backdrop {
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

#app.night > .backdrop {
  opacity: 0.5;
}

#app:focus {
  outline: none;
}
</style>
