<template>
  <Modal v-if="modals.role && availableRoles.length" @close="close">
    <h3>
      为
      {{
        playerIndex >= 0 && players.length
          ? players[playerIndex].name
          : "伪装身份"
      }}
      选择角色
    </h3>
    <ul class="tokens" v-if="tab === 'editionRoles' || !otherTravelers.size">
      <li
        v-for="role in availableRoles"
        v-show="(!role.id && !role.name) || ['townsfolk', 'outsider', 'minion', 'demon'].includes(role.team) || (role.team == 'traveler' && (!session.isSpectator || isShowTraveler && playerIndex < 0))"
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <ul class="tokens" v-if="tab === 'editionRolesFull' || !otherTravelers.size">
      <li
        v-for="role in availableRoles"
        v-show="(!role.id && !role.name) || ['townsfolk', 'outsider', 'minion', 'demon'].includes(role.team) || (role.team == 'traveler' &&  (!session.isSpectator || isShowTraveler && playerIndex < 0))"
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <ul class="tokens" v-if="tab === 'otherTravelers' && otherTravelers.size">
      <li
        v-for="role in otherTravelers.values()"
        :class="[role.team]"
        :key="role.id"
        @click="setRole(role)"
        :style="tokenWidth"
      >
        <Token :role="role" />
      </li>
    </ul>
    <div
      class="button-group"
      v-if="otherTravelers.size && !session.isSpectator"
    >
      <span
        class="button"
        :class="{ townsfolk: tab === 'editionRoles' }"
        @click="tab = 'editionRoles'"
        >
        <span v-if="playerIndex >= 0">剧本角色</span>
        <span v-else>不在场角色</span>
        </span
      >
      <span
        v-if="playerIndex < 0"
        class="button"
        :class="{ townsfolk: tab === 'editionRolesFull' }"
        @click="tab = 'editionRolesFull'"
        >
        全部角色
        </span
      >
      <span
        v-if="playerIndex >= 0"
        class="button"
        :class="{ townsfolk: tab === 'otherTravelers' }"
        @click="tab = 'otherTravelers'"
        >其他旅行者</span
      >
    </div>
    <div
      v-if="session.isSpectator && playerIndex < 0"
      class="check-box"
      @click="toggleShowTraveler()"
    >
      <span>显示旅行者</span> &nbsp;
      <em>
        <font-awesome-icon
          :icon="[
            'fas',
            isShowTraveler ? 'check-square' : 'square'
          ]"
        />
      </em>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";

export default {
  components: { Token, Modal },
  props: ["playerIndex"],
  computed: {
    availableRoles() {
      const availableRoles = [];
      const players = this.$store.state.players.players;
      this.$store.state.roles.forEach(role => {
        // don't show bluff roles that are already assigned to players
        if (
          this.tab === "editionRolesFull" ||
          this.playerIndex >= 0 ||
          (this.playerIndex < 0 &&
            !players.some(player => player.role.id === role.id))
        ) {
          availableRoles.push(role);
        }
      });
      availableRoles.push({});
      return availableRoles;
    },
    tokenWidth() {
      const percentage = 0.06
      const width = percentage * this.windowWidth;
      return width >= 80 ? "width: 6vw" : "width: 80px";
    },
    ...mapState(["modals", "roles", "session"]),
    ...mapState("players", ["players"]),
    ...mapState(["otherTravelers"])
  },
  data() {
    return {
      tab: "editionRoles",
      isShowTraveler: false,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    };
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    handleResize(){
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    setRole(role) {
      if (this.playerIndex < 0) {
        // assign to bluff slot (index < 0)
        this.$store.commit("players/setBluff", {
          index: this.playerIndex * -1 - 1,
          role
        });
      } else {
        if (this.session.isSpectator && role.team === "traveler") return;
        // assign to player
        const player = this.$store.state.players.players[this.playerIndex];
        this.$store.commit("players/update", {
          player,
          property: "role",
          value: role
        });
      }
      this.tab = "editionRoles";
      this.$store.commit("toggleModal", "role");
    },
    close() {
      this.tab = "editionRoles";
      this.toggleModal("role");
    },
    toggleShowTraveler() {
      this.isShowTraveler = !this.isShowTraveler;
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

ul.tokens li {
  border-radius: 50%;
  // width: 120px;
  margin: 1%;
  transition: transform 500ms ease;

  &.townsfolk {
    box-shadow: 0 0 10px $townsfolk, 0 0 10px #004cff;
  }
  &.outsider {
    box-shadow: 0 0 10px $outsider, 0 0 10px $outsider;
  }
  &.minion {
    box-shadow: 0 0 10px $minion, 0 0 10px $minion;
  }
  &.demon {
    box-shadow: 0 0 10px $demon, 0 0 10px $demon;
  }
  &.traveler {
    box-shadow: 0 0 10px $traveler, 0 0 10px $traveler;
  }
  &:hover {
    transform: scale(1.2);
    z-index: 10;
  }
}

.check-box {
  display: flex; 
  justify-content: center; 
  align-items: center;
  width: fit-content; 

  margin-left: auto;
  margin-right: auto;
  
  cursor: pointer; 
  &:hover {
    color: red;
  }
}

</style>
