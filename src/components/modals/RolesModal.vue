<template>
  <Modal
    class="roles"
    v-if="modals.roles && nonTravelers >= 5"
    @close="toggleModal('roles')"
  >
    <h3>为当前{{ nonTravelers }}名玩家选择角色</h3>
    <ul class="tokens" v-for="(teamRoles, team) in roleSelection" :key="team" >
      <li class="count" :class="[team]">
        {{ teamRoles.reduce((a, { selected }) => a + selected, 0) }} /
        {{ game[nonTravelers - 5][team] }}
      </li>
      <li
        v-for="role in teamRoles"
        :class="[role.team, role.selected ? 'selected' : '']"
        :key="role.id"
        @click="role.selected = role.selected ? 0 : 1"
        :style="tokenWidth"
      >
        <Token :role="role" />
        <font-awesome-icon icon="exclamation-triangle" v-if="role.setup" />
        <div class="buttons" v-if="allowMultiple">
          <font-awesome-icon
            icon="minus-circle"
            @click.stop="role.selected--"
          />
          <span>{{ role.selected > 1 ? "x" + role.selected : "" }}</span>
          <font-awesome-icon icon="plus-circle" @click.stop="role.selected++" />
        </div>
      </li>
    </ul>
    <div class="warningSetup" v-if="hasSelectedSetupRoles">
      <font-awesome-icon icon="exclamation-triangle" />
      <span>
        警告: 目前选择的角色会修改游戏的初始角色配置！随机分发器不会识别这些角色的功能。建议说书人手动调整要分发的角色。
      </span>
    </div><div class="warningReview" v-if="session.isReview">
      <font-awesome-icon icon="exclamation-triangle" />
      <span>
        警告: 正在使用复盘视角，如果即将进行游戏请先关闭复盘视角！
      </span>
    </div>
    <label class="multiple" :class="{ checked: allowMultiple }">
      <font-awesome-icon :icon="allowMultiple ? 'check-square' : 'square'" />
      <input type="checkbox" name="allow-multiple" v-model="allowMultiple" />
      允许重复角色
    </label>
    <div class="button-group">
      <div
        class="button"
        @click="assignRoles(true)"
        :class="{
          disabled: selectedRoles > nonTravelers || !selectedRoles
        }"
      >
        <font-awesome-icon icon="exclamation-triangle" v-if="session.isReview" style="color: yellow;"/>
        <font-awesome-icon icon="people-arrows" v-else/>
        随机分配{{ selectedRoles }}个角色
      </div>
      <div v-if="session.isReview"
        class="button"
        @click="assignRoles(false)"
        :class="{
          disabled: selectedRoles > nonTravelers || !selectedRoles
        }"
      >
        <font-awesome-icon icon="people-arrows" />
        关闭复盘并随机分配
      </div>
      <div class="button" @click="selectRandomRoles">
        <font-awesome-icon icon="random" />
        随机角色
      </div>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import gameJSON from "./../../game";
import Token from "./../Token";
import { mapGetters, mapMutations, mapState } from "vuex";

const randomElement = arr => arr[Math.floor(Math.random() * arr.length)];

export default {
  components: {
    Token,
    Modal
  },
  data: function() {
    return {
      roleSelection: {},
      game: gameJSON,
      allowMultiple: false,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    };
  },
  computed: {
    selectedRoles: function() {
      return Object.values(this.roleSelection)
        .map(roles => roles.reduce((a, { selected }) => a + selected, 0))
        .reduce((a, b) => a + b, 0);
    },
    hasSelectedSetupRoles: function() {
      return Object.values(this.roleSelection).some(roles =>
        roles.some(role => role.selected && role.setup)
      );
    },
    tokenWidth() {
      const percentage = 0.06
      const width = percentage * this.windowWidth;
      return width >= 80 ? "width: 6vw" : "width: 80px";
    },
    ...mapState(["roles", "modals", "session"]),
    ...mapState("players", ["players"]),
    ...mapGetters({ nonTravelers: "players/nonTravelers" })
  },
  methods: {
    handleResize(){
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    selectRandomRoles() {
      this.roleSelection = {};
      this.roles.forEach(role => {
        if (!this.roleSelection[role.team]) {
          this.$set(this.roleSelection, role.team, []);
        }
        this.roleSelection[role.team].push(role);
        this.$set(role, "selected", 0);
      });
      const teamSelected = ["townsfolk", "outsider", "minion", "demon"];
      const teamDeselected = [];
      Object.keys(this.roleSelection).forEach(team => {
        if (!teamSelected.includes(team)) teamDeselected.push(team);
      });
      teamDeselected.forEach(team => {
        delete this.roleSelection[team];
      })
      const playerCount = Math.max(5, this.nonTravelers);
      const composition = this.game[playerCount - 5];
      Object.keys(composition).forEach(team => {
        for (let x = 0; x < composition[team]; x++) {
          if (this.roleSelection[team]) {
            const available = this.roleSelection[team].filter(
              role => !role.selected
            );
            if (available.length) {
              randomElement(available).selected = 1;
            }
          }
        }
      });
    },
    assignRoles(allowReview = true) {
      if (this.selectedRoles <= this.nonTravelers && this.selectedRoles) {
        // generate list of selected roles and randomize it
        if (!allowReview && this.session.isReview) {
          this.$store.commit("session/setIsReview", false);
        }
        const roles = Object.values(this.roleSelection)
          .map(roles =>
            roles
              // duplicate roles selected more than once and filter unselected
              .reduce((a, r) => [...a, ...Array(r.selected).fill(r)], [])
          )
          // flatten into a single array
          .reduce((a, b) => [...a, ...b], [])
          .map(a => [Math.random(), a])
          .sort((a, b) => a[0] - b[0])
          .map(a => a[1]);
        this.players.forEach(player => {
          if (player.role.team !== "traveler" && roles.length) {
            const value = roles.pop();
            this.$store.commit("players/update", {
              player,
              property: "role",
              value
            });
          }
        });
        this.$store.commit("toggleModal", "roles");
      }
    },
    ...mapMutations(["toggleModal"])
  },
  mounted: function() {
    if (!Object.keys(this.roleSelection).length) {
      this.selectRandomRoles();
    }
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  watch: {
    roles() {
      this.selectRandomRoles();
    }
  }
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

ul.tokens {
  padding-left: 5%;
  li {
    border-radius: 50%;
    // width: 120px;
    margin: 5px;
    opacity: 0.5;
    transition: all 250ms;
    &.selected {
      opacity: 1;
      .buttons {
        display: flex;
      }
      .fa-exclamation-triangle {
        display: block;
      }
    }
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
    .fa-exclamation-triangle {
      position: absolute;
      color: red;
      filter: drop-shadow(0 0 3px black) drop-shadow(0 0 3px black);
      top: 5px;
      right: -5px;
      font-size: 150%;
      display: none;
    }
    .buttons {
      display: none;
      position: absolute;
      top: 95%;
      text-align: center;
      width: 100%;
      z-index: 30;
      font-weight: bold;
      filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
      span {
        flex-grow: 1;
      }
      svg {
        opacity: 0.25;
        cursor: pointer;
        &:hover {
          opacity: 1;
          color: red;
        }
      }
    }
  }
  .count {
    opacity: 1;
    position: absolute;
    left: 0;
    font-weight: bold;
    font-size: 75%;
    width: 5%;
    display: flex;
    align-items: center;
    justify-content: center;
    &:after {
      content: " ";
      display: block;
      padding-top: 100%;
    }
    &.townsfolk {
      color: $townsfolk;
    }
    &.outsider {
      color: $outsider;
    }
    &.minion {
      color: $minion;
    }
    &.demon {
      color: $demon;
    }
  }
}

.roles .modal {
  .multiple {
    display: block;
    text-align: center;
    cursor: pointer;
    &.checked,
    &:hover {
      color: red;
    }
    &.checked {
      margin-top: 10px;
    }
    svg {
      margin-right: 5px;
    }
    input {
      display: none;
    }
  }

  .warningSetup {
    color: red;
    position: absolute;
    bottom: 20px;
    right: 20px;
    z-index: 10;
    svg {
      font-size: 150%;
      vertical-align: middle;
    }
    span {
      display: none;
      text-align: center;
      position: absolute;
      right: -20px;
      bottom: 30px;
      width: 420px;
      background: rgba(0, 0, 0, 0.75);
      padding: 5px;
      border-radius: 10px;
      border: 2px solid black;
    }
    &:hover span {
      display: block;
    }
  }
  
  .warningReview {
    color: yellow;
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 10;
    svg {
      font-size: 150%;
      vertical-align: middle;
    }
    span {
      display: none;
      text-align: center;
      position: absolute;
      left: -20px;
      bottom: 30px;
      width: 420px;
      background: rgba(0, 0, 0, 0.75);
      padding: 5px;
      border-radius: 10px;
      border: 2px solid black;
    }
    &:hover span {
      display: block;
    }
  }
}
</style>
