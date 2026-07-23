<template>
  <div id="vote">
    <div class="arrows">
      <span class="nominee" :style="nomineeStyle"></span>
      <span class="nominator" :style="nominatorStyle"></span>
    </div>
    <div class="overlay">
      <em class="blue">{{ nomination[0] + 1 + ". " + nominator.name }}</em>
      提名了 <em>{{ nomination[1] + 1 + ". " + nominee.name }}</em
      >！
      <br />
      <em class="blue">
        {{
          voting.votes
            .filter(
              (item) => typeof item === "number" || typeof item === "boolean",
            )
            .reduce((item, sum) => Number(item) + Number(sum), 0)
        }}
        票
      </em>

      <em v-if="nominee.role.team !== 'traveler'">
        （满{{ Math.ceil(alive / 2) }}票通过）
      </em>
      <em v-else>（满{{ Math.ceil(players.length / 2) }}票通过）</em>

      <template v-if="!session.isSpectator">
        <div v-if="!voting.isVoteInProgress && voting.lockedVote < 1">
          每位玩家投票时间：
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(-500)"
            icon="minus-circle"
          />
          {{ voting.votingSpeed / 1000 }}s
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(500)"
            icon="plus-circle"
          />
        </div>
        <div class="button-group">
          <div
            class="button townsfolk"
            v-if="!voting.isVoteInProgress"
            @click="countdown"
          >
            倒计时
          </div>
          <div
            class="button"
            v-if="!voting.isVoteInProgress && !voting.lockedVote"
            @click="start"
          >
            {{ "开始" }}
          </div>
          <div
            class="button"
            v-if="!voting.isVoteInProgress && !voting.lockedVote"
            @click="start0"
          >
            {{ "统计" }}
          </div>
          <template v-else>
            <div
              v-if="voting.isVoteInProgress"
              class="button townsfolk"
              :class="{ disabled: !voting.lockedVote }"
              @click="pause"
            >
              {{ voteTimer ? "暂停" : "继续" }}
            </div>
            <div class="button" @click="stop">重置</div>
          </template>
          <div class="button demon" @click="finish">关闭</div>
        </div>
        <div class="button-group mark" v-if="nominee.role.team !== 'traveler'">
          <div
            class="button"
            :class="{
              disabled: nomination[1] === voting.markedPlayer,
            }"
            @click="setMarked"
          >
            标记处决
          </div>
          <div class="button" @click="removeMarked">清除标记</div>
        </div>

        <div class="secretVote" @click="setSecretVote()">
          <span
            >闭眼投票
            <em
              ><font-awesome-icon
                :icon="[
                  'fas',
                  voting.isSecretVote ? 'check-square' : 'square',
                ]"
            /></em>
          </span>
        </div>
      </template>
      <template v-else-if="canVote">
        <div v-if="!voting.isVoteInProgress">
          {{ voting.votingSpeed / 1000 }} 秒投票间隔
        </div>
        <div class="button-group">
          <div
            v-if="voting.playerVotes > 1 && nominee.role.team !== 'traveler'"
            class="button townsfolk"
            @click="vote(false)"
            :class="{ disabled: minVote }"
          >
            放下全部
          </div>
          <div
            class="button townsfolk"
            @click="vote(-1)"
            :class="{ disabled: minVote }"
          >
            放下
          </div>
          <div
            class="button demon"
            @click="vote(1)"
            :class="{ disabled: maxVote }"
          >
            投票
          </div>
          <div
            v-if="voting.playerVotes > 1 && nominee.role.team !== 'traveler'"
            class="button demon"
            @click="vote(true)"
            :class="{ disabled: maxVote }"
          >
            投票全部
          </div>
        </div>
      </template>
      <div v-else-if="!player">请落座后投票！</div>
      <div v-if="session.isSpectator" v-show="voting.isSecretVote">
        闭眼投票
      </div>
    </div>
    <transition name="blur">
      <div
        class="countdown"
        v-if="voting.isVoteInProgress && !voting.lockedVote"
      >
        <span>3</span>
        <span>2</span>
        <span>1</span>
        <span>开始</span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useVotingStore } from "../stores/voting";
import { usePlayersStore } from "../stores/players";
import { useSessionIdentityStore } from "../stores/session-identity";
import store from "../store";

const voting = useVotingStore();
const playerState = usePlayersStore();
const session = useSessionIdentityStore();
const voteTimer = ref<ReturnType<typeof setInterval> | null>(null);

const players = computed(() => playerState.players);
const alive = computed(
  () => players.value.filter((player) => !player.isDead).length,
);
const nomination = computed(
  () => voting.nomination || ([0, 0] as [number, number]),
);
const nominator = computed(() => players.value[nomination.value[0]]);
const nominee = computed(() => players.value[nomination.value[1]]);
const nominatorStyle = computed(() => {
  const playerCount = players.value.length;
  const nominationIndex = nomination.value[0];
  return {
    transform: `rotate(${Math.round(
      (nominationIndex / playerCount) * 360,
    )}deg)`,
    transitionDuration: voting.votingSpeed - 100 + "ms",
  };
});
const nomineeStyle = computed(() => {
  const playerCount = players.value.length;
  const nominationIndex = nomination.value[1];
  const rotation =
    (360 * (nominationIndex + Math.min(voting.lockedVote, playerCount))) /
    playerCount;
  return {
    transform: `rotate(${Math.round(rotation)}deg)`,
    transitionDuration: voting.votingSpeed - 100 + "ms",
  };
});
const player = computed(() =>
  players.value.find((item) => item.id === session.playerId),
);
const maxVote = computed(() => {
  const index = players.value.findIndex((item) => item.id === session.playerId);
  return index >= 0
    ? !!voting.votes[index] &&
        Number(voting.votes[index]) >=
          (nominee.value.role.team === "traveler" ? 1 : voting.playerVotes)
    : false;
});
const minVote = computed(() => {
  const index = players.value.findIndex((item) => item.id === session.playerId);
  return index >= 0
    ? !voting.votes[index] || Number(voting.votes[index]) <= 0
    : true;
});
const canVote = computed(() => {
  if (!player.value) return false;
  if (player.value.isVoteless && nominee.value.role.team !== "traveler") {
    return false;
  }
  const playerCount = players.value.length;
  const index = players.value.indexOf(player.value);
  const indexAdjusted =
    (index - 1 + playerCount - nomination.value[1]) % playerCount;
  return indexAdjusted >= voting.lockedVote - 1;
});
const voters = computed(() => {
  const nominationIndex = nomination.value[1];
  const voterNames = Array(players.value.length)
    .fill("")
    .map((_, index) => (voting.votes[index] ? players.value[index].name : ""));
  const reordered = [
    ...voterNames.slice(nominationIndex + 1),
    ...voterNames.slice(0, nominationIndex + 1),
  ];
  return (
    voting.lockedVote ? reordered.slice(0, voting.lockedVote - 1) : reordered
  ).filter(Boolean);
});

function clearVoteTimer() {
  if (voteTimer.value) clearInterval(voteTimer.value);
  voteTimer.value = null;
}

function advanceVote() {
  store.commit("session/lockVote");
  if (voting.lockedVote > players.value.length) {
    clearVoteTimer();
    store.commit("session/setVoteInProgress", false);
  }
}

function countdown() {
  store.commit("session/lockVote", 0);
  store.commit("session/setVoteInProgress", true);
  voteTimer.value = setInterval(start, 4000);
}

function start() {
  store.commit("session/lockVote", 1);
  store.commit("session/setVoteInProgress", true);
  clearVoteTimer();
  voteTimer.value = setInterval(advanceVote, voting.votingSpeed);
}

function start0() {
  const speed = voting.votingSpeed;
  store.commit("session/setVotingSpeed", 0);
  start();
  store.commit("session/setVotingSpeed", speed);
}

function pause() {
  if (voteTimer.value) {
    clearVoteTimer();
  } else {
    voteTimer.value = setInterval(advanceVote, voting.votingSpeed);
  }
}

function stop() {
  clearVoteTimer();
  store.commit("session/setVoteInProgress", false);
  store.commit("session/lockVote", 0);
}

function finish() {
  clearVoteTimer();
  store.commit("session/addHistory", players.value);
  store.commit("session/addVoteSelected", {
    selected: false,
    players: players.value,
    save: true,
  });
  store.commit("session/nomination");
}

function vote(vote: boolean | number) {
  if (!canVote.value) return false;
  const index = players.value.findIndex((item) => item.id === session.playerId);
  const limit = nominee.value.role.team === "traveler" ? 1 : voting.playerVotes;
  if (index >= 0) {
    const votes =
      typeof vote === "number"
        ? Math.max(Math.min(vote + Number(voting.votes[index]), limit), 0)
        : vote
        ? limit
        : 0;
    store.commit("session/voteSync", [index, votes]);
  }
}

function setVotingSpeed(diff: number) {
  const speed = Math.round(voting.votingSpeed + diff);
  if (speed > 0) store.commit("session/setVotingSpeed", speed);
}

function setMarked() {
  store.commit("session/setMarkedPlayer", {
    val: nomination.value[1],
    force: true,
  });
}

function removeMarked() {
  store.commit("session/setMarkedPlayer", { val: -1, force: true });
}

function setSecretVote() {
  if (session.isSpectator || voting.isVoteInProgress) return;
  store.commit("session/setSecretVote", !voting.isSecretVote);
}

watch(
  () => nominee.value?.role?.team,
  (team) => {
    if (team !== "traveler") return;
    const index = players.value.findIndex(
      (item) => item.id === session.playerId,
    );
    if (
      index >= 0 &&
      !!voting.votes[index] &&
      Number(voting.votes[index]) > 1
    ) {
      store.commit("session/voteSync", [index, 1]);
    }
  },
  { immediate: true },
);

onBeforeUnmount(clearVoteTimer);
</script>

<style lang="scss" scoped>
@import "../vars.scss";

#vote {
  position: absolute;
  width: 20%;
  z-index: 20;
  display: flex;
  align-items: center;
  align-content: center;
  justify-content: center;
  background: url("../assets/demon-head.png") center center no-repeat;
  background-size: auto 75%;
  text-align: center;
  text-shadow:
    0 1px 2px #000000,
    0 -1px 2px #000000,
    1px 0 2px #000000,
    -1px 0 2px #000000;

  .mark .button {
    font-size: 75%;
    margin: 0;
  }

  &:after {
    content: " ";
    padding-bottom: 100%;
    display: block;
  }

  em {
    color: $demon;
    font-style: normal;
    font-weight: bold;
    &.blue {
      color: $townsfolk;
    }
  }

  svg {
    cursor: pointer;
    &:hover path {
      fill: url(#demon);
      stroke-width: 30px;
      stroke: white;
    }
  }
}

@keyframes arrow-cw {
  0% {
    opacity: 0;
    transform: rotate(-180deg);
  }
  100% {
    opacity: 1;
    transform: rotate(0deg);
  }
}

@keyframes arrow-ccw {
  0% {
    opacity: 0;
    transform: rotate(180deg);
  }
  100% {
    opacity: 1;
    transform: rotate(0deg);
  }
}

.arrows {
  position: absolute;
  display: flex;
  height: 150%;
  width: 25%;
  pointer-events: none;
  span {
    position: absolute;
    width: 100%;
    height: 100%;
    transition: transform 2.9s ease-in-out;
  }
  span:before {
    content: " ";
    width: 100%;
    height: 100%;
    display: block;
    background-size: auto 100%;
    background-repeat: no-repeat;
    background-position: center center;
    position: absolute;
    filter: drop-shadow(0px 0px 3px #000);
  }
  .nominator:before {
    background-image: url("../assets/clock-small.png");
    animation: arrow-ccw 1s ease-out;
  }
  .nominee:before {
    background-image: url("../assets/clock-big.png");
    animation: arrow-cw 1s ease-out;
  }
}

@keyframes countdown {
  0% {
    transform: scale(1.5);
    opacity: 0;
    filter: blur(20px);
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: scale(1);
    filter: blur(0);
  }
  90% {
    color: $townsfolk;
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@keyframes countdown-go {
  0% {
    transform: scale(1.5);
    opacity: 0;
    filter: blur(20px);
  }
  10% {
    opacity: 1;
  }
  50% {
    transform: scale(1);
    filter: blur(0);
  }
  90% {
    color: $demon;
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.countdown {
  display: flex;
  position: absolute;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  audio {
    height: 0;
    width: 0;
    visibility: hidden;
  }
  span {
    position: absolute;
    font-size: 8em;
    font-weight: bold;
    opacity: 0;
  }
  span:nth-child(1) {
    animation: countdown 1100ms normal forwards;
  }
  span:nth-child(2) {
    animation: countdown 1100ms normal forwards 1000ms;
  }
  span:nth-child(3) {
    animation: countdown 1100ms normal forwards 2000ms;
  }
  span:nth-child(4) {
    animation: countdown-go 1100ms normal forwards 3000ms;
  }
}

.secretVote {
  cursor: pointer;
  color: white;
  &:hover {
    color: red;
  }
  em:not(#demon):not(.button) 
  // &.fa-check-square
  // &.fa-square
  {
    color: white !important;
    &:hover {
      color: inherit !important;
    }
  }
  svg {
    cursor: pointer !important;
    &:hover {
      fill: white !important;
    }
  }
}

img.icon {
  width: 20%;
  height: 100%;
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  white-space: nowrap;
}
</style>
