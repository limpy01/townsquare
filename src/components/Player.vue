<template>
  <li :style="zoom">
    <div
      ref="player"
      class="player"
      :class="[
        {
          dead: player.isDead,
          marked: voting.markedPlayer === index,
          'no-vote': player.isVoteless,
          'vote-yes': voting.votes[index],
          'vote-lock': voteLocked,
          talking: player.isTalking && player.id,
        },
        player.role.team,
      ]"
    >
      <div class="seatNum">{{ players.indexOf(player) + 1 }}</div>
      <div class="newMessage" v-show="player.newMessages > 0">
        {{ player.newMessages }}
      </div>

      <div class="shroud" @click="toggleStatus()"></div>
      <div class="life" @click="toggleStatus()"></div>
      <div v-if="player.id" class="avatar">
        <!-- <img :src="`https://botcgrimoire.uk/avatars/${player.image}`" 
          :class="{ on: player.role.id }"
        > -->
        <img
          :src="`${apiBase}/avatars/${player.image}`"
          :class="{ on: player.role.id }"
        />
        <!-- <img :src="`http://localhost:3000/avatars/${player.image}`" 
            :class="{ on: player.role.id }"
        > -->
      </div>

      <div
        class="night-order first"
        v-if="nightOrder.get(player).first && grimoire.isNightOrder"
      >
        <em>{{ nightOrder.get(player).first }}.</em>
        <span v-if="player.role.firstNightReminder">{{
          player.role.firstNightReminder
        }}</span>
      </div>
      <div
        class="night-order other"
        v-if="nightOrder.get(player).other && grimoire.isNightOrder"
      >
        <em>{{ nightOrder.get(player).other }}.</em>
        <span v-if="player.role.otherNightReminder">{{
          player.role.otherNightReminder
        }}</span>
      </div>

      <Token
        :role="player.role"
        :id="player.id"
        :image="player.image"
        @set-role="clickSetRole"
      />

      <!-- Overlay icons -->
      <div class="overlay">
        <transition-group
          name="vote"
          tag="div"
          class="overlay"
          appear
          v-show="playerVoteCount > 1"
        >
          <font-awesome-icon
            v-for="(n, id) in playerVoteCount"
            :key="n"
            :style="{
              transform: getVoteTransform(Number(id), playerVoteCount),
            }"
            icon="hand-paper"
            class="vote"
            title="Hand UP"
            @click="vote()"
          />
        </transition-group>
        <font-awesome-icon
          v-show="playerVoteCount <= 1"
          icon="hand-paper"
          class="vote"
          title="Hand UP"
          @click="vote()"
        />
        <font-awesome-icon
          icon="times"
          class="vote"
          title="Hand DOWN"
          @click="vote()"
        />
        <font-awesome-icon
          icon="times-circle"
          class="cancel"
          title="Cancel"
          @click="cancel()"
        />
        <font-awesome-icon
          icon="exchange-alt"
          class="swap"
          @click="swapPlayer(player)"
          title="Swap seats with this player"
        />
        <font-awesome-icon
          icon="redo-alt"
          class="move"
          @click="movePlayer(player)"
          title="Move player to this seat"
        />
        <font-awesome-icon
          icon="hand-point-right"
          class="nominate"
          @click="nominatePlayer(player)"
          title="Nominate this player"
        />
        <div
          v-if="!player.id && session.isSpectator && !review.isReview"
          class="sitDown"
          :style="font"
        >
          <font-awesome-icon
            icon="chair"
            style="position: relative; top: 50%"
          />
          坐下
        </div>
        <div
          v-if="!player.id && !session.isSpectator && isShowVacant"
          class="sitDown"
          :style="font"
        >
          <font-awesome-icon
            icon="chair"
            style="position: relative; top: 50%"
          />
          空位
        </div>
      </div>

      <!-- Role specific icons -->
      <template v-if="player.id">
        <font-awesome-icon
          v-if="!player.isAllowRole"
          id="slash"
          icon="slash"
          class="designated-role"
        />
        <font-awesome-icon
          v-if="player.isWraith"
          :icon="['custom', 'wraith']"
          class="designated-role"
          :class="{ 'is-using-wraith': player.isUsingWraith }"
          @click="toggleAllowRole()"
        />
      </template>

      <!-- Claimed seat icon -->
      <font-awesome-icon
        icon="chair"
        v-if="player.id && session.sessionId"
        class="seat"
        :class="{ highlight: distribution.roles || distribution.types }"
      />

      <!-- Ghost vote icon -->
      <font-awesome-icon
        icon="vote-yea"
        :class="
          session.sessionId && player.isSecretVoteless && !session.isSpectator
            ? 'secret-no-vote'
            : 'has-vote'
        "
        v-if="player.isDead && !player.isVoteless"
        @click="toggleVote()"
        title="Ghost vote"
      />

      <!-- Multiple votes -->
      <div>
        <font-awesome-icon
          v-if="!player.isDead && player.votes > 1 && !player.isVoteless"
          icon="hand-paper"
          class="has-vote"
        />

        <span
          v-if="player.votes > 1 && !player.isVoteless"
          class="multiple-votes"
          @click="toggleVote()"
          >&nbsp;{{ player.votes }}
        </span>
      </div>

      <!-- On block icon -->
      <div class="marked">
        <font-awesome-icon icon="skull" />
      </div>
      <div class="name" @click="checkOverTop()" :class="{ active: isMenuOpen }">
        <span v-if="player.id">{{ player.name }}</span>
        <span v-else>空座位</span>
        <font-awesome-icon icon="venus-mars" v-if="player.pronouns" />
        <div class="pronouns" v-if="player.pronouns">
          <span>{{ player.pronouns }}</span>
        </div>
      </div>

      <transition name="fold">
        <ul
          class="menu"
          ref="playerMenu"
          v-if="isMenuOpen"
          :style="[
            playerMenuAdjustment,
            {
              '--before':
                ((menuTop ?? 0) < 0
                  ? Math.round((menuNewTop ?? 0) - (menuTop ?? 0)) + 5
                  : 5) + 'px',
            },
          ]"
        >
          <li
            @click="changePronouns"
            v-if="
              !session.isSpectator ||
              (session.isSpectator && player.id === session.playerId)
            "
          >
            <font-awesome-icon icon="venus-mars" />改人称代词
          </li>
          <template v-if="!session.isSpectator">
            <li @click="changeName">
              <font-awesome-icon icon="user-edit" />改名
            </li>
            <li @click="movePlayer()" :class="{ disabled: voting.lockedVote }">
              <font-awesome-icon icon="redo-alt" />
              移动玩家
            </li>
            <li @click="swapPlayer()" :class="{ disabled: voting.lockedVote }">
              <font-awesome-icon icon="exchange-alt" />
              交换座位
            </li>
            <li @click="removePlayer" :class="{ disabled: voting.lockedVote }">
              <font-awesome-icon icon="times-circle" />
              移除座位
            </li>
            <li
              @click="emptyPlayer()"
              v-if="player.id && player.id != 'host' && session.sessionId"
            >
              <font-awesome-icon icon="chair" />
              踢出游戏
            </li>
            <template v-if="!voting.nomination">
              <li @click="nominatePlayer()">
                <font-awesome-icon icon="hand-point-right" />
                提名
              </li>
            </template>
            <li @click="addVote(player)">
              <font-awesome-icon icon="plus" prefix="fa" />
              增加票数
            </li>
            <li v-if="player.votes > 1" @click="subtractVote(player)">
              <font-awesome-icon icon="minus" prefix="fa" />
              减少票数
            </li>
            <li
              v-if="!player.id || player.id === 'host'"
              @click="setStoryTeller(player)"
            >
              <font-awesome-icon icon="book-open" prefix="fa" />
              <span v-if="!player.id">设为</span>
              <span v-else>移除</span>说书人
            </li>
            <li v-if="!!player.id" @click="toggleWraith()">
              <font-awesome-icon :icon="['custom', 'wraith']" />
              <span>亡魂</span>
            </li>
            <li @click="openChat(player)">
              <font-awesome-icon icon="comment" prefix="fa" />
              私聊
            </li>
          </template>
          <li
            @click="claimSeat"
            v-if="session.isSpectator"
            :class="{ disabled: player.id && player.id !== session.playerId }"
          >
            <font-awesome-icon icon="chair" />
            <template v-if="!player.id"> 坐下 </template>
            <template v-else-if="player.id === session.playerId">
              起立
            </template>
            <template v-else> 有人</template>
          </li>
        </ul>
      </transition>
    </div>

    <template v-if="reminders">
      <div
        class="reminder"
        :key="reminder.role + ' ' + reminder.name"
        v-for="reminder in reminders"
        :class="[reminder.role]"
        @click="removeReminder(reminder)"
      >
        <span
          class="icon"
          :style="{
            backgroundImage: `url(${
              reminder.image && grimoire.isImageOptIn
                ? reminder.image
                : iconImage(
                    reminder.imageAlt || reminder.role.replace(/old1$/, ''),
                  )
            })`,
          }"
        ></span>
        <span class="text">{{ reminder.name }}</span>
      </div>
    </template>
    <div
      v-if="!session.isSpectator || !review.isReview"
      class="reminder add"
      @click="emit('trigger', ['openReminderModal'])"
    >
      <span class="icon"></span>
    </div>
    <div class="reminderHoverTarget"></div>
  </li>
</template>

<script setup lang="ts">
import Token from "./Token.vue";
import { iconImage } from "../assets/images";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { apiBase } from "../config";
import { showInputModal } from "../services/input-modal";
import { useDistributionStore } from "../stores/distribution";
import { useReviewStore } from "../stores/review";
import { useVotingStore } from "../stores/voting";
import { usePlayersStore } from "../stores/players";
import { useGrimoireStore } from "../stores/grimoire";
import { useSessionIdentityStore } from "../stores/session-identity";
import { getNightOrder } from "@townsquare/domain";
import { createPlayerStateActions } from "../composables/player-state-actions";
import { emitGameEvent } from "../store/game-events";

type PlayerRole = Record<string, unknown> & {
  id?: string;
  team?: string;
  firstNightReminder?: string;
  otherNightReminder?: string;
};

type PlayerReminder = Record<string, unknown> & {
  role: string;
  name?: string;
  image?: string;
  imageAlt?: string;
};

type PlayerView = Record<string, unknown> & {
  id: string;
  name: string;
  image: string;
  role: PlayerRole;
  reminders: PlayerReminder[];
  stReminders: PlayerReminder[];
  isDead: boolean;
  isVoteless: boolean;
  isSecretVoteless: boolean;
  isAllowRole: boolean;
  isWraith: boolean;
  isUsingWraith: boolean;
  isTalking: boolean;
  votes: number;
  newMessages: number;
  pronouns: string;
  chatGroup: string;
};

const props = defineProps<{ player: PlayerView }>();
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
const emit = defineEmits<{ trigger: [payload: PlayerTrigger] }>();
const playersState = usePlayersStore();
const grimoire = useGrimoireStore();
const session = useSessionIdentityStore();
const distribution = useDistributionStore();
const review = useReviewStore();
const voting = useVotingStore();
const playerMenu = ref<HTMLElement | null>(null);
const isMenuOpen = ref(false);
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);
const menuTop = ref<number | null>(null);
const menuHeight = ref<number | null>(null);
const menuNewTop = ref<number | null>(null);
const isShowVacant = ref(false);
const playerStateActions = createPlayerStateActions({
  player: props.player,
  players: playersState,
  grimoire,
  session,
  voting,
  closeMenu: () => {
    isMenuOpen.value = false;
  },
});

const players = computed(() => playersState.players);
const nightOrder = computed(() =>
  getNightOrder(
    players.value,
    playersState.fabled,
    playersState.firstNightOrder,
    playersState.otherNightOrder,
  ),
);
const index = computed(() => players.value.indexOf(props.player));
const playerVoteCount = computed(() => Number(voting.votes[index.value]) || 1);
const voteLocked = computed(() => {
  if (!voting.nomination) return false;
  const indexAdjusted =
    (index.value - 1 + players.value.length - voting.nomination[1]) %
    players.value.length;
  return indexAdjusted < voting.lockedVote - 1;
});
const zoom = computed(() => {
  const unit = windowWidth.value > windowHeight.value ? "vh" : "vw";
  const size =
    players.value.length < 7
      ? 18
      : players.value.length <= 10
      ? 16
      : players.value.length <= 15
      ? 14
      : 12;
  return { width: size + grimoire.zoom + unit };
});
const font = computed(
  () =>
    "font-size: " +
    ((grimoire.zoom + 20) * Math.min(windowWidth.value, windowHeight.value)) /
      1080 +
    "px",
);
const playerMenuAdjustment = computed(() => {
  if (!menuTop.value) return null;
  return { top: "0px", height: menuHeight.value + "px" };
});
const reminders = computed(() =>
  !session.isSpectator || !review.isReview
    ? props.player.reminders
    : props.player.stReminders,
);

function handleResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}

function getVoteTransform(index: number, totalVotes: number, scaleValue = 1) {
  const offsetX = 20;
  const totalShiftX = ((totalVotes - 1) * offsetX) / 2;
  return `translate(${
    index * offsetX - totalShiftX
  }px, 0px) scale(${scaleValue})`;
}
function clickSetRole() {
  if (session.isSpectator && !props.player.id) {
    claimSeat();
    return;
  }
  if (!session.isSpectator || !review.isReview)
    emit("trigger", ["openRoleModal"]);
}
async function changePronouns() {
  if (session.isSpectator && props.player.id !== session.playerId) return;

  const input = await showInputModal({
    inputType: "pronouns",
    inputModal: "input",
    inputData: {
      name: ["请输入人称代词"],
      length: 1,
      placeholder: [""],
    },
  }).catch(() => {
    return null;
  });
  if (input === null) return;

  if (!Array.isArray(input)) return;
  const pronouns = input[0];
  //Only update pronouns if not null (prompt was not cancelled)
  if (pronouns !== null) {
    updatePlayer("pronouns", pronouns, true);
  }
}
function toggleStatus() {
  playerStateActions.toggleStatus();
}

function toggleVote() {
  playerStateActions.toggleVote();
}

function toggleAllowRole() {
  playerStateActions.toggleAllowRole();
}

async function toggleWraith() {
  if (session.isSpectator) return;
  if (props.player.isWraith) {
    playerStateActions.setWraithEnabled(false);
    return;
  }
  const confirm = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: {
      name: ["确定允许该玩家使用亡魂能力吗？"],
      length: 1,
      placeholder: [""],
    },
  }).catch(() => null);
  if (confirm === true) playerStateActions.setWraithEnabled(true);
  await nextTick();
}

async function changeName() {
  if (session.isSpectator) return;
  const input = await showInputModal({
    inputType: "changeNameSt",
    inputModal: "input",
    inputData: { name: ["请输入玩家昵称"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (Array.isArray(input)) updatePlayer("name", input[0], true);
}

function removeReminder(reminder: PlayerReminder) {
  if (review.isReview && session.isSpectator) return;
  playerStateActions.removeReminder(reminder);
}

async function checkOverTop(toggle = true) {
  if (toggle) isMenuOpen.value = !isMenuOpen.value;
  if (!isMenuOpen.value || !playerMenu.value) return;
  await nextTick();
  const position = playerMenu.value.getBoundingClientRect();
  menuTop.value = position.top < 0 ? Math.floor(position.top) : 0;
  menuHeight.value = Math.ceil(Math.abs(position.height));
  await nextTick();
  menuNewTop.value = playerMenu.value.getBoundingClientRect().top;
}

function resize() {
  if (!isMenuOpen.value) return;
  menuTop.value = null;
  menuHeight.value = null;
  menuNewTop.value = null;
  checkOverTop(false);
}

function updatePlayer(property: string, value: unknown, closeMenu = false) {
  playerStateActions.update(property, value, closeMenu);
}

function emptyPlayer() {
  const payload = { player: props.player, id: props.player.id };
  playersState
    .empty(props.player)
    .forEach((change) => emitGameEvent("players/update", change));
  emitGameEvent("players/empty", payload);
}

async function removePlayer() {
  isMenuOpen.value = false;
  const confirm = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: ["确定要移除该座位吗？"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (confirm === true) {
    if (props.player.id) emptyPlayer();
    emit("trigger", ["removePlayer"]);
  }
}

function emitPlayerAction(
  action: "swapPlayer" | "movePlayer" | "nominatePlayer",
  player?: unknown,
) {
  isMenuOpen.value = false;
  if (player === undefined) emit("trigger", [action]);
  else emit("trigger", [action, player]);
}
const swapPlayer = (player?: PlayerView) =>
  emitPlayerAction("swapPlayer", player);
const movePlayer = (player?: PlayerView) =>
  emitPlayerAction("movePlayer", player);
const nominatePlayer = (player?: PlayerView) =>
  emitPlayerAction("nominatePlayer", player);
const cancel = () => emit("trigger", ["cancel"]);
const claimSeat = () => {
  isMenuOpen.value = false;
  emit("trigger", ["claimSeat"]);
};
const setStoryTeller = (_player: PlayerView) => {
  isMenuOpen.value = false;
  emit("trigger", ["setStoryTeller"]);
};
function openChat(player: PlayerView) {
  if (!player.id) return;
  isMenuOpen.value = false;
  emit("trigger", ["openChat"]);
}
function vote() {
  if (!session.isSpectator && voteLocked.value) {
    const payload: [number, number] = [
      index.value,
      Number(voting.votes[index.value]) > 0 ? 0 : 1,
    ];
    voting.vote(payload);
    emitGameEvent("session/voteSync", payload);
  }
}
function addVote(player: PlayerView) {
  if (!session.isSpectator) {
    emit("trigger", ["addVote", player]);
    resize();
  }
}
function subtractVote(player: PlayerView) {
  if (!session.isSpectator) {
    emit("trigger", ["subtractVote", player]);
    resize();
  }
}

watch(
  isMenuOpen,
  (open) => {
    if (!open) {
      menuTop.value = null;
      menuHeight.value = null;
    }
  },
  { immediate: true },
);
watch(
  () => props.player.id,
  () => nextTick(resize),
);
onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
</script>

<style lang="scss">
@use "../styles/player-seat";
@use "../styles/player-status";
@use "../styles/player-reminders";
</style>
