<template>
  <div
    id="townsquare"
    class="square"
    :class="{
      public: grimoire.isPublic,
      spectator: session.isSpectator,
      vote: session.nomination
    }"
  >
    <audio src="../assets/sounds/countdown.mp3" preload="auto" ref="countdownAudio"></audio>
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
          nominate: nominate > -1
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
        <span v-if="session.isSpectator" style="font-size: 100%;">不在场身份</span>
        <span v-else style="font-size: 100%;">恶魔的伪装身份</span>
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
          <div class="newMessage" v-for="(item, position) in session.newStMessage" :key="position" v-show="item > 0">{{ item }}</div>
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
    <a v-if="!!session.sessionId && (!session.isSpectator || !!session.isHostAllowed || !!session.isJoinAllowed)"
    href="https://botcgrimoire.top/donation/" target="_blank"
    class="donation"
    >
      <span>支持</span>
    </a>

    <div v-if="session.isSpectator && isRole.length > 0"
        class="is-role">
      <font-awesome-icon 
        :icon="['custom', isRole]"
        size="4x"
        :class="{ 'is-using-wraith': session.isRole.wraith.using }"
        @click="setUsingWraith()"
      />
    </div>

    <ReminderModal :player-index="selectedPlayer"></ReminderModal>
    <RoleModal :player-index="selectedPlayer"></RoleModal>

    <div v-show="session.isChatOpen" :class="{chat: !isChatMin, chatMin: isChatMin}" :style="chatStyle">
      <div class="title" @click="maximiseChat()">
        <div v-if="!isChatMin && isInGroup && isShowGroup" class="group" :style="groupStyle">
          <div v-for="player in inGroupPlayers" :key="player.id">
            <span>（{{ player.index + 1 }}号）{{ player.name }}</span>
            <br/>
          </div>
        </div>
        <div>
          <span ref="chatWith" style="cursor: text; user-select: text; pointer-events: auto;"></span> &nbsp;
          <span class="newMessage" v-for="(item, position) in session.newStMessage" :key="position" v-show="session.isSpectator && item > 0">{{ item }}</span>
          <em v-if="isInGroup && !isChatMin">
            <font-awesome-icon v-if="!isShowGroup" icon="arrow-circle-up" @click="toggleGroups()"/>
            <font-awesome-icon v-else icon="arrow-circle-down" @click="toggleGroups()"/>
          </em>
          <span :class="{close: !isChatMin, open: isChatMin}" @click="toggleChat()">
            <font-awesome-icon icon="times" :class="{ turnedIcon45: isChatMin}"/>
          </span>
        </div>
      </div>
      <div ref="chatContent" class="content" @scroll="checkToBottom" >
        <div v-for="(player, index) in session.chatHistory"  :key="index" v-show="(session.isSpectator && player.id === session.stId) || (!session.isSpectator && player.id === chattingPlayer)">
          <ul v-for="(content, chatIndex) in player.chat" :key="chatIndex">{{ content }}</ul>
        </div>
      </div>
      <form class="chatbox" @submit.prevent="sendChat">
        <input type="text" id="message" ref="message" autocomplete="off" class="edit" @focus="typing" @blur="notTyping" v-model="message">
        <button type="submit" class="send">发送</button>
      <div class="toBottom" v-if="false">
          移至底部
          <font-awesome-icon icon="arrow"/>
      </div>
      </form>
    </div>
    <div id="version">
      <a href="https://beian.miit.gov.cn/" target="_blank">浙ICP备2024109577号-2</a>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapState } from "vuex";
import Player from "./Player";
import Token from "./Token";
import ReminderModal from "./modals/ReminderModal";
import RoleModal from "./modals/RoleModal";

export default {
  components: {
    Player,
    Token,
    RoleModal,
    ReminderModal
  },
  computed: {
    ...mapGetters({ nightOrder: "players/nightOrder" }),
    ...mapState(["grimoire", "roles", "session"]),
    ...mapState("players", ["players", "bluffs", "fabled"]),
    orientation: function(){
      const ratio = this.windowWidth / this.windowHeight;
      const unit = this.windowWidth > this.windowHeight ? "height: 100%;" : "height: " + ratio * 100 + "%;";
      return unit;
    },
    floatingZoom: function(){
      const ratio = this.windowWidth / this.windowHeight;
      const size = ratio > 1 ? 14 : 8;
      return "height: " + size + "vh; width: " + size + "vh;";
    },
    chatStyle: function(){
      if (this.isChatMin) return;
      const ratio = this.windowWidth / this.windowHeight;
      const width = ratio < 1 ? '300px' : '25%';
      const height = ratio < 1 ?
        (this.isInGroup && this.isShowGroup ? '450px' : '400px') :
        (this.isInGroup && this.isShowGroup ? 'calc(40% + 10vh)' : '40%');
      return `width: ${width}; height: ${height};`;
    },
    groupStyle: function() {
      const ratio = this.windowWidth / this.windowHeight;
      const height = ratio < 1 ? '50px' : '10vh';
      return `height: ${height};`;
    },
    isInGroup: function(){
      if (this.session.isSpectator) return this.session.groupChats.length > 0 ? true : false;
      return this.chattingGroup != "";
    },
    inGroupPlayers: function(){
      const group = this.session.isSpectator ? this.session.groupChats :
      this.session.groupChats.filter(group => group.id === this.chattingGroup);
      if (group.length === 0) return [];

      const players = [];
      group[0].players.forEach(player => {
        const index = this.players.findIndex(player2 => player2.id === player.id);
        if (index === -1) return;
        players.push({
          id: player.id,
          name: player.name,
          index
        });
      });
      return players;
    },
    isRole: function() {
      const activeRoles = [];
      for (const roleId in this.session.isRole) {
        const roleObject = this.session.isRole[roleId];
        if (roleObject.active === true) {
          activeRoles.push(roleId);
        }
      }
      if (activeRoles.length > 1) {
        return activeRoles.slice(0, 1);
      }
      return activeRoles;
    }
  },
  data() {
    return {
      selectedPlayer: 0,
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
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    };
  },
  watch: {
    "session.chatHistory": {
      handler() {
        this.$nextTick(() => {
          if (this.$refs.chatContent.scrollTop >= -20 && this.isChatOpen && !this.isChatMin) {
            this.scrollToBottom();
          }
        });
      }
    },
    "session.isVoteInProgress": {
      handler() {
        this.$nextTick(() => {
          if (this.session.isVoteInProgress && !this.session.lockedVote) {
            if (!this.grimoire.isMuted) {
              this.$refs.countdownAudio.currentTime = 0;
              this.$refs.countdownAudio.play();
            }
          } else {
            this.$refs.countdownAudio.pause();
            this.$refs.countdownAudio.currentTime = 0;
          }
        })
      }
    },
    "session.groupChats": {
      handler() {
        this.$nextTick(() => {
          if (this.session.isChatOpen != "" && this.session.isSpectator) {
            this.openChat(0, false);
          } else if (this.session.isChatOpen != "" && !this.session.isSpectator) {
            const index = this.players.findIndex(player => player.id === this.chattingPlayer);
            if (index === -1) return;
            this.openChat(index, false);
          }
        });
      },
      deep: true
    }
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    toggleBluffs() {
      this.isBluffsOpen = !this.isBluffsOpen;
    },
    toggleFabled() {
      this.isFabledOpen = !this.isFabledOpen;
    },
    toggleGroups() {
      this.isShowGroup = !this.isShowGroup;
    },
    removeFabled(index) {
      if (this.session.isSpectator) {
        if (index === 0) {
          if (this.session.claimedSeat >= 0) this.openChat(0); //open chat box if user is a player
        }
        
      }else{
        this.$store.commit("players/setFabled", { index });
      }
    },
    handleTrigger(playerIndex, [method, params]) {
      if (typeof this[method] === "function") {
        this[method](playerIndex, params);
      }
    },
    handleResize(){
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    claimSeat(playerIndex) {
      if (!this.session.isSpectator) return;
      if (this.session.playerId === this.players[playerIndex].id) {
        this.$store.commit("session/claimSeat", -1);
      } else {
        this.$store.commit("session/claimSeat", playerIndex);
        this.$store.commit("session/createChatHistory", this.session.stId);
      }
    },
    openReminderModal(playerIndex) {
      this.selectedPlayer = playerIndex;
      this.$store.commit("toggleModal", "reminder");
    },
    openRoleModal(playerIndex) {
      const player = this.players[playerIndex];
      if (this.session.isSpectator && player && player.role.team === "traveler")
        return;
      this.selectedPlayer = playerIndex;
      this.$store.commit("toggleModal", "role");
    },
    removePlayer(playerIndex) {
      if (this.session.isSpectator || this.session.lockedVote) return;
      const { nomination } = this.session;
      if (nomination) {
        if (nomination.includes(playerIndex)) {
          // abort vote if removed player is either nominator or nominee
          this.$store.commit("session/nomination");
        } else if (
          nomination[0] > playerIndex ||
          nomination[1] > playerIndex
        ) {
          // update nomination array if removed player has lower index
          this.$store.commit("session/setNomination", [
            nomination[0] > playerIndex ? nomination[0] - 1 : nomination[0],
            nomination[1] > playerIndex ? nomination[1] - 1 : nomination[1]
          ]);
        }
      }
      this.$store.commit("players/remove", playerIndex);
    },
    swapPlayer(from, to) {
      if (this.session.isSpectator || this.session.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        this.swap = from;
      } else {
        if (this.session.nomination) {
          // update nomination if one of the involved players is swapped
          const swapTo = this.players.indexOf(to);
          const updatedNomination = this.session.nomination.map(nom => {
            if (nom === this.swap) return swapTo;
            if (nom === swapTo) return this.swap;
            return nom;
          });
          if (
            this.session.nomination[0] !== updatedNomination[0] ||
            this.session.nomination[1] !== updatedNomination[1]
          ) {
            this.$store.commit("session/setNomination", updatedNomination);
          }
        }
        this.$store.commit("players/swap", [
          this.swap,
          this.players.indexOf(to)
        ]);
        this.cancel();
      }
    },
    movePlayer(from, to) {
      if (this.session.isSpectator || this.session.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        this.move = from;
      } else {
        if (this.session.nomination) {
          // update nomination if it is affected by the move
          const moveTo = this.players.indexOf(to);
          const updatedNomination = this.session.nomination.map(nom => {
            if (nom === this.move) return moveTo;
            if (nom > this.move && nom <= moveTo) return nom - 1;
            if (nom < this.move && nom >= moveTo) return nom + 1;
            return nom;
          });
          if (
            this.session.nomination[0] !== updatedNomination[0] ||
            this.session.nomination[1] !== updatedNomination[1]
          ) {
            this.$store.commit("session/setNomination", updatedNomination);
          }
        }
        this.$store.commit("players/move", [
          this.move,
          this.players.indexOf(to)
        ]);
        this.cancel();
      }
    },
    nominatePlayer(from, to) {
      if (this.session.isSpectator || this.session.lockedVote) return;
      if (to === undefined) {
        this.cancel();
        if (from !== this.nominate) {
          this.nominate = from;
        }
      } else {
        const nomination = [this.nominate, this.players.indexOf(to)];
        this.$store.commit("session/nomination", { nomination });
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
      this.$store.commit("players/update", {player, property: "votes", value: vote});
    },
    subtractVote(playerIndex) {
      if (this.session.isSpectator) return;
      const player = this.players[playerIndex];
      const vote = player.votes - 1;
      if (vote < 1) return;
      this.$store.commit("players/update", {player, property: "votes", value: vote});
    },
    setStoryTeller(playerIndex) {
      if (this.session.isSpectator) return;
      const player = this.players[playerIndex];
      if (player.id) {
        if (player.id != "host") return;
        this.$store.commit("players/update", {player, property: "id", value: ""});
        this.$store.commit("players/update", {player, property: "name", value: ""});
        this.$store.commit("players/update", {player, property: "isVoteless", value: false});
        this.$store.commit("players/update", {player, property: "isDead", value: false});
      }
      else {
        this.$store.commit("players/update", {player, property: "id", value: "host"});
        this.$store.commit("players/update", {player, property: "name", value: "说书人"});
        this.$store.commit("players/update", {player, property: "isVoteless", value: true});
        this.$store.commit("players/update", {player, property: "isDead", value: true});
      }
    },
    openChat(playerIndex, maximise = true){
      if (maximise) this.maximiseChat();
      
      // display player name or ST in the chat title
      if(this.session.isSpectator){
        const groupChats = this.session.groupChats;
        const name = groupChats.length === 0 ? this.fabled[0].name : "群聊"; //if fabled is messed up this may cause issues
        this.$refs.chatWith.innerText = name;
        if (maximise) this.$store.commit("session/setStMessage", 0);
      }else{
        this.chattingPlayer = this.players[playerIndex].id;
        this.chattingGroup = this.players[playerIndex].chatGroup;
        const name = this.chattingGroup === "" ? this.players[playerIndex].name : this.session.groupChats.filter(group => group.id === this.chattingGroup)[0].name;
        this.$refs.chatWith.innerText = name;
        if (maximise) this.$store.commit("players/setPlayerMessage", {playerId: this.chattingPlayer, num: 0})
      }

      this.$nextTick(() => {
        this.scrollToBottom();
      });
    },
    toggleChat(){
      if(this.isChatMin){
        this.maximiseChat();
      }else{
        this.minimiseChat();
      }
    },
    maximiseChat(){
      if(this.minimising){
        this.minimising = false;
        return;
      }
      if (this.session.isChatOpen && !this.isChatMin) return;
      this.$store.commit("session/setChatOpen", true);
      this.isChatMin = false;

      this.$nextTick(() => {
        this.$refs.message.focus();
      });
    },
    minimiseChat(){
      this.isChatMin = true;
      this.minimising = true;
    },
    sendChat(){
      if (this.message === "") return;
      if (this.session.isSpectator && this.session.claimedSeat < 0) return;
      if (!this.session.isSpectator) {
        let seated = false;
        this.players.forEach(player => {
          if (player.id === this.chattingPlayer) seated = true;
        });
        if (!seated) return;
      }
      const sender = this.session.playerName;
      const sendingPlayerId = this.session.playerId;
      const message = sender.concat(": ", this.message);
      if (this.chattingGroup === "") {
        const receivingPlayerId = this.session.isSpectator ? "host" : this.chattingPlayer;
        this.$store.commit("session/updateChatSent", {message, sendingPlayerId, receivingPlayerId});
      } else {
        const group = this.session.groupChats.filter(group => group.id === this.chattingGroup)[0];
        const playerIds = group.players.map(player => player.id);
        playerIds.forEach(id => {
          this.$store.commit("session/updateChatSent", {message, sendingPlayerId, receivingPlayerId: id});
        })
      }

      if (!this.session.isSpectator) {
        const wraithMessage = `[亡魂][（说书人）${message}]`;
        const players = this.players.filter(player => player.isWraith && player.isUsingWraith && player.isAllowRole && !!player.id);
        players.forEach(player => {
          if (!(player.id === this.chattingPlayer || player.chatGroup === this.chattingGroup)) this.$store.commit("session/updateChatSent", {message: wraithMessage, sendingPlayerId, receivingPlayerId: player.id});
        });
        // this.$store.commit("session/setIsRole", {
        //   role: 'wraith',
        //   property: 'st',
        //   value: this.session.isRole.wraith.player + 1
        // });
        // 每10次互动会让暴露概率增加1%，最高10%
        // const prob = Math.min(0.05 + Math.floor(Math.min(this.session.isRole.wraith.st, this.session.isRole.wraith.player) / 10) * 0.01, this.session.isRole.wraith.probMax);
        // this.$store.commit("session/setIsRole", {
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
    scrollToBottom(){
      this.$nextTick(() => {
        this.$refs.chatContent.scrollTop = this.$refs.chatContent.scrollHeight;
      });
      this.checkToBottom();
    },
    checkToBottom() {
      if (this.$refs.chatContent.scrollTop >= -20){
        // 划至最底则删除红点
        if (!this.session.isSpectator) {
          this.$store.commit("players/setPlayerMessage", {playerId: this.chattingPlayer, num: 0});
        } else{
          this.$store.commit("session/setStMessage", 0);
        }
      }
    },
    typing(){
      this.$store.commit("session/setTyping", true);
      if (this.$refs.chatContent.scrollTop >= -20){
        if (!this.session.isSpectator) {
          this.$store.commit("players/setPlayerMessage", {playerId: this.chattingPlayer, num: 0});
        } else{
          this.$store.commit("session/setStMessage", 0);
        }
      }
    },
    notTyping(){
      this.$store.commit("session/setTyping", false);
    },
    setUsingWraith(){
      const usingWraith = this.session.isRole.wraith.using;
      this.$store.commit("session/setIsRole", {role: 'wraith', property: 'using', value: !usingWraith});
    }
  }
};
</script>

<style lang="scss">
@use "sass:math";
@import "../vars.scss";

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
  border: 2px solid #B67D43; /* A dark, textured border for the outer frame */
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

  box-shadow: 0 0 5px #B67D43; 
  animation: glow-cycle 605s linear; /* 10m duration */
  animation-delay: 1s;
}
// The keyframe animation for 10 minutes oscillation
@keyframes glow-cycle {
  0% { 
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }
  
  0.0826% { // Peak of the 1st pulse
    box-shadow: 0 0 20px #DAB060;
    border-color: #DAB060;
  }
  
  0.165% { // End of the 1st pulse
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }
  
  0.247% { // Peak of the 2nd pulse
    box-shadow: 0 0 20px #DAB060;
    border-color: #DAB060;
  }
  
  0.33% { // End of the 2nd pulse
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }
  
  0.413% { // Peak of the 3rd pulse
    box-shadow: 0 0 20px #DAB060;
    border-color: #DAB060;
  }
  
  0.495% { // End of the 3rd pulse
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }
  
  0.578% { // Peak of the 4th pulse
    box-shadow: 0 0 20px #DAB060;
    border-color: #DAB060;
  }
  
  0.66% { // End of the 4th pulse
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }

  0.743% { // Peak of the 5th pulse
    box-shadow: 0 0 20px #DAB060;
    border-color: #DAB060;
  }
  
  0.826% { // End of the 5th pulse, which is 5 seconds in
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
  }
  
  100% { // The rest of the 10-minute duration is spent here
    box-shadow: 0 0 5px #B67D43;
    border-color: #B67D43;
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
    background-color: #A00;
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

</style>
