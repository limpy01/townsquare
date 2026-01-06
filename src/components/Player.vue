<template>
  <li :style="zoom">
    <div
      ref="player"
      class="player"
      :class="[
        {
          dead: player.isDead,
          marked: session.markedPlayer === index,
          'no-vote': player.isVoteless,
          'vote-yes': session.votes[index],
          'vote-lock': voteLocked,
          talking: player.isTalking && player.id
        },
        player.role.team
      ]"
    >
      <div class="seatNum">{{ players.indexOf(player) + 1 }}</div>
      <div class="newMessage" v-show="player.newMessages > 0">{{ player.newMessages }}</div>

      <div class="shroud" @click="toggleStatus()"></div>
      <div class="life" @click="toggleStatus()"></div>
      <div v-if="player.id" class="avatar">
        <!-- <img :src="`https://botcgrimoire.uk/avatars/${player.image}`" 
          :class="{ on: player.role.id }"
        > -->
        <img :src="`https://botcgrimoire.top/avatars/${player.image}`" 
          :class="{ on: player.role.id }"
        >
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
        <transition-group name="vote" tag="div" class="overlay" appear
          v-show="!!session.votes[index] && session.votes[index] > 1"
        >
          <font-awesome-icon
            v-for="(n, id) in session.votes[index]"
            :key="n"
            :style="{ transform: getVoteTransform(id, session.votes[index]) }"
            icon="hand-paper"
            class="vote"
            title="Hand UP"
            @click="vote()"
          />
        </transition-group>
        <font-awesome-icon
          v-show="!session.votes || session.votes[index] <= 1"
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
        <div v-if="!player.id && session.isSpectator && !session.isReview" class="sitDown" :style=font>
          <font-awesome-icon icon="chair"  style="position: relative; top: 50%;"/> 坐下
        </div>
        <div v-if="!player.id && !session.isSpectator && grimoire.isShowVacant" class="sitDown" :style="font">
          <font-awesome-icon icon="chair"  style="position: relative; top: 50%;"/> 空位
        </div>
          
      </div>

      <!-- Role specific icons -->
      <template v-if="player.id">
        <font-awesome-icon
          v-if="!player.isAllowRole"
          id="slash"
          icon="slash"
          class='designated-role'
        />
        <font-awesome-icon 
          v-if="player.isWraith"
          :icon="['custom', 'wraith']"
          class='designated-role'
          :class="{'is-using-wraith': player.isUsingWraith}"
          @click="toggleAllowRole()"
        />
      </template>

      <!-- Claimed seat icon -->
      <font-awesome-icon
        icon="chair"
        v-if="player.id && session.sessionId"
        class="seat"
        :class="{ highlight: session.isRolesDistributed || session.isTypesDistributed }"
      />

      <!-- Ghost vote icon -->
      <font-awesome-icon
        icon="vote-yea"
        :class="(session.sessionId && player.isSecretVoteless && !session.isSpectator) ? 'secret-no-vote' : 'has-vote'"
        v-if="player.isDead && !player.isVoteless"
        @click="toggleVote()"
        title="Ghost vote"
      />

      <!-- Multiple votes -->
       <div
        >
        <font-awesome-icon
          v-if="!player.isDead && player.votes > 1 && !player.isVoteless"
          icon="hand-paper"
          class='has-vote'
        />
        
        <span
          v-if="player.votes > 1 && !player.isVoteless"
          class='multiple-votes'
          @click="toggleVote()"
        >&nbsp;{{ player.votes }}
        </span>
       </div>

      <!-- On block icon -->
      <div class="marked">
        <font-awesome-icon icon="skull" />
      </div>
      <div
        class="name"
        @click="checkOverTop()"
        :class="{ active: isMenuOpen }"
      >
        <span v-if="player.id">{{ player.name }}</span>
        <span v-else>空座位</span>
        <font-awesome-icon icon="venus-mars" v-if="player.pronouns" />
        <div class="pronouns" v-if="player.pronouns">
          <span>{{ player.pronouns }}</span>
        </div>
      </div>

      <transition name="fold">
        <ul class="menu" ref="playerMenu" v-if="isMenuOpen" :style="[playerMenuAdjustment, { '--before': (menuTop < 0 ? Math.round(menuNewTop - menuTop) + 5 : 5) + 'px' }]">
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
            <li @click="movePlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="redo-alt" />
              移动玩家
            </li>
            <li @click="swapPlayer()" :class="{ disabled: session.lockedVote }">
              <font-awesome-icon icon="exchange-alt" />
              交换座位
            </li>
            <li @click="removePlayer" :class="{ disabled: session.lockedVote }">
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
            <template v-if="!session.nomination">
              <li @click="nominatePlayer()">
                <font-awesome-icon icon="hand-point-right" />
                提名
              </li>
            </template>
            <li @click="addVote(player)">
              <font-awesome-icon icon="plus" prefix="fa"/>
              增加票数
            </li>
            <li v-if="player.votes > 1" @click="subtractVote(player)">
              <font-awesome-icon icon="minus" prefix="fa"/>
              减少票数
            </li>
            <li v-if="!player.id || player.id === 'host'" @click="setStoryTeller(player)">
              <font-awesome-icon icon="book-open" prefix="fa"/>
              <span v-if="!player.id">设为</span>
              <span v-else>移除</span>说书人
            </li>
            <li v-if="!!player.id" @click="toggleWraith()">
              <font-awesome-icon :icon="['custom', 'wraith']"/>
              <span>亡魂</span>
            </li>
            <li @click="openChat(player)">
                <font-awesome-icon icon="comment" prefix="fa"/>
              私聊
            </li>
          </template>
          <li
            @click="claimSeat"
            v-if="session.isSpectator"
            :class="{ disabled: player.id && player.id !== session.playerId }"
          >
            <font-awesome-icon icon="chair" />
            <template v-if="!player.id">
              坐下
            </template>
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
                : require('../assets/icons/' +
                    (reminder.imageAlt || reminder.role.replace(/old1$/, '')) +
                    '.png')
            })`
          }"
        ></span>
        <span class="text">{{ reminder.name }}</span>
      </div>
    </template>
    <div v-if="!session.isSpectator || !session.isReview" class="reminder add" @click="$emit('trigger', ['openReminderModal'])">
      <span class="icon"></span>
    </div>
    <div class="reminderHoverTarget"></div>
  </li>
</template>

<script>
import Token from "./Token";
import { mapGetters, mapState } from "vuex";
// import Vue from "vue";

export default {
  components: {
    Token
  },
  props: {
    player: {
      type: Object,
      required: true
    }
  },
  computed: {
    ...mapState("players", ["players"]),
    ...mapState(["grimoire", "session"]),
    ...mapGetters({ nightOrder: "players/nightOrder" }),
    index: function() {
      return this.players.indexOf(this.player);
    },
    voteLocked: function() {
      const session = this.session;
      const players = this.players.length;
      if (!session.nomination) return false;
      const indexAdjusted =
        (this.index - 1 + players - session.nomination[1]) % players;
      return indexAdjusted < session.lockedVote - 1;
    },
    zoom: function() {
      const unit = this.windowWidth > this.windowHeight ? "vh" : "vw";
      // var ratio = {};
      if (this.players.length < 7) {
        return { width: 18 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 10) {
        return { width: 16 + this.grimoire.zoom + unit };
      } else if (this.players.length <= 15) {
        return { width: 14 + this.grimoire.zoom + unit };
      } else {
        return { width: 12 + this.grimoire.zoom + unit };
      }
    },
    font: function() {
      const width = this.windowWidth;
      const height = this.windowHeight;
      const referenceWidth = 1080;
      return "font-size: " + (this.grimoire.zoom + 20) * Math.min(width, height) / referenceWidth + "px";
    },
    playerMenuAdjustment() {
      if (!this.menuTop) return null;
      if (this.menuTop === 0) return null;
      const position = {
        top: '0px',
        height: this.menuHeight + 'px'
      }
      return position;
    },
    reminders() {
      const reminders = !this.session.isSpectator ? this.player.reminders : 
        (this.session.isReview ? this.player.stReminders : this.player.reminders);
      return reminders;
    }
  },
  data() {
    return {
      isMenuOpen: false,
      isSwap: false,
      newMessages: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      menuTop: null,
      menuHeight: null,
      menuNewTop: null,
      votes: 0
    };
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  watch: {
    'isMenuOpen': {
      handler(val) {
        if (!val) {
          this.menuTop = null;
          this.menuHeight = null;
        }
      },
      immediate: true
    },
    'player.id': {
      handler() {
        this.$nextTick(() => {
          this.resize();
        })
      },
    }
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
    handleResize(){
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    getVoteTransform(index, totalVotes, scaleValue = 1) {
      const offsetX = 20; // Horizontal offset per icon
      const offsetY = 0; // Vertical offset per icon

      // Calculate the total shift for the entire group to keep it centered
      const totalShiftX = (totalVotes - 1) * offsetX / 2;
      const totalShiftY = (totalVotes - 1) * offsetY / 2;

      // Calculate the specific offset for the current icon
      const iconShiftX = (index * offsetX) - totalShiftX;
      const iconShiftY = (index * offsetY) - totalShiftY;

      return `translate(${iconShiftX}px, ${iconShiftY}px) scale(${scaleValue})`;
    },
    clickSetRole(){
      if (this.session.isSpectator && !this.player.id){
        this.claimSeat();
        return;
      }
      if (!this.session.isSpectator || !this.session.isReview) this.$emit('trigger', ['openRoleModal']);
    },
    async changePronouns() {
      if (this.session.isSpectator && this.player.id !== this.session.playerId)
        return;

      const input = await this.showInputModal({
        inputType: "pronouns",
        inputModal: "input",
        inputData: {
          name: ["请输入人称代词"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const pronouns = input[0];
      //Only update pronouns if not null (prompt was not cancelled)
      if (pronouns !== null) {
        this.updatePlayer("pronouns", pronouns, true);
      }
    },
    toggleStatus() {
      if (this.grimoire.isPublic) {
        if (!this.player.isDead) {
          this.updatePlayer("isDead", true);
          if (this.player.isMarked) {
            this.updatePlayer("isMarked", false);
          }
        } else if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
          this.updatePlayer("isDead", false);
        } else {
          this.updatePlayer("isVoteless", true);
        }
      } else {
        this.updatePlayer("isDead", !this.player.isDead);
        if (this.player.isMarked) {
          this.updatePlayer("isMarked", false);
        }
        if (this.player.isVoteless) {
          this.updatePlayer("isVoteless", false);
        }
        if (this.player.isSecretVoteless) {
          this.updatePlayer("isSecretVoteless", false);
          this.updatePlayer("isVoteless", false);
        }
      }
    },
    toggleVote() {
      if (!this.player.isDead) return;
      if (this.session.isSecretVote && !this.player.isSecretVoteless) {
        this.updatePlayer('isSecretVoteless', true);
      } else {
        this.updatePlayer('isVoteless', true);
      }
    },
    toggleAllowRole() {
      if (this.session.isSpectator) return;
      this.updatePlayer('isAllowRole', !this.player.isAllowRole, true);
    },
    async toggleWraith() {
      if (this.session.isSpectator) return;
      if (this.player.isWraith) {
        this.updatePlayer('isWraith', false, true);
        this.updatePlayer('isUsingWraith', false, true);
        this.updatePlayer('isAllowRole', true, true);
        return;
      }
      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定允许该玩家使用亡魂能力吗？"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) this.updatePlayer('isWraith', true, true);
      await this.$nextTick();
    },
    async changeName() {
      if (this.session.isSpectator) return;

      const input = await this.showInputModal({
        inputType: "changeNameSt",
        inputModal: "input",
        inputData: {
          name: ["请输入玩家昵称"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;
      
      const name = input[0];
      this.updatePlayer("name", name, true);
    },
    removeReminder(reminder) {
      if (this.session.isReview && this.session.isSpectator) return;
      const reminders = [...this.player.reminders];
      reminders.splice(this.player.reminders.indexOf(reminder), 1);
      this.updatePlayer("reminders", reminders, true);
      if (!this.session.isSpectator && reminder.role != "custom") {
        const stReminders = [...this.player.stReminders];
        const index = stReminders.findIndex(stReminder => stReminder.role === reminder.role);
        if (index === -1) return;
        stReminders.splice(index, 1);
        this.updatePlayer("stReminders", stReminders, true);
      }
    },
    async checkOverTop(toggle = true) {
      if (toggle) this.isMenuOpen = !this.isMenuOpen;
      if (!this.isMenuOpen) return;

      await this.$nextTick();
      const position = this.$refs.playerMenu.getBoundingClientRect();
      const top = position.top < 0 ? Math.floor(position.top) : 0;
      this.menuTop = top;
      this.menuHeight = Math.ceil(Math.abs(position.height));

      await this.$nextTick();
      this.menuNewTop = this.$refs.playerMenu.getBoundingClientRect().top;

    },
    resize() {
      if (!this.isMenuOpen) return;

      this.menuTop = null;
      this.menuHeight = null;
      this.menuNewTop = null;
      this.checkOverTop(false);
    },
    updatePlayer(property, value, closeMenu = false) {
      if (
        this.session.isSpectator &&
        property !== "reminders" &&
        property !== "stReminders" &&
        property !== "pronouns"
      )
        return;
      this.$store.commit("players/update", {
        player: this.player,
        property,
        value
      });
      if (closeMenu) {
        this.isMenuOpen = false;
      }
    },
    emptyPlayer(){
      this.$store.commit("players/empty", {player: this.player, id: this.player.id});
    },
    async removePlayer() {
      this.isMenuOpen = false;

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要移除该座位吗？"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        if (this.player.id) this.emptyPlayer();
        this.$emit("trigger", ["removePlayer"]);
      }
    },
    swapPlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["swapPlayer", player]);
    },
    movePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["movePlayer", player]);
    },
    nominatePlayer(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["nominatePlayer", player]);
    },
    cancel() {
      this.$emit("trigger", ["cancel"]);
    },
    claimSeat() {
      this.isMenuOpen = false;
      this.$emit("trigger", ["claimSeat"]);
    },
    setStoryTeller(player) {
      this.isMenuOpen = false;
      this.$emit("trigger", ["setStoryTeller", player]);
    },
    openChat(player){
      // direct message in grimoire
      this.isMenuOpen = false;
      if (!player.id) return;
      this.$emit("trigger", ["openChat"]);
    },
    /**
     * Allow the ST to override a locked vote.
     */
    vote() {
      if (this.session.isSpectator) return;
      if (!this.voteLocked) return;
      this.$store.commit("session/voteSync", [
        this.index,
        this.session.votes[this.index] > 0 ? 0 : 1
      ]);
    },
    addVote(player) {
      if (this.session.isSpectator) return;
      this.$emit("trigger", ["addVote", player]);
      this.resize();
    },
    subtractVote(player) {
      if (this.session.isSpectator) return;
      this.$emit("trigger", ["subtractVote", player]);
      this.resize();
    }
  }
};
</script>

<style lang="scss">
@import "../vars.scss";

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
.player .avatar,.player .token {
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
  filter: blur(3px)
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
.player .overlay .sitDown{
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
    0%, 100% {
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
  text-shadow: -1px 1px #000,
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
    text-shadow: 0 1px 1px #f6dfbd, 0 -1px 1px #f6dfbd, 1px 0 1px #f6dfbd,
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
