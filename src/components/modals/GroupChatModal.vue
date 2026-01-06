<template>
  <Modal v-if="modals.groupChat" @close="close">
    <div  class="group-chat-panel">
      <h3>创建群聊</h3>
      <table>
        <thead>
          <tr>
            <td>剩1人时保留</td>
            <td>群聊</td>
            <td>玩家</td>
            <td> </td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in session.groupChats" :key="group.id" class="chat-row">
            <td>
              <input type="checkbox" class="checkbox" :checked="group.keep" @change="toggleGroupKeep(group.id)"/>
            </td>
            <td>
              <span>{{ group.name }}</span>
            </td>
            <td>
              <div v-for="player in group.players" :key="player.id" class="player-tag">
                <span class="player-name">{{ "（" + (players.indexOf(player)+1) + "号）" + player.name }}</span>
                <em @click="removeGroupChatMember(group.id, player)" class="remove-cross">
                  <font-awesome-icon icon="times"/>
                </em>
              </div>
            </td>
            
            <td>
              <button class="confirm-btn" @click="requestGroupChat(group.id)">添加</button>
              &nbsp;
              <button class="remove-btn" @click="removeGroupChat(group.id)">移除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <br/>
      <div class="available-list">
        <div v-if="adding">
          <button class="confirm-btn" @click="addGroupChat()">确定</button>
          &nbsp;
          <button class="remove-btn" @click="cancelGroupChat()">取消</button>
        </div>
        <button class="confirm-btn" v-else-if="session.groupChats.length < players.length" @click="requestGroupChat()">创建</button>
        <br/>
        <div v-if="adding">
          <div v-for="(player, index) in selectablePlayers" :key="player.id">
            <input type="checkbox" class="checkbox" v-model="selectedPlayersStatus[index]"/>
            <span class="player-name">{{ "[" + (players.indexOf(player)+1) + "号]" + player.name }}</span>
          </div>
          <span v-if="!!warningMessage" class="warning">{{ warningMessage }}</span>
        </div>
      </div>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: { Modal },
  computed: {
    selectablePlayers() {
      return this.players.filter(player => !!player.id && !player.chatGroup);
    },
    ...mapState(["modals", "grimoire", "session"]),
    ...mapState("players", ["players"]),
  },
  data(){
    return {
      adding: false,
      addingGroup: null,
      selectedPlayersStatus: [],
      warningMessage: "",
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    requestGroupChat(chatId = null) {
      this.adding = true;
      this.addingGroup = chatId;
    },
    cancelGroupChat() {
      this.adding = false;
      this.addingGroup = null;
      this.selectedPlayersStatus = [];
      this.warningMessage = "";
    },
    addGroupChat() {
      let chatId = this.addingGroup;
      const newGroupMembers = [];
      this.selectablePlayers.forEach((player, index) => {
        if (this.selectedPlayersStatus[index]) newGroupMembers.push(player);
      });
      // 创建新群聊时必须有至少两名玩家
      if (!chatId && newGroupMembers.length < 2) {
        this.warningMessage = "请选择至少两名玩家！";
        return;
      }
      if (!chatId) {
        chatId = Math.random().toString(36).substr(2);
        while (this.session.groupChats.some(group => group.id === chatId)) {
          chatId = Math.random().toString(36).substr(2);
        }
      }
      
      this.$store.commit("session/addGroupChat", {chatId, players: newGroupMembers});
      
      this.cancelGroupChat();
    },
    removeGroupChat(chatId) {
      const index = this.session.groupChats.findIndex(group => group.id === chatId);
      if (index === -1) return;

      const group = this.session.groupChats[index];
      const playerIds = group.players.map(player => player.id);
      this.$store.commit("session/removeGroupChat", {chatId, playerIds});
    },
    removeGroupChatMember(chatId, player) {
      const index = this.session.groupChats.findIndex(group => group.id === chatId);
      if (index === -1) return;

      const group = this.session.groupChats[index];
      if (group.players.length <= 1 || (group.players.length == 2 && !group.keep))  {
        const playerIds = group.players.map(player => player.id);
        this.$store.commit("session/removeGroupChat", {chatId, playerIds});
      } else {
        this.$store.commit("session/removeGroupChatMember", {chatId, player});
      }
    },
    toggleGroupKeep(chatId) {
      this.$store.commit("session/toggleGroupKeep", chatId);
    },
    close() {
      this.cancelGroupChat();
      this.$store.commit("toggleModal", "groupChat");
    },
    handleResize(){
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
    },
    ...mapMutations(["toggleModal"])
  }
};
</script>

<style scoped lang="scss">
@import "../../vars.scss";
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
  
  button{
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
      background-color: darken($confirm-color, 10%);
    }
  }

  .remove-btn {
    background: $remove-color;
    color: white;
    transition: background-color 0.3s;
    
    &:hover {
      background-color: darken($remove-color, 10%);
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
      color: darken($remove-color, 10%);
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
  background-color: lighten($confirm-color, 40%);
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
      color: darken($remove-color, 10%);
    }
  }
}

.available-list {
  
  button{
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
      background-color: darken($confirm-color, 10%);
    }
  }

  .remove-btn {
    background: $remove-color;
    color: white;
    transition: background-color 0.3s;
    
    &:hover {
      background-color: darken($remove-color, 10%);
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
