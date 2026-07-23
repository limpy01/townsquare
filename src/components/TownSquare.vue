<template>
  <div
    id="townsquare"
    class="square"
    :class="{
      public: grimoire.isPublic,
      spectator: session.isSpectator,
      vote: voting.nomination,
    }"
  >
    <audio
      src="../assets/sounds/countdown.mp3"
      preload="auto"
      ref="countdownAudio"
    ></audio>
    <ul class="circle" :class="['size-' + players.length]" :style="orientation">
      <Player
        v-for="(player, index) in players"
        :key="index"
        :player="player"
        @trigger="handleTrigger(index, $event)"
        :class="{
          from: Math.max(swap, move, nominate) === index,
          swap: swap > -1,
          move: move > -1,
          nominate: nominate > -1,
        }"
      ></Player>
    </ul>

    <div
      class="bluffs"
      v-if="players.length"
      ref="bluffs"
      :class="{ closed: !isBluffsOpen }"
    >
      <h3>
        <span v-if="session.isSpectator" style="font-size: 100%"
          >不在场身份</span
        >
        <span v-else style="font-size: 100%">恶魔的伪装身份</span>
        <font-awesome-icon icon="times-circle" @click.stop="toggleBluffs" />
        <font-awesome-icon icon="plus-circle" @click.stop="toggleBluffs" />
      </h3>
      <ul>
        <li
          v-for="index in bluffSize"
          :key="index"
          @click="openRoleModal(index * -1)"
          :style="isBluffsOpen ? floatingZoom : ''"
        >
          <Token :role="bluffs[index - 1]"></Token>
        </li>
      </ul>
    </div>

    <div class="fabled" :class="{ closed: !isFabledOpen }" v-if="fabled.length">
      <h3>
        <span>传奇角色</span>
        <font-awesome-icon icon="times-circle" @click.stop="toggleFabled" />
        <font-awesome-icon icon="plus-circle" @click.stop="toggleFabled" />
      </h3>
      <ul>
        <li
          v-for="(role, index) in fabled"
          v-show="index === 0 || isFabledOpen"
          :key="index"
          @click="removeFabled(index)"
          :style="floatingZoom"
        >
          <div v-if="index === 0">
            <div class="newMessage" v-show="chat.storytellerUnread > 0">
              {{ chat.storytellerUnread }}
            </div>
          </div>
          <div
            class="night-order first"
            v-if="nightOrder.get(role).first && grimoire.isNightOrder"
          >
            <em>{{ nightOrder.get(role).first }}.</em>
            <span v-if="role.firstNightReminder">{{
              role.firstNightReminder
            }}</span>
          </div>
          <div
            class="night-order other"
            v-if="nightOrder.get(role).other && grimoire.isNightOrder"
          >
            <em>{{ nightOrder.get(role).other }}.</em>
            <span v-if="role.otherNightReminder">{{
              role.otherNightReminder
            }}</span>
          </div>
          <Token :role="role"></Token>
        </li>
      </ul>
    </div>
    <a
      v-if="
        !!session.sessionId &&
        (!session.isSpectator ||
          !!connection.isHostAllowed ||
          !!connection.isJoinAllowed)
      "
      href="https://botcgrimoire.top/donation/"
      target="_blank"
      class="donation"
    >
      <span>支持</span>
    </a>

    <div v-if="session.isSpectator && isRole.length > 0" class="is-role">
      <font-awesome-icon
        :icon="['custom', isRole]"
        size="4x"
        :class="{ 'is-using-wraith': roleActivity.wraith.using }"
        @click="setUsingWraith()"
      />
    </div>

    <ReminderModal :player-index="selectedPlayer"></ReminderModal>
    <RoleModal :player-index="selectedPlayer"></RoleModal>

    <div
      v-show="interaction.isChatOpen"
      :class="{ chat: !isChatMin, chatMin: isChatMin }"
      :style="chatStyle"
    >
      <div class="title" @click="maximiseChat()">
        <div
          v-if="!isChatMin && isInGroup && isShowGroup"
          class="group"
          :style="groupStyle"
        >
          <div v-for="player in inGroupPlayers" :key="player.id">
            <span>（{{ player.index + 1 }}号）{{ player.name }}</span>
            <br />
          </div>
        </div>
        <div>
          <span
            ref="chatWith"
            style="cursor: text; user-select: text; pointer-events: auto"
          ></span>
          &nbsp;
          <span
            class="newMessage"
            v-show="session.isSpectator && chat.storytellerUnread > 0"
            >{{ chat.storytellerUnread }}</span
          >
          <em v-if="isInGroup && !isChatMin">
            <font-awesome-icon
              v-if="!isShowGroup"
              icon="arrow-circle-up"
              @click="toggleGroups()"
            />
            <font-awesome-icon
              v-else
              icon="arrow-circle-down"
              @click="toggleGroups()"
            />
          </em>
          <span
            :class="{ close: !isChatMin, open: isChatMin }"
            @click="toggleChat()"
          >
            <font-awesome-icon
              icon="times"
              :class="{ turnedIcon45: isChatMin }"
            />
          </span>
        </div>
      </div>
      <div ref="chatContent" class="content" @scroll="checkToBottom">
        <div
          v-for="(player, index) in chat.histories"
          :key="index"
          v-show="
            (session.isSpectator && player.id === session.stId) ||
            (!session.isSpectator && player.id === chattingPlayer)
          "
        >
          <ul v-for="(content, chatIndex) in player.chat" :key="chatIndex">
            {{
              content
            }}
          </ul>
        </div>
      </div>
      <form class="chatbox" @submit.prevent="sendChat">
        <input
          type="text"
          id="message"
          ref="message"
          autocomplete="off"
          class="edit"
          @focus="typing"
          @blur="notTyping"
          v-model="message"
          maxlength="250"
        />
        <button type="submit" class="send">发送</button>
        <div class="toBottom" v-if="false">
          移至底部
          <font-awesome-icon icon="arrow" />
        </div>
      </form>
    </div>
    <div v-if="appMeta.floatingNotice" id="floating-notice">
      <div class="floating-window">
        <span class="floating-text">{{ appMeta.floatingNotice }}</span>
      </div>
    </div>
    <div id="version">
      <a href="https://beian.miit.gov.cn/" target="_blank"
        >浙ICP备2024109577号-2</a
      >
    </div>
    <div id="copyright">
      <span> Copyright &copy; 2020 bra1n </span>
      <br />
      <span>
        Copyright &copy; 2026
        <a href="mailto:admin@botcgrimoire.top">@limpy01</a>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { computed, nextTick, reactive, ref, toRef, watch } from "vue";
import { useInteractionStore } from "../stores/interaction";
import { useChatStore } from "../stores/chat";
import { useSessionConnectionStore } from "../stores/session-connection";
import { useVotingStore } from "../stores/voting";
import { useRoleActivityStore } from "../stores/role-activity";
import { getNightOrder } from "../domain/night-order";
import { useViewport } from "../composables/use-viewport";
import { useProfileStore } from "../stores/profile";
import { useAppMetaStore } from "../stores/app-meta";
import { usePlayersStore } from "../stores/players";
import { useGrimoireStore } from "../stores/grimoire";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { commitGameCommand, gameCommands } from "../store/legacy-commands";
import Player from "./Player.vue";
import Token from "./Token.vue";
import ReminderModal from "./modals/ReminderModal.vue";
import RoleModal from "./modals/RoleModal.vue";

const playersState = usePlayersStore();
const grimoire = useGrimoireStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const appMeta = useAppMetaStore();
const interaction = useInteractionStore();
const chat = useChatStore();
const connection = useSessionConnectionStore();
const voting = useVotingStore();
const roleActivity = useRoleActivityStore();
const profile = useProfileStore();
const { width: windowWidth, height: windowHeight } = useViewport();
const countdownAudio = ref<HTMLAudioElement | null>(null);
const bluffsElement = ref<HTMLElement | null>(null);
const chatWith = ref<HTMLElement | null>(null);
const chatContent = ref<HTMLElement | null>(null);
const messageInput = ref<HTMLInputElement | null>(null);
const selectedPlayer = ref(0);
const context: any = reactive({ commands: gameCommands, $nextTick: nextTick });
Object.defineProperties(context, {
  grimoire: { get: () => grimoire },
  roles: { get: () => scenario.roles },
  session: { get: () => session },
  players: { get: () => playersState.players },
  bluffs: { get: () => playersState.bluffs },
  fabled: { get: () => playersState.fabled },
  appMeta: { get: () => appMeta },
  interaction: { get: () => interaction },
  chat: { get: () => chat },
  connection: { get: () => connection },
  voting: { get: () => voting },
  roleActivity: { get: () => roleActivity },
  profile: { get: () => profile },
  windowWidth: { get: () => windowWidth.value },
  windowHeight: { get: () => windowHeight.value },
  $refs: {
    get: () => ({
      countdownAudio: countdownAudio.value,
      bluffs: bluffsElement.value,
      chatWith: chatWith.value,
      chatContent: chatContent.value,
      message: messageInput.value,
    }),
  },
});

const options: any = {
  data() {
    return {
      bluffSize: 3,
      swap: -1,
      move: -1,
      nominate: -1,
      isBluffsOpen: true,
      isFabledOpen: true,
      isChatMin: false,
      minimising: false,
      chattingPlayer: "",
      chattingGroup: "",
      isShowGroup: false,
      message: "",
    };
  },
  methods: {
    removeFabled(index) {
      if (this.session.isSpectator) {
        if (index === 0) {
          if (this.session.claimedSeat >= 0) this.openChat(0); //open chat box if user is a player
        }
      } else {
        this.commands.commit("players/setFabled", { index });
      }
    },
    removePlayer(playerIndex) {
      if (this.session.isSpectator || this.voting.lockedVote) return;
      const { nomination } = this.voting;
      if (nomination) {
        if (nomination.includes(playerIndex)) {
          // abort vote if removed player is either nominator or nominee
          this.commands.commit("session/nomination");
        } else if (nomination[0] > playerIndex || nomination[1] > playerIndex) {
          // update nomination array if removed player has lower index
          this.commands.commit("session/setNomination", [
            nomination[0] > playerIndex ? nomination[0] - 1 : nomination[0],
            nomination[1] > playerIndex ? nomination[1] - 1 : nomination[1],
          ]);
        }
      }
      this.commands.commit("players/remove", playerIndex);
    },
    swapPlayer(from, to) {
      if (this.session.isSpectator || this.voting.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        this.swap = from;
      } else {
        if (this.voting.nomination) {
          // update nomination if one of the involved players is swapped
          const swapTo = this.players.indexOf(to);
          const updatedNomination = this.voting.nomination.map((nom) => {
            if (nom === this.swap) return swapTo;
            if (nom === swapTo) return this.swap;
            return nom;
          });
          if (
            this.voting.nomination[0] !== updatedNomination[0] ||
            this.voting.nomination[1] !== updatedNomination[1]
          ) {
            this.commands.commit("session/setNomination", updatedNomination);
          }
        }
        this.commands.commit("players/swap", [
          this.swap,
          this.players.indexOf(to),
        ]);
        this.cancel();
      }
    },
    movePlayer(from, to) {
      if (this.session.isSpectator || this.voting.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        this.move = from;
      } else {
        if (this.voting.nomination) {
          // update nomination if it is affected by the move
          const moveTo = this.players.indexOf(to);
          const updatedNomination = this.voting.nomination.map((nom) => {
            if (nom === this.move) return moveTo;
            if (nom > this.move && nom <= moveTo) return nom - 1;
            if (nom < this.move && nom >= moveTo) return nom + 1;
            return nom;
          });
          if (
            this.voting.nomination[0] !== updatedNomination[0] ||
            this.voting.nomination[1] !== updatedNomination[1]
          ) {
            this.commands.commit("session/setNomination", updatedNomination);
          }
        }
        this.commands.commit("players/move", [
          this.move,
          this.players.indexOf(to),
        ]);
        this.cancel();
      }
    },
    nominatePlayer(from, to) {
      if (this.session.isSpectator || this.voting.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        if (from !== this.nominate) {
          this.nominate = from;
        }
      } else {
        const nomination = [this.nominate, this.players.indexOf(to)];
        this.commands.commit("session/nomination", { nomination });
        this.cancel();
      }
    },
    cancel() {
      this.move = -1;
      this.swap = -1;
      this.nominate = -1;
    },
    addVote(playerIndex) {
      if (this.session.isSpectator) return;
      const player = this.players[playerIndex];
      const vote = player.votes + 1;
      this.commands.commit("players/update", {
        player,
        property: "votes",
        value: vote,
      });
    },
    subtractVote(playerIndex) {
      if (this.session.isSpectator) return;
      const player = this.players[playerIndex];
      const vote = player.votes - 1;
      if (vote < 1) return;
      this.commands.commit("players/update", {
        player,
        property: "votes",
        value: vote,
      });
    },
    setStoryTeller(playerIndex) {
      if (this.session.isSpectator) return;
      const player = this.players[playerIndex];
      if (player.id) {
        if (player.id != "host") return;
        this.commands.commit("players/update", {
          player,
          property: "id",
          value: "",
        });
        this.commands.commit("players/update", {
          player,
          property: "name",
          value: "",
        });
        this.commands.commit("players/update", {
          player,
          property: "isVoteless",
          value: false,
        });
        this.commands.commit("players/update", {
          player,
          property: "isDead",
          value: false,
        });
      } else {
        this.commands.commit("players/update", {
          player,
          property: "id",
          value: "host",
        });
        this.commands.commit("players/update", {
          player,
          property: "name",
          value: "说书人",
        });
        this.commands.commit("players/update", {
          player,
          property: "isVoteless",
          value: true,
        });
        this.commands.commit("players/update", {
          player,
          property: "isDead",
          value: true,
        });
      }
    },
    openChat(playerIndex, maximise = true) {
      if (maximise) this.maximiseChat();

      // display player name or ST in the chat title
      if (this.session.isSpectator) {
        const groupChats = this.chat.groups;
        const name = groupChats.length === 0 ? this.fabled[0].name : "群聊"; //if fabled is messed up this may cause issues
        this.$refs.chatWith.innerText = name;
        if (maximise) this.chat.clearStorytellerUnread();
      } else {
        this.chattingPlayer = this.players[playerIndex].id;
        this.chattingGroup = this.players[playerIndex].chatGroup;
        const name =
          this.chattingGroup === ""
            ? this.players[playerIndex].name
            : this.chat.groups.filter(
                (group) => group.id === this.chattingGroup,
              )[0].name;
        this.$refs.chatWith.innerText = name;
        if (maximise)
          this.commands.commit("players/setPlayerMessage", {
            playerId: this.chattingPlayer,
            num: 0,
          });
      }

      this.$nextTick(() => {
        this.scrollToBottom();
      });
    },
    toggleChat() {
      if (this.isChatMin) {
        this.maximiseChat();
      } else {
        this.minimiseChat();
      }
    },
    maximiseChat() {
      if (this.minimising) {
        this.minimising = false;
        return;
      }
      if (this.interaction.isChatOpen && !this.isChatMin) return;
      this.interaction.setChatOpen(true);
      this.isChatMin = false;

      this.$nextTick(() => {
        this.$refs.message.focus();
      });
    },
    minimiseChat() {
      this.isChatMin = true;
      this.minimising = true;
    },
    sendChat() {
      if (this.message === "") return;
      if (this.session.isSpectator && this.session.claimedSeat < 0) return;
      if (!this.session.isSpectator) {
        let seated = false;
        this.players.forEach((player) => {
          if (player.id === this.chattingPlayer) seated = true;
        });
        if (!seated) return;
      }
      const sender = this.profile.playerName;
      const sendingPlayerId = this.session.playerId;
      const message = sender.concat(": ", this.message);
      if (this.chattingGroup === "") {
        const receivingPlayerId = this.session.isSpectator
          ? "host"
          : this.chattingPlayer;
        this.commands.commit("session/updateChatSent", {
          message,
          sendingPlayerId,
          receivingPlayerId,
        });
      } else {
        const group = this.chat.groups.filter(
          (group) => group.id === this.chattingGroup,
        )[0];
        const playerIds = group.players.map((player) => player.id);
        playerIds.forEach((id) => {
          this.commands.commit("session/updateChatSent", {
            message,
            sendingPlayerId,
            receivingPlayerId: id,
          });
        });
      }

      if (!this.session.isSpectator) {
        const wraithMessage = `[亡魂][（说书人）${message}]`;
        const players = this.players.filter(
          (player) =>
            player.isWraith &&
            player.isUsingWraith &&
            player.isAllowRole &&
            !!player.id,
        );
        players.forEach((player) => {
          if (
            !(
              player.id === this.chattingPlayer ||
              player.chatGroup === this.chattingGroup
            )
          )
            this.commands.commit("session/updateChatSent", {
              message: wraithMessage,
              sendingPlayerId,
              receivingPlayerId: player.id,
            });
        });
        // this.commands.commit("session/setIsRole", {
        //   role: 'wraith',
        //   property: 'st',
        //   value: this.roleActivity.wraith.player + 1
        // });
        // 每10次互动会让暴露概率增加1%，最高10%
        // const prob = Math.min(0.05 + Math.floor(Math.min(this.roleActivity.wraith.st, this.roleActivity.wraith.player) / 10) * 0.01, this.roleActivity.wraith.probMax);
        // this.commands.commit("session/setIsRole", {
        //   role: 'wraith',
        //   property: 'prob',
        //   value: prob
        // });
      }

      this.message = "";

      this.$nextTick(() => {
        this.scrollToBottom();
      });
    },
    scrollToBottom() {
      this.$nextTick(() => {
        this.$refs.chatContent.scrollTop = this.$refs.chatContent.scrollHeight;
      });
      this.checkToBottom();
    },
    checkToBottom() {
      if (this.$refs.chatContent.scrollTop >= -20) {
        // 划至最底则删除红点
        if (!this.session.isSpectator) {
          this.commands.commit("players/setPlayerMessage", {
            playerId: this.chattingPlayer,
            num: 0,
          });
        } else {
          this.chat.clearStorytellerUnread();
        }
      }
    },
    typing() {
      this.interaction.setTyping(true);
      if (this.$refs.chatContent.scrollTop >= -20) {
        if (!this.session.isSpectator) {
          this.commands.commit("players/setPlayerMessage", {
            playerId: this.chattingPlayer,
            num: 0,
          });
        } else {
          this.chat.clearStorytellerUnread();
        }
      }
    },
    notTyping() {
      this.interaction.setTyping(false);
    },
  },
};

Object.assign(context, options.data.call(context));

const players = computed(() => playersState.players);
const bluffs = computed(() => playersState.bluffs);
const fabled = computed(() => playersState.fabled);
const roles = computed(() => scenario.roles);
const nightOrder = computed(() =>
  getNightOrder(
    playersState.players,
    playersState.fabled,
    playersState.firstNightOrder,
    playersState.otherNightOrder,
  ),
);
const bluffSize = toRef(context, "bluffSize");
const swap = toRef(context, "swap");
const move = toRef(context, "move");
const nominate = toRef(context, "nominate");
const isBluffsOpen = toRef(context, "isBluffsOpen");
const isFabledOpen = toRef(context, "isFabledOpen");
const isChatMin = toRef(context, "isChatMin");
const minimising = toRef(context, "minimising");
const chattingPlayer = toRef(context, "chattingPlayer");
const chattingGroup = toRef(context, "chattingGroup");
const isShowGroup = toRef(context, "isShowGroup");
const message = toRef(context, "message");
const orientation = computed(() => {
  const ratio = windowWidth.value / windowHeight.value;
  return windowWidth.value > windowHeight.value
    ? "height: 100%;"
    : "height: " + ratio * 100 + "%;";
});
const floatingZoom = computed(() => {
  const ratio = windowWidth.value / windowHeight.value;
  const size = ratio > 1 ? 14 : 8;
  return "height: " + size + "vh; width: " + size + "vh;";
});
const isInGroup = computed(() =>
  session.isSpectator ? chat.groups.length > 0 : chattingGroup.value !== "",
);
const chatStyle = computed(() => {
  if (isChatMin.value) return;
  const ratio = windowWidth.value / windowHeight.value;
  const width = ratio < 1 ? "300px" : "25%";
  const height =
    ratio < 1
      ? isInGroup.value && isShowGroup.value
        ? "450px"
        : "400px"
      : isInGroup.value && isShowGroup.value
      ? "calc(40% + 10vh)"
      : "40%";
  return `width: ${width}; height: ${height};`;
});
const groupStyle = computed(() => {
  const height = windowWidth.value / windowHeight.value < 1 ? "50px" : "10vh";
  return `height: ${height};`;
});
const inGroupPlayers = computed(() => {
  const groups = session.isSpectator
    ? chat.groups
    : chat.groups.filter((group) => group.id === chattingGroup.value);
  if (groups.length === 0) return [];

  return groups[0].players.flatMap((player) => {
    const index = playersState.players.findIndex(
      (candidate) => candidate.id === player.id,
    );
    return index === -1 ? [] : [{ id: player.id, name: player.name, index }];
  });
});
const isRole = computed(() => {
  const activeRoles = Object.keys(roleActivity.$state).filter(
    (roleId) => roleActivity[roleId].active === true,
  );
  return activeRoles.length > 1 ? activeRoles.slice(0, 1) : activeRoles;
});
const toggleBluffs = () => {
  isBluffsOpen.value = !isBluffsOpen.value;
};
const toggleFabled = () => {
  isFabledOpen.value = !isFabledOpen.value;
};
const toggleGroups = () => {
  isShowGroup.value = !isShowGroup.value;
};
const setUsingWraith = () => {
  commitGameCommand("session/setIsRole", {
    role: "wraith",
    property: "using",
    value: !roleActivity.wraith.using,
  });
};
const claimSeat = (playerIndex: number) => {
  if (!session.isSpectator) return;
  if (session.playerId === playersState.players[playerIndex].id) {
    commitGameCommand("session/claimSeat", -1);
  } else {
    commitGameCommand("session/claimSeat", playerIndex);
    commitGameCommand("session/createChatHistory", session.stId);
  }
};
const openReminderModal = (playerIndex: number) => {
  selectedPlayer.value = playerIndex;
  commitGameCommand("toggleModal", "reminder");
};
const openRoleModal = (playerIndex: number) => {
  const player = playersState.players[playerIndex];
  if (session.isSpectator && player?.role.team === "traveler") return;
  selectedPlayer.value = playerIndex;
  commitGameCommand("toggleModal", "role");
};

const methodNames = Object.keys(options.methods);
for (const name of methodNames)
  context[name] = options.methods[name].bind(context);
const {
  removeFabled,
  removePlayer,
  swapPlayer,
  movePlayer,
  nominatePlayer,
  cancel,
  addVote,
  subtractVote,
  setStoryTeller,
  openChat,
  toggleChat,
  maximiseChat,
  minimiseChat,
  sendChat,
  scrollToBottom,
  checkToBottom,
  typing,
  notTyping,
} = context;
type PlayerTrigger =
  | ["openReminderModal"]
  | ["openRoleModal"]
  | ["removePlayer"]
  | ["swapPlayer", unknown?]
  | ["movePlayer", unknown?]
  | ["nominatePlayer", unknown?]
  | ["cancel"]
  | ["claimSeat"]
  | ["setStoryTeller"]
  | ["openChat"]
  | ["addVote", unknown?]
  | ["subtractVote", unknown?];
const handleTrigger = (
  playerIndex: number,
  [action, target]: PlayerTrigger,
) => {
  switch (action) {
    case "openReminderModal":
      return openReminderModal(playerIndex);
    case "openRoleModal":
      return openRoleModal(playerIndex);
    case "removePlayer":
      return removePlayer(playerIndex);
    case "swapPlayer":
      return swapPlayer(playerIndex, target);
    case "movePlayer":
      return movePlayer(playerIndex, target);
    case "nominatePlayer":
      return nominatePlayer(playerIndex, target);
    case "cancel":
      return cancel();
    case "claimSeat":
      return claimSeat(playerIndex);
    case "setStoryTeller":
      return setStoryTeller(playerIndex);
    case "openChat":
      return openChat(playerIndex);
    case "addVote":
      return addVote(playerIndex);
    case "subtractVote":
      return subtractVote(playerIndex);
  }
};

watch(
  () => chat.histories,
  () => {
    nextTick(() => {
      if (
        chatContent.value.scrollTop >= -20 &&
        interaction.isChatOpen &&
        !isChatMin.value
      ) {
        scrollToBottom();
      }
    });
  },
  { deep: true },
);
watch(
  () => voting.isVoteInProgress,
  () => {
    nextTick(() => {
      if (voting.isVoteInProgress && !voting.lockedVote) {
        if (!grimoire.isMuted) {
          countdownAudio.value.currentTime = 0;
          countdownAudio.value.play();
        }
      } else {
        countdownAudio.value.pause();
        countdownAudio.value.currentTime = 0;
      }
    });
  },
);
watch(
  () => chat.groups,
  () => {
    nextTick(() => {
      if (interaction.isChatOpen && session.isSpectator) {
        openChat(0, false);
      } else if (interaction.isChatOpen && !session.isSpectator) {
        const index = playersState.players.findIndex(
          (player) => player.id === chattingPlayer.value,
        );
        if (index === -1) return;
        openChat(index, false);
      }
    });
  },
  { deep: true },
);
</script>

<style lang="scss">
@use "sass:math";
@use "../vars.scss" as *;

#townsquare {
  width: 100%;
  height: 100%;
  padding: 20px;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  flex-direction: row;
  position: relative;
}

.circle {
  padding: 0;
  width: 100%;
  height: 100%;
  list-style: none;
  margin: 0;

  > li {
    position: absolute;
    left: 50%;
    height: 50%;
    transform-origin: 0 100%;
    pointer-events: none;

    &:hover {
      z-index: 25 !important;
    }

    > .player {
      margin-left: -50%;
      width: 100%;
      pointer-events: all;
    }
    > .reminder {
      margin-left: -25%;
      width: 50%;
      pointer-events: all;
    }
  }
}

@mixin on-circle($item-count) {
  $angle: math.div(360, $item-count);
  $rot: 0;

  // rotation and tooltip placement
  @for $i from 1 through $item-count {
    &:nth-child(#{$i}) {
      transform: rotate($rot * 1deg);
      @if $i - 1 <= math.div($item-count, 2) {
        // first half of players
        z-index: $item-count - $i + 1;
        // open menu on the left
        .player > .menu {
          left: auto;
          right: 110%;
          margin-right: 15px;
          &:before {
            border-left-color: black;
            border-right-color: transparent;
            right: auto;
            left: 100%;
          }
        }
        .fold-enter-active,
        .fold-leave-active {
          transform-origin: right center;
        }
        .fold-enter,
        .fold-leave-to {
          transform: perspective(200px) rotateY(-90deg);
        }
        // show ability tooltip on the left
        .ability {
          right: 120%;
          left: auto;
          &:before {
            border-right-color: transparent;
            border-left-color: black;
            right: auto;
            left: 100%;
          }
        }
        .pronouns {
          left: 110%;
          right: auto;
          &:before {
            border-left-color: transparent;
            border-right-color: black;
            left: auto;
            right: 100%;
          }
        }
      } @else {
        // second half of players
        z-index: $i - 1;
      }

      > * {
        transform: rotate($rot * -1deg);
      }

      // animation cascade
      .life,
      .token,
      .shroud,
      .night-order,
      .seat {
        animation-delay: ($i - 1) * 50ms;
        transition-delay: ($i - 1) * 50ms;
      }

      // move reminders closer to the sides of the circle
      $q: math.div($item-count, 4);
      $x: $i - 1;
      @if $x < $q or ($x >= math.div($item-count, 2) and $x < $q * 3) {
        .player {
          margin-bottom: -10% + 20% * (1 - math.div($x % $q, $q));
        }
      } @else {
        .player {
          margin-bottom: -10% + 20% * math.div($x % $q, $q);
        }
      }
    }
    $rot: $rot + $angle;
  }
}

@for $i from 1 through 20 {
  .circle.size-#{$i} > li {
    @include on-circle($item-count: $i);
  }
}

/***** Demon bluffs / Fabled *******/
#townsquare > .bluffs,
#townsquare > .fabled {
  position: absolute;
  &.bluffs {
    bottom: 10px;
  }
  &.fabled {
    top: 10px;
  }
  left: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  border: 3px solid black;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
  transform-origin: bottom left;
  transform: scale(1);
  opacity: 1;
  transition: all 200ms ease-in-out;
  z-index: 50;

  > svg {
    position: absolute;
    top: 10px;
    right: 10px;
    cursor: pointer;
    &:hover {
      color: red;
    }
  }
  h3 {
    margin: 5px 1vh 0;
    display: flex;
    align-items: center;
    align-content: center;
    justify-content: center;
    span {
      flex-grow: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    svg {
      cursor: pointer;
      flex-grow: 0;
      &.fa-times-circle {
        margin-left: 0vh;
      }
      &.fa-plus-circle {
        margin-left: 0vh;
        display: none;
      }
      &:hover path {
        fill: url(#demon);
        stroke-width: 30px;
        stroke: white;
      }
    }
  }
  ul {
    display: flex;
    align-items: center;
    justify-content: center;
    li {
      margin: 0 0.5%;
      display: inline-block;
      transition: all 250ms;
    }
  }
  &.closed {
    svg.fa-times-circle {
      display: none;
    }
    svg.fa-plus-circle {
      display: block;
    }
    ul li {
      width: 0;
      height: 0;
      .night-order {
        opacity: 0;
      }
      .token {
        border-width: 0;
      }
    }
  }
}

#townsquare > .donation {
  position: absolute;
  top: calc(50px + 16vh);
  left: 10px;
  height: 2rem;
  width: 4rem;
  z-index: 50;
  text-decoration: none;

  // Outer border style
  border: 2px solid #b67d43; /* A dark, textured border for the outer frame */
  background-color: rgba(0, 0, 0, 1);
  padding: 10px 20px;
  color: inherit;
  cursor: pointer;

  span {
    position: absolute;
    top: 0.05rem;
    left: 0.7rem;
    white-space: nowrap;
    font-size: 1.2rem;
  }

  box-shadow: 0 0 5px #b67d43;
  animation: glow-cycle 605s linear; /* 10m duration */
  animation-delay: 1s;
}
// The keyframe animation for 10 minutes oscillation
@keyframes glow-cycle {
  0% {
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  0.0826% {
    // Peak of the 1st pulse
    box-shadow: 0 0 20px #dab060;
    border-color: #dab060;
  }

  0.165% {
    // End of the 1st pulse
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  0.247% {
    // Peak of the 2nd pulse
    box-shadow: 0 0 20px #dab060;
    border-color: #dab060;
  }

  0.33% {
    // End of the 2nd pulse
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  0.413% {
    // Peak of the 3rd pulse
    box-shadow: 0 0 20px #dab060;
    border-color: #dab060;
  }

  0.495% {
    // End of the 3rd pulse
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  0.578% {
    // Peak of the 4th pulse
    box-shadow: 0 0 20px #dab060;
    border-color: #dab060;
  }

  0.66% {
    // End of the 4th pulse
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  0.743% {
    // Peak of the 5th pulse
    box-shadow: 0 0 20px #dab060;
    border-color: #dab060;
  }

  0.826% {
    // End of the 5th pulse, which is 5 seconds in
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }

  100% {
    // The rest of the 10-minute duration is spent here
    box-shadow: 0 0 5px #b67d43;
    border-color: #b67d43;
  }
}

#townsquare.public > .bluffs {
  opacity: 0;
  transform: scale(0.1);
}

.fabled ul li .token:before {
  content: " ";
  opacity: 0;
  transition: opacity 250ms;
  background-image: url("../assets/icons/x.png");
  z-index: 2;
}

// New message bubble
.fabled ul li .newMessage {
  position: absolute;
  right: 2%;
  top: 1%;
  background: rgb(255, 51, 85);
  border-radius: 100%;
  width: 20px;
  height: 20px;
  text-align: center;
  font-size: 80%;
}

/**** Night reminders ****/
.night-order {
  position: absolute;
  width: 100%;
  cursor: pointer;
  opacity: 1;
  transition: opacity 200ms;
  display: flex;
  top: 0;
  align-items: center;
  pointer-events: none;

  &:after {
    content: " ";
    display: block;
    padding-top: 100%;
  }

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }

  &:hover ~ .token .ability {
    opacity: 0;
  }

  span {
    display: flex;
    position: absolute;
    padding: 5px 10px 5px 30px;
    width: 350px;
    z-index: 25;
    font-size: 70%;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    text-align: left;
    align-items: center;
    opacity: 0;
    transition: opacity 200ms ease-in-out;

    &:before {
      transform: rotate(-90deg);
      transform-origin: center top;
      left: -98px;
      top: 50%;
      font-size: 100%;
      position: absolute;
      font-weight: bold;
      text-align: center;
      width: 200px;
    }

    &:after {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      position: absolute;
    }
  }

  &.first span {
    right: 120%;
    background: linear-gradient(
      to right,
      $townsfolk 0%,
      rgba(0, 0, 0, 0.5) 20%
    );
    &:before {
      content: "首夜";
    }
    &:after {
      border-left-color: $townsfolk;
      margin-left: 3px;
      left: 100%;
    }
  }

  &.other span {
    left: 120%;
    background: linear-gradient(to right, $demon 0%, rgba(0, 0, 0, 0.5) 20%);
    &:before {
      content: "其他夜";
    }
    &:after {
      right: 100%;
      margin-right: 3px;
      border-right-color: $demon;
    }
  }

  em {
    font-style: normal;
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid black;
    filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.5));
    font-weight: bold;
    opacity: 1;
    pointer-events: all;
    transition: opacity 200ms;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3;
  }

  &.first em {
    left: -10%;
    background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, $townsfolk 100%);
  }

  &.other em {
    right: -10%;
    background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, $demon 100%);
  }

  em:hover + span {
    opacity: 1;
  }

  // adjustment for fabled
  .fabled &.first {
    span {
      right: auto;
      left: 40px;
      &:after {
        left: auto;
        right: 100%;
        margin-left: 0;
        margin-right: 3px;
        border-left-color: transparent;
        border-right-color: $townsfolk;
      }
    }
  }
}

/* chat with ST */
.chatMin {
  position: absolute;
  right: 10px;
  bottom: 0px;
  transform-origin: bottom right;
  width: 15%;
  height: 5%;
  border-radius: 10px;
  z-index: 60;
  display: flex;
  flex-direction: column;
}

.chatMin .title {
  padding: 10px;
  background-color: #000;
  user-select: none;
}

.chatMin .title .open {
  position: absolute;
  right: 20px;
  font-weight: bold;
  cursor: pointer;
}

.chatMin .content {
  display: none;
}

.chatMin .chatbox {
  display: none;
}
// New message bubble
.chatMin .newMessage {
  position: absolute;
  left: 40%;
  bottom: 10%;
  background: rgb(255, 51, 85);
  border-radius: 100%;
  width: 20px;
  height: 20px;
  text-align: center;
  font-size: 80%;
}

.chat {
  position: absolute;
  right: 10px;
  bottom: 10px;
  transform-origin: bottom right;
  background-color: #0000007f;
  // width: 30%;
  // height: 40%;
  border-radius: 10px;
  border: 3px solid #8a7864;
  z-index: 60;
  display: flex;
  flex-direction: column;
}
// New message bubble
.chat .newMessage {
  position: absolute;
  left: 50%;
  bottom: 10%;
  background: rgb(255, 51, 85);
  border-radius: 100%;
  width: 20px;
  height: 20px;
  text-align: center;
  font-size: 80%;
}

.chat .title {
  padding: 10px;
  background-color: #000;
  user-select: none;
}

.chat .title em {
  color: #888;
  cursor: pointer;
  font-size: 80%;
}

.chat .title .group {
  position: inherit;
  overflow-y: auto;
  overflow-x: hidden;
}

.chat .title .close {
  position: absolute;
  right: 20px;
  font-weight: bold;
  cursor: pointer;
}

.chat.alert .title {
  background-color: #a00;
}

.chat.alert .title::after {
  font-size: 70%;
  font-weight: bold;
  position: absolute;
  right: 40px;
  bottom: 10px;
}

.chat .content {
  padding: 5px;
  font-size: 80%;
  background-color: #131313;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column-reverse;
}

.chat .chatbox {
  padding: 5px;
  display: flex;
  height: fit-content;
  background-color: #131313;
}

.chat .chatbox .edit {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 60px;
  font-size: 70%;
  border: solid;
  background-color: #000;
  color: #fff;
}

.chat .chatbox .edit:focus {
  outline: none;
}

.chat .chatbox .send {
  background-color: #4a7ec6;
  color: white;
  border: solid;
  border-color: white;
  border-radius: 0 10px 10px 0;
  cursor: pointer;
}

.turnedIcon45 {
  transform: rotate(45deg);
}

.toBottom {
  margin: auto;
  width: 40px;
  height: 20px;
  bottom: 30px;
  z-index: 60;
  font-size: 70%;
  display: flex;
  flex-direction: column;
}

#townsquare:not(.spectator) .fabled ul li:hover .token:before {
  opacity: 1;
}

#version {
  position: fixed;
  bottom: 0;
  right: 0;
  background-color: transparent;
  color: white;
  padding: 0px;
}

#version a {
  color: white;
  text-decoration: none;
}

#copyright {
  position: fixed;
  bottom: 1px;
  left: 4px;
  background-color: transparent;
  color: white;
  padding: 0px;
  font-size: 0.6rem;
  opacity: 0.75;
}

#copyright a {
  color: white;
  text-decoration: underline;
}

#townsquare > .is-role {
  position: absolute;
  bottom: calc(50px + 16vh);
  left: 10px;
  z-index: 50;
  text-decoration: none;
  padding: 20px 16px 20px 24px;

  display: flex;
  justify-content: center;
  align-items: center;

  background: rgba(0, 0, 0, 0.5);
  border-radius: 10px;
  border: 3px solid black;
  opacity: 1;
  cursor: pointer;

  &:hover {
    background: rgba(0, 0, 0, 0.6);
    transition: background-color 0.3s;
  }

  svg {
    &.is-using-wraith {
      color: red;
    }
  }
}

#floating-notice {
  position: fixed;
  bottom: 0px;
  left: 50%;
  transform: translateX(-50%);
  width: 70%;
  max-width: 600px;
  overflow: hidden;
  z-index: 30;
  pointer-events: none;

  .floating-window {
    display: block;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
    position: relative;
  }

  .floating-text {
    display: inline-block;
    color: #ffff00;
    font-weight: bold;
    font-size: 1.1rem;

    /* 1800s = 30 minutes cycle */
    animation: roll-notice 1800s linear infinite;
  }
}

// Fixed Keyframes Timeline
@keyframes roll-notice {
  /* 0%: Start completely pushed outside the right boundary of the window */
  0% {
    transform: translate3d(100vw, 0, 0);
  }
  /* 0.55% (~10 seconds): Slide left completely past the view box until it safely clears */
  0.85% {
    transform: translate3d(-100%, 0, 0);
  }
  /* 99.99%: Hold its completely hidden off-screen position for the rest of the 30 minutes */
  99.99% {
    transform: translate3d(-100%, 0, 0);
  }
  /* 100%: Instantly snap back to the right origin without showing an animation frame rewind */
  100% {
    transform: translate3d(100vw, 0, 0);
  }
}
</style>
