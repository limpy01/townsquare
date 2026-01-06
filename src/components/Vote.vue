<template>
  <div id="vote">
    <div class="arrows">
      <span class="nominee" :style="nomineeStyle"></span>
      <span class="nominator" :style="nominatorStyle"></span>
    </div>
    <div class="overlay">
      <em class="blue">{{ (session.nomination[0] + 1) + ". " + nominator.name }}</em> 提名了
      <em>{{ (session.nomination[1] + 1) + ". " + nominee.name }}</em
      >！
      <br />
      <em class="blue">
        {{ session.votes.filter(item => typeof item === "number" || typeof item === "boolean").reduce((item, sum) => item + sum, 0) }} 票
      </em>
      
      <em v-if="nominee.role.team !== 'traveler'">
        （满{{ Math.ceil(alive / 2) }}票通过）
      </em>
      <em v-else>（满{{ Math.ceil(players.length / 2) }}票通过）</em>

      <template v-if="!session.isSpectator">
        <div v-if="!session.isVoteInProgress && session.lockedVote < 1">
          每位玩家投票时间：
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(-500)"
            icon="minus-circle"
          />
          {{ session.votingSpeed / 1000 }}s
          <font-awesome-icon
            @mousedown.prevent="setVotingSpeed(500)"
            icon="plus-circle"
          />
        </div>
        <div class="button-group">
          <div
            class="button townsfolk"
            v-if="!session.isVoteInProgress"
            @click="countdown"
          >
            倒计时
          </div>
          <div class="button" v-if="!session.isVoteInProgress && !session.lockedVote" @click="start">
            {{ "开始" }}
          </div>
          <div class="button" v-if="!session.isVoteInProgress && !session.lockedVote" @click="start0">
            {{ "统计" }}
          </div>
          <template v-else>
            <div
              v-if="session.isVoteInProgress"
              class="button townsfolk"
              :class="{ disabled: !session.lockedVote }"
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
              disabled: session.nomination[1] === session.markedPlayer
            }"
            @click="setMarked"
          >
            标记处决
          </div>
          <div class="button" @click="removeMarked">
            清除标记
          </div>
        </div>
        
        <div class="secretVote" @click="setSecretVote()">
          <span>闭眼投票
          <em><font-awesome-icon :icon="['fas', session.isSecretVote ? 'check-square' : 'square']"/></em>
          </span>
        </div>
      </template>
      <template v-else-if="canVote">
        <div v-if="!session.isVoteInProgress">
          {{ session.votingSpeed / 1000 }} 秒投票间隔
        </div>
        <div class="button-group">
          <div
            v-if="session.playerVotes > 1 && nominee.role.team !== 'traveler'"
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
            v-if="session.playerVotes > 1 && nominee.role.team !== 'traveler'"
            class="button demon"
            @click="vote(true)"
            :class="{ disabled: maxVote }"
          >
            投票全部
          </div>
        </div>
      </template>
      <div v-else-if="!player">
        请落座后投票！
      </div>
      <div v-if="session.isSpectator" v-show="session.isSecretVote">
        闭眼投票
      </div>
    </div>
    <transition name="blur">
      <div
        class="countdown"
        v-if="session.isVoteInProgress && !session.lockedVote"
      >
        <span>3</span>
        <span>2</span>
        <span>1</span>
        <span>开始</span>
      </div>
    </transition>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";

export default {
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["session", "grimoire"]),
    ...mapGetters({ alive: "players/alive" }),
    nominator: function() {
      return this.players[this.session.nomination[0]];
    },
    nominatorStyle: function() {
      const players = this.players.length;
      const nomination = this.session.nomination[0];
      return {
        transform: `rotate(${Math.round((nomination / players) * 360)}deg)`,
        transitionDuration: this.session.votingSpeed - 100 + "ms"
      };
    },
    nominee: function() {
      return this.players[this.session.nomination[1]];
    },
    nomineeStyle: function() {
      const players = this.players.length;
      const nomination = this.session.nomination[1];
      const lock = this.session.lockedVote;
      const rotation = (360 * (nomination + Math.min(lock, players))) / players;
      return {
        transform: `rotate(${Math.round(rotation)}deg)`,
        transitionDuration: this.session.votingSpeed - 100 + "ms"
      };
    },
    player: function() {
      return this.players.find(p => p.id === this.session.playerId);
    },
    maxVote: function() {
      const index = this.players.findIndex(p => p.id === this.session.playerId);
      return index >= 0 ? (!!this.session.votes[index] && this.session.votes[index] >= (this.nominee.role.team === 'traveler' ? 1 : this.session.playerVotes)) : false;
    },
    minVote: function() {
      const index = this.players.findIndex(p => p.id === this.session.playerId);
      return index >= 0 ? (!this.session.votes[index] || this.session.votes[index] <= 0) : true;
    },
    canVote: function() {
      if (!this.player) return false;
      if (this.player.isVoteless && this.nominee.role.team !== "traveler")
        return false;
      const session = this.session;
      const players = this.players.length;
      const index = this.players.indexOf(this.player);
      const indexAdjusted =
        (index - 1 + players - session.nomination[1]) % players;
      return indexAdjusted >= session.lockedVote - 1;
    },
    voters: function() {
      const nomination = this.session.nomination[1];
      const voters = Array(this.players.length)
        .fill("")
        .map((x, index) =>
          this.session.votes[index] ? this.players[index].name : ""
        );
      const reorder = [
        ...voters.slice(nomination + 1),
        ...voters.slice(0, nomination + 1)
      ];
      return (this.session.lockedVote
        ? reorder.slice(0, this.session.lockedVote - 1)
        : reorder
      ).filter(n => !!n);
    }
  },
  data() {
    return {
      voteTimer: null
    };
  },
  watch: {
    'nominee.role.team': {
      handler(val) {
        if (val === 'traveler') {
          const index = this.players.findIndex(p => p.id === this.session.playerId);
          if (index >= 0 && !!this.session.votes[index] && this.session.votes[index] > 1) this.$store.commit("session/voteSync", [index, 1]);
        }
      },
      immediate: true
    }
  },
  methods: {
    countdown() {
      this.$store.commit("session/lockVote", 0);
      this.$store.commit("session/setVoteInProgress", true);
      this.voteTimer = setInterval(() => {
        this.start();
      }, 4000);
    },
    start() {
      this.$store.commit("session/lockVote", 1);
      this.$store.commit("session/setVoteInProgress", true);
      clearInterval(this.voteTimer);
      this.voteTimer = setInterval(() => {
        this.$store.commit("session/lockVote");
        if (this.session.lockedVote > this.players.length) {
          clearInterval(this.voteTimer);
          this.$store.commit("session/setVoteInProgress", false);
        }
      }, this.session.votingSpeed);
    },
    start0() {
      const speed = this.session.votingSpeed;
      this.$store.commit("session/setVotingSpeed", 0);
      this.start();
      this.$store.commit("session/setVotingSpeed", speed);
    },
    pause() {
      if (this.voteTimer) {
        clearInterval(this.voteTimer);
        this.voteTimer = null;
      } else {
        this.voteTimer = setInterval(() => {
          this.$store.commit("session/lockVote");
          if (this.session.lockedVote > this.players.length) {
            clearInterval(this.voteTimer);
            this.$store.commit("session/setVoteInProgress", false);
          }
        }, this.session.votingSpeed);
      }
    },
    stop() {
      clearInterval(this.voteTimer);
      this.voteTimer = null;
      this.$store.commit("session/setVoteInProgress", false);
      this.$store.commit("session/lockVote", 0);
    },
    finish() {
      clearInterval(this.voteTimer);
      this.$store.commit("session/addHistory", this.players);
      this.$store.commit("session/addVoteSelected", {selected: false, players:this.players, save: true});
      this.$store.commit("session/nomination");
    },
    vote(vote) {
      if (!this.canVote) return false;
      const index = this.players.findIndex(p => p.id === this.session.playerId);
      const limit = this.nominee.role.team === "traveler" ? 1 : this.session.playerVotes; // 投票数上限
      if (index >= 0) {
        const votes = (typeof vote === "number") ? Math.max(Math.min(vote + (this.session.votes[index] || !!this.session.votes[index]), limit), 0) : (vote ? limit : 0);
        this.$store.commit("session/voteSync", [index, votes]);
      }
    },
    setVotingSpeed(diff) {
      const speed = Math.round(this.session.votingSpeed + diff);
      if (speed > 0) {
        this.$store.commit("session/setVotingSpeed", speed);
      }
    },
    setMarked() {
      this.$store.commit("session/setMarkedPlayer", {val: this.session.nomination[1], force: true});
    },
    removeMarked() {
      this.$store.commit("session/setMarkedPlayer", {val: -1, force: true});
    },
    setSecretVote() {
      if (this.session.isSpectator) return;
      if (this.session.isVoteInProgress) return;
      const isSecretVote = !this.session.isSecretVote;
      this.$store.commit("session/setSecretVote", isSecretVote);
    }
  }
};
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
  text-shadow: 0 1px 2px #000000, 0 -1px 2px #000000, 1px 0 2px #000000,
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
    &:hover{
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
