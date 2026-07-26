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
@use "../vars.scss" as *;

.fold-enter-active,
.fold-leave-active {
  transition: transform 250ms ease-in-out;
  transform-origin: left center;
  transform: perspective(200px);
}
.fold-enter,
.fold-leave-to {
  transform: perspective(200px) rotateY(90deg);
}

/***** Player token *****/
.circle .player {
  margin-bottom: 10px;

  &:before {
    content: " ";
    display: block;
    padding-top: 100%;
  }

  .shroud {
    top: 0;
    left: 0;
    position: absolute;
    width: 100%;
    height: 45%;
    cursor: pointer;
    transform: rotateX(0deg);
    transform-origin: top center;
    transition: transform 200ms ease-in-out;
    z-index: 2;
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 0.8));

    &:before {
      content: " ";
      background: url("../assets/shroud.png") center -10px no-repeat;
      background-size: auto 110%;
      position: absolute;
      margin-left: -50%;
      width: 100%;
      height: 100%;
      left: 50%;
      top: -30%;
      opacity: 0;
      transform: perspective(400px) scale(1.5);
      transform-origin: top center;
      transition: all 200ms;
      pointer-events: none;
    }

    #townsquare.spectator & {
      pointer-events: none;
    }

    #townsquare:not(.spectator) &:hover:before {
      opacity: 0.5;
      top: -10px;
      transform: scale(1);
    }
  }

  &.dead .shroud:before {
    opacity: 1;
    top: 0;
    transform: perspective(400px) scale(1);
  }

  #townsquare:not(.spectator) &.dead .shroud:hover:before {
    opacity: 1;
  }
}

/****** Life token *******/
.player {
  z-index: 1;

  .life {
    border-radius: 50%;
    width: 100%;
    background: url("../assets/life.png") center center;
    background-size: 100%;
    border: 3px solid black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    transition: transform 200ms ease-in-out;
    transform: perspective(400px) rotateY(180deg);
    backface-visibility: hidden;
    position: absolute;
    left: 0;
    top: 0;

    &:before {
      content: " ";
      display: block;
      padding-top: 100%;
    }
  }

  &.dead {
    &.no-vote .life:after {
      display: none;
    }

    .life {
      background-image: url("../assets/death.png");

      &:after {
        content: " ";
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: url("../assets/vote.png") center center no-repeat;
        background-size: 50%;
        height: 100%;
        pointer-events: none;
      }
    }
  }

  &.traveler .life {
    filter: grayscale(100%);
  }
}

#townsquare.public .player {
  .shroud {
    transform: perspective(400px) rotateX(90deg);
    pointer-events: none;
  }

  .life {
    transform: perspective(400px) rotateY(0deg);
  }

  &.traveler:not(.dead) .token {
    transform: perspective(400px) scale(0.8);
    pointer-events: none;
    transition-delay: 0s;
  }

  &.traveler.dead .token {
    transition-delay: 0s;
  }
}

/***** Role token ******/
.player .token {
  // z-index: 4;
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  transition: transform 200ms ease-in-out;
  transform: perspective(400px) rotateY(0deg);
  backface-visibility: hidden;
}
.player .avatar,
.player .token {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
}

.player .avatar {
  border-radius: 50%;
  padding: 6%;
  cursor: pointer;
}

.player .avatar img {
  border-radius: 50%;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.player .avatar img.on {
  filter: blur(3px);
}

#townsquare.public .circle .token {
  transform: perspective(400px) rotateY(-180deg);
}

/****** Player choice icons *******/
.player .overlay {
  width: 100%;
  position: absolute;
  pointer-events: none;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  &:after {
    content: " ";
    display: block;
    padding-top: 100%;
  }
}
.player .overlay .sitDown {
  position: relative;
  text-align: left;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 5px;
  border-radius: 10px;
  border: 2px solid #000;
  // margin-left: 15px;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  width: 60%;
  height: 60%;
  transform: scale(1.3);
  font-size: 90%;
}
.player .overlay svg {
  position: absolute;
  filter: drop-shadow(0 0 3px black);
  z-index: 2;
  cursor: pointer;
  &.swap,
  &.move,
  &.nominate,
  &.vote,
  &.cancel {
    width: 50%;
    height: 60%;
    opacity: 0;
    pointer-events: none;
    transition: all 250ms;
    transform: scale(0.2);
    * {
      stroke-width: 10px;
      stroke: white;
      fill: url(#default);
    }
    &:hover *,
    &.fa-hand-paper * {
      fill: url(#demon);
    }
    &.fa-times * {
      fill: url(#townsfolk);
    }
  }
}

// other player voted yes, but is not locked yet
#townsquare.vote .player.vote-yes .overlay svg.vote.fa-hand-paper {
  opacity: 0.5;
  transform: scale(1);
}

// you voted yes | a locked vote yes | a locked vote no
#townsquare.vote .player.talking.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote .player.vote-lock.vote-yes .overlay svg.vote.fa-hand-paper,
#townsquare.vote .player.vote-lock:not(.vote-yes) .overlay svg.vote.fa-times {
  opacity: 1;
  transform: scale(1);
}

// a locked vote can be clicked on by the ST
#townsquare.vote:not(.spectator) .player.vote-lock .overlay svg.vote {
  pointer-events: all;
}

.vote-enter-active,
.vote-leave-active,
.vote-appear-active,
.vote-move {
  transition: all 250ms ease-in-out;
}

/* Defines the initial state for entering and appearing elements. */
.vote-enter,
.vote-appear {
  opacity: 0;
  transform: scale(0.2);
}

/* Defines the final state for entering and appearing elements. */
.vote-enter-to,
.vote-appear-to {
  opacity: 1;
  transform: scale(1);
}

/* Defines the final state for leaving elements. */
.vote-leave-to {
  opacity: 0;
  transform: scale(0.2);
}

li.from:not(.nominate) .player .overlay svg.cancel {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

li.swap:not(.from) .player .overlay svg.swap,
li.nominate .player .overlay svg.nominate,
li.move:not(.from) .player .overlay svg.move {
  opacity: 1;
  transform: scale(1);
  pointer-events: all;
}

/****** Vote icon ********/
.player .has-vote {
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.has-vote {
  position: absolute;
  margin-top: -15%;
  right: 2px;
}

.player .secret-no-vote {
  color: red;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.secret-no-vote {
  position: absolute;
  margin-top: -15%;
  right: 2px;
}

.player .multiple-votes {
  color: #fff;
  cursor: default;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.multiple-votes {
  position: absolute;
  margin-top: -17%;
  right: -0.6vw;
}

.multiple-votes span {
  font-size: 80%;
}

/****** Role specific icon ********/
.player .designated-role {
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  transition: opacity 250ms;
  z-index: 2;

  &.is-using-wraith {
    color: red;
  }

  #townsquare.public & {
    opacity: 0;
    pointer-events: none;
  }
}

.designated-role {
  position: absolute;
  top: 0px;
  right: 2px;
}

#slash {
  z-index: 3;
  pointer-events: none;
}

/****** Session seat glow when talking *****/
@mixin glow($name, $color) {
  @keyframes #{$name}-glow {
    0%,
    100% {
      box-shadow: 0 0 rgba($color, 1);
      border-color: $color;
    }
  }

  .player.talking.#{$name} .token {
    animation: #{$name}-glow 0.5s infinite;
  }
}

@include glow("townsfolk", $townsfolk);
@include glow("outsider", $outsider);
@include glow("demon", $demon);
@include glow("minion", $minion);
@include glow("traveler", $traveler);

.player.talking .token {
  animation: townsfolk-glow 0.5s infinite;
}

/****** Marked icon ******/
.player .marked {
  position: absolute;
  width: 100%;
  top: 0;
  filter: drop-shadow(0px 0px 6px black);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 250ms;
  opacity: 0;
  &:before {
    content: " ";
    padding-top: 100%;
    display: block;
  }
  svg {
    height: 60%;
    width: 60%;
    position: absolute;
    stroke: white;
    stroke-width: 15px;
    path {
      fill: white;
    }
  }
}
.player.marked .marked {
  opacity: 0.5;
}

/****** Seat icon ********/
.player .seat {
  position: absolute;
  left: 2px;
  margin-top: -15%;
  color: #fff;
  filter: drop-shadow(0 0 3px black);
  cursor: default;
  z-index: 2;
  &.highlight {
    animation-iteration-count: 1;
    animation: redToWhite 1s normal forwards;
  }
}

// Player Seat Number
.player .seatNum {
  position: absolute;
  top: -5%;
  left: 8%;
  font-size: 120%;
  z-index: 3;
  font-weight: bold;
  // -webkit-text-stroke-color: #000;
  // -webkit-text-stroke-width: 1px;
  text-shadow:
    -1px 1px #000,
    1px 1px #000,
    -1px 1px #000,
    -1px -1px #000;
}

// New message bubble
.player .newMessage {
  position: absolute;
  right: 2%;
  top: 1%;
  z-index: 3;
  pointer-events: none;
  background: rgb(255, 51, 85);
  border-radius: 100%;
  width: 20px;
  height: 20px;
  text-align: center;
  font-size: 80%;
}

// highlight animation
@keyframes redToWhite {
  from {
    color: $demon;
  }
  to {
    color: white;
  }
}

.player.talking .seat {
  color: $townsfolk;
}

/***** Player name *****/
.player > .name {
  right: 10%;
  display: flex;
  justify-content: center;
  font-size: 80%;
  line-height: 170%;
  cursor: pointer;
  white-space: nowrap;
  width: 120%;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  top: 5px;
  box-shadow: 0 0 5px black;
  padding: 0 4px;

  svg {
    top: 3px;
    margin-right: 2px;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    flex-grow: 1;
  }

  #townsquare:not(.spectator) &:hover,
  &.active {
    color: red;
  }

  &:hover .pronouns {
    opacity: 1;
    color: white;
  }

  .pronouns {
    display: flex;
    position: absolute;
    right: 110%;
    max-width: 250px;
    z-index: 25;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 10px;
    border: 3px solid black;
    filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
    align-items: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms ease-in-out;
    padding: 0 4px;
    bottom: -3px;

    &:before {
      content: " ";
      border: 10px solid transparent;
      width: 0;
      height: 0;
      border-left-color: black;
      position: absolute;
      margin-left: 2px;
      left: 100%;
    }
  }
}

.player.dead > .name {
  opacity: 0.5;
}

/***** Player menu *****/
.player > .menu {
  position: absolute;
  left: 110%;
  bottom: -5px;
  text-align: left;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.5);
  padding: 2px 5px;
  border-radius: 10px;
  border: 3px solid #000;
  margin-left: 15px;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);

  &:before {
    content: " ";
    width: 0;
    height: 0;
    position: absolute;
    border: 10px solid transparent;
    border-right-color: black;
    right: 100%;
    bottom: var(--before);
    margin-right: 2px;
  }

  li:hover {
    color: red;
  }

  li.disabled {
    cursor: not-allowed;
    opacity: 0.5;
    &:hover {
      color: white;
    }
  }

  svg {
    margin-right: 2px;
  }
}

/***** Ability text *****/
#townsquare.public .circle .ability {
  display: none;
}
.circle .player .shroud:hover ~ .token .ability,
.circle .player .token:hover .ability {
  opacity: 1;
}

/**** Night reminders ****/
.player .night-order {
  z-index: 3;
}

.player.dead .night-order em {
  color: #ddd;
  background: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, gray 100%);
}

/***** Reminder token *****/
.circle .reminder {
  background: url("../assets/reminder.png") center center;
  background-size: 100%;
  width: 50%;
  height: 0;
  padding-bottom: 50%;
  box-sizing: content-box;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 5px 0 0 -25%;
  border-radius: 50%;
  border: 3px solid black;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  transition: all 200ms;
  cursor: pointer;

  .text {
    line-height: 90%;
    color: black;
    font-size: 50%;
    font-weight: bold;
    text-align: center;
    margin-top: 50%;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 15%;
    text-shadow:
      0 1px 1px #f6dfbd,
      0 -1px 1px #f6dfbd,
      1px 0 1px #f6dfbd,
      -1px 0 1px #f6dfbd;
  }

  .icon,
  &:after {
    content: " ";
    position: absolute;
    top: 0;
    width: 90%;
    height: 90%;
    background-size: 100%;
    background-position: center 0;
    background-repeat: no-repeat;
    background-image: url("../assets/icons/plus.png");
    transition: opacity 200ms;
  }

  &:after {
    background-image: url("../assets/icons/x.png");
    opacity: 0;
    top: 5%;
  }

  &.add {
    opacity: 0;
    top: 30px;
    &:after {
      display: none;
    }
    .icon {
      top: 5%;
    }
  }

  &.custom {
    .icon {
      display: none;
    }
    .text {
      font-size: 70%;
      word-break: break-word;
      margin-top: 0;
      display: flex;
      align-items: center;
      align-content: center;
      justify-content: center;
      border-radius: 50%;
      top: 0;
    }
  }

  &:hover:before {
    opacity: 0;
  }
  &:hover:after {
    opacity: 1;
  }
}

.circle .reminderHoverTarget {
  opacity: 0;
  width: calc(50% + 8px);
  padding-top: calc(50% + 38px);
  margin-top: calc(-25% - 33px);
  margin-left: calc(-25% - 1px);
  border-radius: 0 0 999px 999px;
  pointer-events: auto;
  transform: none !important;
  z-index: -1;
}

.circle li:hover .reminder.add {
  opacity: 1;
  top: 0;
}
.circle li:hover .reminder.add:before {
  opacity: 1;
}

#townsquare.public .reminder {
  opacity: 0;
  pointer-events: none;
}
</style>
