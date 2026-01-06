<template>
  <Modal
    class="game-state"
    v-if="modals.gameState"
    @close="toggleModal('gameState')"
  >
    <h3>当前游戏状态</h3>
    <textarea
      :value="gamestate"
      @input.stop="input = $event.target.value"
      @click="$event.target.select()"
      @keyup.stop=""
    ></textarea>
    <div class="button-group">
      <div class="button townsfolk" @click="copy">
        <font-awesome-icon icon="copy" /> 复制JSON
      </div>
      <div class="button demon" @click="loadGrimoire">
        <font-awesome-icon icon="cog" /> 加载魔典
      </div>
      <div class="button" @click="loadState" v-if="!session.isSpectator">
        <font-awesome-icon icon="cog" /> 加载状态（不推荐）
      </div>
    </div>
  </Modal>
</template>

<script>
import Modal from "./Modal";
import { mapMutations, mapState } from "vuex";

export default {
  components: {
    Modal
  },
  computed: {
    gamestate: function() {
      return JSON.stringify({
        bluffs: this.players.bluffs.map(({ id }) => id),
        edition: this.edition.isOfficial
          ? { id: this.edition.id }
          : this.edition,
        roles: this.edition.isOfficial
          ? ""
          : this.$store.getters.customRolesStripped,
        fabled: this.players.fabled.map(fabled =>
          fabled.isCustom ? fabled : { id: fabled.id }
        ),
        players: this.players.players.map(player => ({
          ...player,
          role: player.role.id || {}
        }))
      });
    },
    ...mapState(["modals", "players", "edition", "roles", "session"])
  },
  data() {
    return {
      input: ""
    };
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
    copy: function() {
      navigator.clipboard.writeText(this.input || this.gamestate);
    },
    async loadGrimoire() {
      try {
        const data = JSON.parse(this.input || this.gamestate);
        const { bluffs, edition, roles, fabled, players } = data;
        if (roles && !this.session.isSpectator) {
          this.$store.commit("setCustomRoles", roles);
        }
        if (edition && !this.session.isSpectator) {
          this.$store.commit("setEdition", edition);
          // 状态
          const states = [];
          if (edition.state && edition.state.length > 0){
            edition.state.forEach(state => {
              states.push({[state.stateName] : state.stateDescription});
            })
          } else if (edition.status && edition.status.length > 0){
            edition.status.forEach(state => {
              states.push({[state.name] : state.skill});
            })
          }
          // 类型名称
          const names = {
            townsfolk: edition.townsfolksName ? edition.townsfolksName : "镇民",
            outsider: edition.outsidersName ? edition.outsidersName : "外来者",
            minion: edition.minionsName ? edition.minionsName : "爪牙",
            demon: edition.demonsName ? edition.demonsName : "恶魔"
          }
          this.$store.commit("setTeamsNames", names);
        }
        if (bluffs.length) {
          bluffs.forEach((role, index) => {
            this.$store.commit("players/setBluff", {
              index,
              role: this.$store.state.roles.get(role) || {}
            });
          });
        }
        if (fabled && !this.session.isSpectator) {
          const fabledNoSt = fabled.filter(role => role.id != "storyteller");
          this.$store.commit("players/setFabled", {
            fabled: fabledNoSt.map(
              f =>
                this.$store.state.fabled.get(f) ||
                this.$store.state.fabled.get(f.id) ||
                f
            )
          });
        }
        if (players && players.length > 0) {
          const mappedPlayers = this.players.players;
          for (let i=0; i<players.length; i++) {
            if (i >= mappedPlayers.length) {
              if (!this.session.isSpectator) {
                this.$store.commit("players/add", "")
              } else {
                break;
              }
            }
            const player = players[i];
            const role = this.roles.get(player.role) ? this.roles.get(player.role) : {};
            const mappedPlayer = mappedPlayers[i];
            if (role.team != 'traveler' && mappedPlayer.role.team != 'traveler' || !this.session.isSpectator) {
              this.$store.commit("players/update", {
                player: mappedPlayer,
                property: "role",
                value: role
              });
              this.$store.commit("players/update", {
                player: mappedPlayer,
                property: "reminders",
                value: player.reminders
              });
            }
          }
        }
        this.toggleModal("gameState");
      } catch (e) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["无法加载JSON：" + e],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
    },
    async loadState() {
      if (this.session.isSpectator) return;
      const prompt = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要加载所有状态吗？（包括玩家、头像等）"]
        }
      }).catch(() => {
        return null;
      });
      if (prompt === null) return;

      if (!prompt) return;
      try {
        const data = JSON.parse(this.input || this.gamestate);
        const { bluffs, edition, roles, fabled, players } = data;
        if (roles) {
          this.$store.commit("setCustomRoles", roles);
        }
        if (edition) {
          this.$store.commit("setEdition", edition);
        }
        if (bluffs.length) {
          bluffs.forEach((role, index) => {
            this.$store.commit("players/setBluff", {
              index,
              role: this.$store.state.roles.get(role) || {}
            });
          });
        }
        if (fabled) {
          const fabledNoSt = fabled.filter(role => role.id != "storyteller");
          this.$store.commit("players/setFabled", {
            fabled: fabledNoSt.map(
              f =>
                this.$store.state.fabled.get(f) ||
                this.$store.state.fabled.get(f.id) ||
                f
            )
          });
        }
        if (players) {
          this.$store.commit(
            "players/set",
            players.map(player => ({
              ...player,
              role:
                this.$store.state.roles.get(player.role) ||
                this.$store.getters.rolesJSONbyId.get(player.role) ||
                {}
            }))
          );
        }
        // this.toggleModal("gameState");
      } catch (e) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["无法加载JSON：" + e],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

h3 {
  margin: 0 40px;
}

textarea {
  background: transparent;
  color: white;
  white-space: pre-wrap;
  word-break: break-all;
  border: 1px solid rgba(255, 255, 255, 0.5);
  width: 60vw;
  height: 30vh;
  max-width: 100%;
  margin: 5px 0;
}
</style>
