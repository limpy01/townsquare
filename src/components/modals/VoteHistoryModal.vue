<template>
  <Modal
    class="vote-history"
    v-if="modals.voteHistory && (session.voteHistory || !session.isSpectator)"
    @close="toggleModal('voteHistory')"
  >
    <font-awesome-icon
      @click="clearVoteHistory"
      icon="trash-alt"
      class="clear"
      title="Clear vote history"
      v-if="session.isSpectator"
    />

    <h3>投票记录</h3>

    <template v-if="!session.isSpectator">
      <div class="options">
        <div class="option" @click="setRecordVoteHistory">
          <font-awesome-icon
            :icon="[
              'fas',
              session.isVoteHistoryAllowed ? 'check-square' : 'square'
            ]"
          />
          玩家可查看
        </div>
        <div class="option" @click="clearVoteHistory">
          <font-awesome-icon icon="trash-alt" />
          清除<span v-if="!session.voteSelected.every(selected => selected === false)">选中</span><span v-else>全部</span>记录
        </div>
      </div>
    </template>
    <table>
      <thead>
        <tr>
          <td>
            <font-awesome-icon
              :icon="[
                'fas',
                session.voteSelected.length > 0 && session.voteSelected.every(selected => selected === true) ? 'check-square' : 'square'
              ]"
              @click="setVoteSelected(-1)"
              class="checkbox"
            />
          </td>
          <td>时间</td>
          <td>提名者</td>
          <td>被提名者</td>
          <td>类型</td>
          <td>模式</td>
          <td>票数</td>
          <td>通过票数</td>
          <td>
            <font-awesome-icon icon="user-friends" />
            投票人
          </td>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(vote, index) in session.voteHistory" :key="index">
          <td>
            <font-awesome-icon
              :icon="[
                'fas',
                session.voteSelected[index] ? 'check-square' : 'square'
              ]"
              @click="setVoteSelected(index)"
              class="checkbox"
            />
          </td>
          <td>
            {{
              vote.timestamp
                .getHours()
                .toString()
                .padStart(2, "0")
            }}:{{
              vote.timestamp
                .getMinutes()
                .toString()
                .padStart(2, "0")
            }}
          </td>
          <td>{{ vote.nominator }}</td>
          <td>{{ vote.nominee }}</td>
          <td>{{ vote.type }}</td>
          <td>{{ vote.mode }}</td>
          <td>
            {{ vote.votes }}
            <font-awesome-icon icon="hand-paper" />
          </td>
          <td>
            {{ vote.majority }}
            <font-awesome-icon
              :icon="[
                'fas',
                vote.votes >= vote.majority ? 'check-square' : 'square'
              ]"
            />
          </td>
          <td>
            {{ vote.votedPlayers.join(", ") }}
          </td>
        </tr>
      </tbody>
    </table>
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
    ...mapState(["session", "modals"])
  },
  methods: {
    setVoteSelected(index) {
      if (index >= 0) {
        this.$store.commit("session/setVoteSelected", {index, value: !this.session.voteSelected[index]});
      } else {
        const selectedAll = this.session.voteSelected.every(selected => selected === true);
        for (let i=0; i<this.session.voteSelected.length; i++) {
          this.$store.commit("session/setVoteSelected", {index: i, value: !selectedAll});
        }
      }
    },
    clearVoteHistory() {
      const someSelected = !this.session.voteSelected.every(selected => selected === false);
      if (someSelected) {
        const selected = [];
        for (let i=0; i<this.session.voteSelected.length; i++) {
          if (this.session.voteSelected[i]) selected.push(i);
        }
        this.$store.commit("session/clearVoteHistory", selected);
      }
      else {
        this.$store.commit("session/clearVoteHistory", []);
      }
      
    },
    setRecordVoteHistory() {
      this.$store.commit(
        "session/setVoteHistoryAllowed",
        !this.session.isVoteHistoryAllowed
      );
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

.clear {
  position: absolute;
  left: 20px;
  top: 15px;
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.checkbox {
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.options {
  display: flex;
  justify-content: center;
  align-items: center;
  justify-content: center;
  align-content: center;
}

.option {
  color: white;
  text-decoration: none;
  margin: 0 15px;
  &:hover {
    color: red;
    cursor: pointer;
  }
}

h3 {
  margin: 0 40px 0 10px;
  svg {
    vertical-align: middle;
  }
}

table {
  border-spacing: 10px 0;
  margin-left: auto;
  margin-right: auto;
}

thead td {
  font-weight: bold;
  border-bottom: 1px solid white;
  text-align: center;
  padding: 0 3px;
}

tbody {
  td:nth-child(3) {
    color: $townsfolk;
  }
  td:nth-child(4) {
    color: $demon;
  }
  td:nth-child(6) {
    text-align: center;
  }
  td:nth-child(7) {
    text-align: center;
  }
}
</style>
