<template>
  <Modal v-if="modals.groupChat" @close="close">
    <div class="group-chat-panel">
      <h3>创建群聊</h3>
      <table>
        <thead>
          <tr>
            <td>剩1人时保留</td>
            <td>群聊</td>
            <td>玩家</td>
            <td></td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in chat.groups" :key="group.id" class="chat-row">
            <td>
              <input
                type="checkbox"
                class="checkbox"
                :checked="group.keep"
                @change="toggleGroupKeep(group.id)"
              />
            </td>
            <td>
              <span>{{ group.name }}</span>
            </td>
            <td>
              <div
                v-for="player in group.players"
                :key="player.id"
                class="player-tag"
              >
                <span class="player-name">{{
                  "（" + (players.indexOf(player) + 1) + "号）" + player.name
                }}</span>
                <em
                  @click="removeGroupChatMember(group.id, player)"
                  class="remove-cross"
                >
                  <font-awesome-icon icon="times" />
                </em>
              </div>
            </td>

            <td>
              <button class="confirm-btn" @click="requestGroupChat(group.id)">
                添加
              </button>
              &nbsp;
              <button class="remove-btn" @click="removeGroupChat(group.id)">
                移除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      <div class="available-list">
        <div v-if="adding">
          <button class="confirm-btn" @click="addGroupChat()">确定</button>
          &nbsp;
          <button class="remove-btn" @click="cancelGroupChat()">取消</button>
        </div>
        <button
          class="confirm-btn"
          v-else-if="chat.groups.length < players.length"
          @click="requestGroupChat()"
        >
          创建
        </button>
        <br />
        <div v-if="adding">
          <div v-for="(player, index) in selectablePlayers" :key="player.id">
            <input
              type="checkbox"
              class="checkbox"
              v-model="selectedPlayersStatus[index]"
            />
            <span class="player-name">{{
              "[" + (players.indexOf(player) + 1) + "号]" + player.name
            }}</span>
          </div>
          <span v-if="!!warningMessage" class="warning">{{
            warningMessage
          }}</span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import Modal from "./Modal.vue";
import { useChatStore } from "../../stores/chat";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { emitLegacyMutation } from "../../store/legacy-effects";

const chat = useChatStore();
const modals = useModalStore();
const playerState = usePlayersStore();
const players = computed(() => playerState.players);
const selectablePlayers = computed(() =>
  players.value.filter((player) => !!player.id && !player.chatGroup),
);
const adding = ref(false);
const addingGroup = ref<string | null>(null);
const selectedPlayersStatus = ref<boolean[]>([]);
const warningMessage = ref("");
const windowWidth = ref(window.innerWidth);

function requestGroupChat(chatId: string | null = null) {
  adding.value = true;
  addingGroup.value = chatId;
}

function cancelGroupChat() {
  adding.value = false;
  addingGroup.value = null;
  selectedPlayersStatus.value = [];
  warningMessage.value = "";
}

function addGroupChat() {
  let chatId = addingGroup.value;
  const newGroupMembers = selectablePlayers.value.filter(
    (_player, index) => selectedPlayersStatus.value[index],
  );
  if (!chatId && newGroupMembers.length < 2) {
    warningMessage.value = "请选择至少两名玩家！";
    return;
  }
  if (!chatId) {
    chatId = Math.random().toString(36).substr(2);
    while (chat.groups.some((group) => group.id === chatId)) {
      chatId = Math.random().toString(36).substr(2);
    }
  }
  const payload = { chatId, players: newGroupMembers };
  chat.addGroup(payload).forEach((update) => {
    playerState.update(update);
    emitLegacyMutation("players/update", update);
  });
  emitLegacyMutation("session/addGroupChat", payload);
  cancelGroupChat();
}

function removeGroupChat(chatId: string) {
  const group = chat.groups.find((item) => item.id === chatId);
  if (!group) return;
  const payload = {
    chatId,
    playerIds: group.players.map((player) => player.id),
  };
  chat.removeGroup(chatId).forEach((update) => {
    playerState.update(update);
    emitLegacyMutation("players/update", update);
  });
  emitLegacyMutation("session/removeGroupChat", payload);
}

function removeGroupChatMember(chatId: string, player: any) {
  const group = chat.groups.find((item) => item.id === chatId);
  if (!group) return;
  if (
    group.players.length <= 1 ||
    (group.players.length === 2 && !group.keep)
  ) {
    const payload = {
      chatId,
      playerIds: group.players.map((groupPlayer) => groupPlayer.id),
    };
    chat.removeGroup(chatId).forEach((update) => {
      playerState.update(update);
      emitLegacyMutation("players/update", update);
    });
    emitLegacyMutation("session/removeGroupChat", payload);
    return;
  }
  const payload = { chatId, player };
  const update = chat.removeGroupMember(chatId, player);
  if (update) {
    playerState.update(update);
    emitLegacyMutation("players/update", update);
  }
  emitLegacyMutation("session/removeGroupChatMember", payload);
}

function toggleGroupKeep(chatId: string) {
  chat.toggleGroupKeep(chatId);
  emitLegacyMutation("session/toggleGroupKeep", chatId);
}

function close() {
  cancelGroupChat();
  modals.toggle("groupChat");
}

function handleResize() {
  windowWidth.value = window.innerWidth;
}

onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
</script>

<style scoped lang="scss">
@use "sass:color";
@use "../../vars.scss" as *;
$confirm-color: #0a65dd;
$remove-color: #e84b20;

.group-chat-panel {
  width: 100%;
  min-width: min(80vw, 1200px);
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-row {
  margin-bottom: 25px;
  padding: 15px;
  border-radius: 6px;

  button {
    padding: 8px 15px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
  }

  .confirm-btn {
    background: $confirm-color;
    color: white;
    transition: background-color 0.3s;

    &:hover {
      background-color: color.adjust($confirm-color, $lightness: -10%);
    }
  }

  .remove-btn {
    background: $remove-color;
    color: white;
    transition: background-color 0.3s;

    &:hover {
      background-color: color.adjust($remove-color, $lightness: -10%);
    }
  }

  .remove-cross {
    // Cross icon next to the name
    background: none;
    border: none;
    color: $remove-color;
    font-size: 1.2em;
    font-weight: bold;
    line-height: 1;
    padding: 0;
    margin-left: 5px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: color.adjust($remove-color, $lightness: -10%);
    }
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.chat-header {
  margin-bottom: 15px;
  .chat-id {
    font-weight: bold;
    font-size: 0.9em;
  }
}

.player-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.player-tag {
  // Player tag styling
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background-color: color.adjust($confirm-color, $lightness: 40%);
  color: $confirm-color;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 500;
  white-space: nowrap; // Prevents the name from wrapping

  .player-name {
    margin-right: 5px;
  }

  .remove-btn {
    // Cross icon next to the name
    background: none;
    border: none;
    color: $remove-color;
    font-size: 1.2em;
    font-weight: bold;
    line-height: 1;
    padding: 0;
    margin-left: 5px;
    cursor: pointer;
    transition: color 0.2s;

    &:hover {
      color: color.adjust($remove-color, $lightness: -10%);
    }
  }
}

.available-list {
  button {
    padding: 8px 15px;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
  }

  .confirm-btn {
    background: $confirm-color;
    color: white;
    transition: background-color 0.3s;

    &:hover {
      background-color: color.adjust($confirm-color, $lightness: -10%);
    }
  }

  .remove-btn {
    background: $remove-color;
    color: white;
    transition: background-color 0.3s;

    &:hover {
      background-color: color.adjust($remove-color, $lightness: -10%);
    }
  }
}

input[type="checkbox"].checkbox {
  --checkbox-size: 20px;
  width: var(--checkbox-size);
  height: var(--checkbox-size);
}

h3 {
  margin: 0 40px 0 10px;
  svg {
    vertical-align: middle;
  }
}

table {
  height: 100%;
  width: 100%;
  table-layout: fixed;
  border-spacing: 0 0;
  margin-left: auto;
  margin-right: auto;
  overflow-x: hidden;
  overflow-y: auto;

  thead th:nth-child(1),
  thead td:nth-child(1) {
    width: 8%;
    text-align: center;
  }
  thead th:nth-child(2),
  thead td:nth-child(2) {
    width: 8%;
    text-align: center;
  }
  thead th:nth-child(3),
  thead td:nth-child(3) {
    width: 70%;
    text-align: center;
    word-wrap: break-word;
  }

  tbody th:nth-child(1),
  tbody td:nth-child(1) {
    width: 8%;
    text-align: center;
  }
  tbody th:nth-child(2),
  tbody td:nth-child(2) {
    width: 8%;
    text-align: center;
  }
  tbody th:nth-child(3),
  tbody td:nth-child(3) {
    width: 70%;
    text-align: left;
    word-wrap: break-word;
  }
}

.warning {
  color: red;
}
</style>
