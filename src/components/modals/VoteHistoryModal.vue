<template>
  <Modal
    class="vote-history"
    v-if="modals.voteHistory && (voting.voteHistory || !session.isSpectator)"
    @close="modals.toggle('voteHistory')"
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
              voting.isVoteHistoryAllowed ? 'check-square' : 'square',
            ]"
          />
          玩家可查看
        </div>
        <div class="option" @click="clearVoteHistory">
          <font-awesome-icon icon="trash-alt" />
          清除<span
            v-if="!voting.voteSelected.every((selected) => selected === false)"
            >选中</span
          ><span v-else>全部</span>记录
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
                voting.voteSelected.length > 0 &&
                voting.voteSelected.every((selected) => selected === true)
                  ? 'check-square'
                  : 'square',
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
        <tr v-for="(vote, index) in voting.voteHistory" :key="index">
          <td>
            <font-awesome-icon
              :icon="[
                'fas',
                voting.voteSelected[index] ? 'check-square' : 'square',
              ]"
              @click="setVoteSelected(index)"
              class="checkbox"
            />
          </td>
          <td>
            {{ vote.timestamp.getHours().toString().padStart(2, "0") }}:{{
              vote.timestamp.getMinutes().toString().padStart(2, "0")
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
                vote.votes >= vote.majority ? 'check-square' : 'square',
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

<script setup lang="ts">
import Modal from "./Modal.vue";
import { useVotingStore } from "../../stores/voting";
import { useModalStore } from "../../stores/modals";
import { useSessionIdentityStore } from "../../stores/session-identity";
import { emitGameEvent } from "../../store/game-events";

const modals = useModalStore();
const session = useSessionIdentityStore();
const voting = useVotingStore();

function setVoteSelected(index: number) {
  if (index >= 0) {
    voting.setVoteSelected({
      index,
      value: !voting.voteSelected[index],
    });
    return;
  }
  const selectedAll = voting.voteSelected.every(
    (selected) => selected === true,
  );
  for (let voteIndex = 0; voteIndex < voting.voteSelected.length; voteIndex++) {
    voting.setVoteSelected({
      index: voteIndex,
      value: !selectedAll,
    });
  }
}

function clearVoteHistory() {
  const selected = voting.voteSelected
    .map((isSelected, index) => (isSelected ? index : -1))
    .filter((index) => index >= 0);
  voting.clearVoteHistory(selected);
  emitGameEvent("session/clearVoteHistory", selected);
}

function setRecordVoteHistory() {
  voting.setVoteHistoryAllowed(!voting.isVoteHistoryAllowed);
  emitGameEvent("session/setVoteHistoryAllowed", voting.isVoteHistoryAllowed);
}
</script>

<style lang="scss" scoped>
@use "../../vars.scss" as *;

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
