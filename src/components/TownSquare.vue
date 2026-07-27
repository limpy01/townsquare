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
      ref="bluffsElement"
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
          @click="seatActions.openRoleModal(index * -1)"
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
          @click="seatActions.removeFabled(index)"
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
        @click="seatActions.setUsingWraith()"
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
import { computed, nextTick, ref, watch, type Ref } from "vue";
import { useInteractionStore } from "../stores/interaction";
import { useChatStore } from "../stores/chat";
import { useSessionConnectionStore } from "../stores/session-connection";
import { useVotingStore } from "../stores/voting";
import { useRoleActivityStore } from "../stores/role-activity";
import { getNightOrder } from "@townsquare/domain";
import { useViewport } from "../composables/use-viewport";
import { useTownSquareSeatActions } from "../composables/use-town-square-seat-actions";
import { useProfileStore } from "../stores/profile";
import { useAppMetaStore } from "../stores/app-meta";
import { usePlayersStore } from "../stores/players";
import { useGrimoireStore } from "../stores/grimoire";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { useModalStore } from "../stores/modals";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { emitGameEvent } from "../store/game-events";
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
const modals = useModalStore();
const outbox = useMessageOutboxStore();
const { width: windowWidth, height: windowHeight } = useViewport();
const countdownAudio = ref<HTMLAudioElement | null>(null);
const bluffsElement = ref<HTMLElement | null>(null);
const chatWith = ref<HTMLElement | null>(null);
const chatContent = ref<HTMLElement | null>(null);
const messageInput = ref<HTMLInputElement | null>(null);
let selectedPlayer: Ref<number>;
let swap: Ref<number>;
let move: Ref<number>;
let nominate: Ref<number>;
const isChatMin = ref(false);
const minimising = ref(false);
const chattingPlayer = ref("");
const chattingGroup = ref("");
const isShowGroup = ref(false);
const message = ref("");
const bluffSize = ref(3);
const isBluffsOpen = ref(true);
const isFabledOpen = ref(true);

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
  const group = groups[0];
  if (!group) return [];

  return group.players.flatMap((player) => {
    const index = playersState.players.findIndex(
      (candidate) => candidate.id === player.id,
    );
    return index === -1 ? [] : [{ id: player.id, name: player.name, index }];
  });
});
const isRole = computed(() => (roleActivity.wraith.active ? ["wraith"] : []));
const toggleBluffs = () => {
  isBluffsOpen.value = !isBluffsOpen.value;
};
const toggleFabled = () => {
  isFabledOpen.value = !isFabledOpen.value;
};
const toggleGroups = () => {
  isShowGroup.value = !isShowGroup.value;
};
const publish = (type: string, payload?: unknown) =>
  emitGameEvent(type, payload);
const enqueueChat = (payload: {
  message: string;
  sendingPlayerId: string;
  receivingPlayerId: string;
}) => {
  if (!session.isSpectator || payload.sendingPlayerId === session.playerId) {
    outbox.add({
      type: "direct",
      playerId: payload.receivingPlayerId,
      command: "chat",
      params: payload,
      id: Date.now(),
    });
  }
  publish("session/updateChatSent", payload);
};
const clearChatUnread = () => {
  if (session.isSpectator) {
    chat.clearStorytellerUnread();
  } else {
    playersState.setPlayerMessage({
      playerId: chattingPlayer.value,
      num: 0,
    });
    publish("players/setPlayerMessage", {
      playerId: chattingPlayer.value,
      num: 0,
    });
  }
};
const checkToBottom = () => {
  if (chatContent.value && chatContent.value.scrollTop >= -20)
    clearChatUnread();
};
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContent.value)
      chatContent.value.scrollTop = chatContent.value.scrollHeight;
  });
  checkToBottom();
};
const maximiseChat = () => {
  if (minimising.value) {
    minimising.value = false;
    return;
  }
  if (interaction.isChatOpen && !isChatMin.value) return;
  interaction.setChatOpen(true);
  isChatMin.value = false;
  nextTick(() => messageInput.value?.focus());
};
const minimiseChat = () => {
  isChatMin.value = true;
  minimising.value = true;
};
const toggleChat = () => {
  if (isChatMin.value) maximiseChat();
  else minimiseChat();
};
const openChat = (playerIndex: number, maximise = true) => {
  if (maximise) maximiseChat();
  if (session.isSpectator) {
    const name =
      chat.groups.length === 0 ? playersState.fabled[0]?.name ?? "" : "群聊";
    if (chatWith.value) chatWith.value.innerText = name;
    if (maximise) chat.clearStorytellerUnread();
  } else {
    const player = playersState.players[playerIndex];
    chattingPlayer.value = player.id;
    chattingGroup.value = player.chatGroup;
    const group = chat.groups.find((item) => item.id === chattingGroup.value);
    if (chatWith.value)
      chatWith.value.innerText =
        chattingGroup.value === "" ? player.name : group?.name ?? "";
    if (maximise) clearChatUnread();
  }
  nextTick(scrollToBottom);
};
const seatActions = useTownSquareSeatActions({
  players: playersState,
  session,
  voting,
  chat,
  modals,
  roleActivity,
  openChat: (playerIndex) => openChat(playerIndex),
});
({ selectedPlayer, swap, move, nominate } = seatActions);
const sendChat = () => {
  if (message.value === "") return;
  if (session.isSpectator && session.claimedSeat < 0) return;
  if (
    !session.isSpectator &&
    !playersState.players.some((player) => player.id === chattingPlayer.value)
  )
    return;

  const sentMessage = profile.playerName.concat(": ", message.value);
  const sendingPlayerId = session.playerId;
  const recipients =
    chattingGroup.value === ""
      ? [session.isSpectator ? "host" : chattingPlayer.value]
      : (
          chat.groups.find((group) => group.id === chattingGroup.value)
            ?.players ?? []
        ).map((player) => player.id);
  for (const receivingPlayerId of recipients)
    enqueueChat({
      message: sentMessage,
      sendingPlayerId,
      receivingPlayerId,
    });

  if (!session.isSpectator) {
    const wraithMessage = `[亡魂][（说书人）${sentMessage}]`;
    for (const player of playersState.players)
      if (
        player.isWraith &&
        player.isUsingWraith &&
        player.isAllowRole &&
        player.id &&
        player.id !== chattingPlayer.value &&
        player.chatGroup !== chattingGroup.value
      )
        enqueueChat({
          message: wraithMessage,
          sendingPlayerId,
          receivingPlayerId: player.id,
        });
  }

  message.value = "";
  nextTick(scrollToBottom);
};
const typing = () => {
  interaction.setTyping(true);
  checkToBottom();
};
const notTyping = () => interaction.setTyping(false);

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
      return seatActions.openReminderModal(playerIndex);
    case "openRoleModal":
      return seatActions.openRoleModal(playerIndex);
    case "removePlayer":
      return seatActions.removePlayer(playerIndex);
    case "swapPlayer":
      return seatActions.swapPlayer(playerIndex, target);
    case "movePlayer":
      return seatActions.movePlayer(playerIndex, target);
    case "nominatePlayer":
      return seatActions.nominatePlayer(playerIndex, target);
    case "cancel":
      return seatActions.cancel();
    case "claimSeat":
      return seatActions.claimSeat(playerIndex);
    case "setStoryTeller":
      return seatActions.setStoryTeller(playerIndex);
    case "openChat":
      return openChat(playerIndex);
    case "addVote":
      return seatActions.addVote(playerIndex);
    case "subtractVote":
      return seatActions.subtractVote(playerIndex);
  }
};

watch(
  () => chat.histories,
  () => {
    nextTick(() => {
      const content = chatContent.value;
      if (
        content &&
        content.scrollTop >= -20 &&
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
      const audioElement = countdownAudio.value;
      if (!audioElement) return;
      if (voting.isVoteInProgress && !voting.lockedVote) {
        if (!grimoire.isMuted) {
          audioElement.currentTime = 0;
          audioElement.play();
        }
      } else {
        audioElement.pause();
        audioElement.currentTime = 0;
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
@use "../styles/town-square-layout";
@use "../styles/night-order";
@use "../styles/town-square-overlays";
</style>
