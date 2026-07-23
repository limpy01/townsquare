<template>
  <Modal v-if="modals.draw" @close="close" class="roles">
    <h3>请抽取角色</h3>
    <ul class="tokens">
      <li
        v-for="role in draw.roles"
        v-show="Object.keys(displayRole).length === 0"
        :key="role.id"
        @click="storeRole(role)"
        :style="tokenWidth"
      >
        <Token style="visibility: hidden" :role="role" />
        <div class="life"></div>
      </li>
    </ul>
    <ul v-if="Object.keys(displayRole).length !== 0">
      <Token :role="displayRole" />
    </ul>
    <div class="multiple">
      <span v-if="Object.keys(displayRole).length === 0">
        <span v-if="drawnRoles.length !== nonTravelerLength"
          >请为{{
            drawingIndex + 1 + nextConsecutiveTravelerNumber
          }}号抽取身份</span
        >
      </span>
      <span v-else
        >请点击确认后交给
        <span v-if="drawnRoles.length === nonTravelerLength">说书人</span>
        <span v-else>下一名玩家</span>
      </span>
    </div>
    <div
      class="button-group"
      v-if="otherTravelers.size && !session.isSpectator"
    >
      <span
        class="button"
        v-if="Object.keys(displayRole).length === 0"
        @click="finishDraw()"
      >
        <span v-if="drawnRoles.length === nonTravelerLength"
          >分配已抽取角色至魔典</span
        >
        <span v-else>随机分配剩余角色</span>
      </span>
      <span class="button" v-else @click="nextRole()"> 确定 </span>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import { useDrawStore } from "../../stores/draw";
import Modal from "./Modal";
import Token from "../Token";

export default {
  components: { Token, Modal },
  props: ["playerIndex"],
  computed: {
    tokenWidth() {
      const percentage = 0.06;
      const width = percentage * this.windowWidth;
      return width >= 80 ? "width: 6vw" : "width: 80px";
    },
    nonTravelerLength() {
      return this.players.filter((player) => player.role.team !== "traveler")
        .length;
    },
    nextConsecutiveTravelerNumber() {
      let count = 0;
      for (let i = this.drawingIndex; i < this.players.length; i++) {
        if (this.players[i].role?.team === "traveler") {
          count++;
        } else {
          break;
        }
      }
      return count;
    },
    ...mapState(["modals", "session"]),
    ...mapState("players", ["players"]),
    ...mapState(["otherTravelers"]),
    draw() {
      return useDrawStore();
    },
  },
  data() {
    return {
      displayRole: {},
      drawingIndex: 0,
      drawnRoles: [],
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  },
  mounted() {
    window.addEventListener("resize", this.handleResize);
    this.drawingIndex = this.players.findIndex(
      (player) => player.role.team !== "traveler",
    );
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    handleResize() {
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    storeRole(role) {
      if (Object.keys(this.displayRole).length > 0) this.displayRole = {};
      const index = this.draw.roles.indexOf(role);
      if (index < 0) return;
      this.displayRole = this.draw.roles.splice(index, 1)[0];
      this.drawnRoles.push(this.displayRole);
    },
    nextRole() {
      this.displayRole = {};
      this.drawingIndex = this.drawingIndex + 1;
      while (
        this.drawingIndex < this.players.index &&
        this.players[this.drawingIndex].role.team === "traveler"
      )
        this.drawingIndex = this.drawingIndex + 1;
    },
    finishDraw() {
      const drawnRoles = [...this.drawnRoles, ...this.draw.roles];
      let skip = 0;
      for (let i = 0; i < drawnRoles.length; i++) {
        while (this.players[i + skip].role.team === "traveler") skip++;
        this.$store.commit("players/update", {
          player: this.players[i + skip],
          property: "role",
          value: drawnRoles[i],
        });
      }
      this.close();
    },
    close() {
      this.displayRole = {};
      this.drawingIndex = 0;
      this.drawnRoles = [];
      this.draw.clearRoles();
      this.toggleModal("draw");
    },
    ...mapMutations(["toggleModal"]),
  },
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";

ul.tokens {
  li {
    border-radius: 50%;
    width: 120px;
    margin: 5px;
    transition: all 250ms;
    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    }
  }
  .life {
    border-radius: 50%;
    width: 100%;
    background: url("../../assets/life.png") center center;
    background-size: 100%;
    border: 3px solid black;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    cursor: pointer;
    position: absolute;
    left: 0;
    top: 0;

    &:before {
      content: " ";
      display: block;
      padding-top: 100%;
    }

    &:hover {
      transform: scale(1.2);
    }
  }
}
.roles .modal {
  .multiple {
    display: block;
    text-align: center;
  }
}
</style>
