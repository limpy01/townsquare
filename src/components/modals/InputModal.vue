<template>
  <Modal v-if="modals.input" @close="close" :name="'input'" :type="session.inputModal">
    <span v-if="!!warningMessage" class="warning">{{ warningMessage }}</span>
    <div v-if="session.inputModal === 'input'">
      <form class="input-box" @submit.prevent="confirmInput">
        <div v-for="n in session.inputData.length" :key="n">
          <label>{{ session.inputData.name[n-1] }}</label>
          <input
            type="text"
            :id="'input-'+n"
            :ref="'input-'+n"
            autocomplete="off"
            @focus="typing"
            @blur="notTyping"
            v-model="input[n-1]"
            >
        </div>
        <div class="input-actions">
          <button type="submit" class="confirm">确认</button>
          <button type="button" @click="close">取消</button>
      </div>
      </form>
    </div>
    <div v-else-if="session.inputModal === 'confirm'">
      <form class="input-box confirm-box" @submit.prevent="confirmYes" tabindex="-1">
        <label>{{ session.inputData.name[0] }}</label>
        <div class="input-actions">
          <button type="submit" class="confirm" ref="confirmYes">确认</button>
          <button type="button" @click="close" class="cancel">取消</button>
        </div>
      </form>
    </div>
    <div v-else-if="session.inputModal === 'text'">
      <form class="input-box text-box" @submit.prevent="close" tabindex="-1">
        <label>{{ session.inputData.name[0] }}</label>
        <div class="input-actions">
          <button type="submit" class="confirm" ref="confirmClose">关闭</button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: { Modal },
  computed: {
    ...mapState(["modals", "grimoire", "session"]),
    ...mapState("players", ["players"]),
  },
  data(){
    return {
      input: [""],
      confirm: false,
      warningMessage: "",
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }
  },
  created(){
    if (this.session && this.session.inputData && this.session.inputData.placeholder) {
      this.input = [...this.session.inputData.placeholder];
    }
  },
  watch: {
    'session.inputData.placeholder': {
      handler(placeholder) {
        if (Array.isArray(placeholder) && placeholder.length > 0) {
          this.input = [...placeholder];
        }
      },
      immediate: true
    },
    'modals.input': function(isOpen) {
      if (isOpen) {
        if (this.session.inputModal === "input") {
          this.$nextTick(() => {
            this.$refs["input-1"][0].select();
          })
        } else if (this.session.inputModal === "confirm") {
          this.$nextTick(() => {
            this.$refs.confirmYes.focus();
          })
        } else if (this.session.inputModal === "text") {
          this.$nextTick(() => {
            this.$refs.confirmClose.focus();
          })
        }
      }
    }
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    typing() {
      this.$store.commit("session/setTyping", true);
    },
    notTyping() {
      this.$store.commit("session/setTyping", false)
    },
    confirmInput() {
      const allowEmpty = ["bootlegger"];
      if (this.session.inputModal === "input" && !allowEmpty.includes(this.session.inputType) && (this.input.length <= 0 || this.input.some(item => item === ""))) {
        this.close();
        return;
      }
      switch (this.session.inputType) {
        case "background":
          break;
        case "changeName": {
            if (this.input[0].trim() === "" || this.input[0].trim() === "空座位" || this.input[0].trim() === "说书人") {
            this.warningMessage = "昵称非法！";
            this.$nextTick(() => {
              this.$refs["input-1"][0].select();
            })
            return;
            }
          }
          break;
        case "hostSession": {
            const sessionId = this.input[0];
            const numPlayers = this.input[1];
            if (!Number(sessionId) || Number(sessionId) < 0 || Number(sessionId) >= 10000) {
              this.warningMessage = "请输入大于0小于10000的数字！";
              return;
            }
            if (this.session.rooms.includes(Number(sessionId).toString())) {
              this.warningMessage = `房间"${sessionId}"已经存在说书人！`;
              return;
            }
            if (!Number(numPlayers) || numPlayers <= 0) {
              this.warningMessage = "请输入正确人数！";
              return;
            }
          }
          break;
        case "joinSession": {
            let sessionId = this.input[0];
            if (sessionId.match(/^https?:\/\//i)) {
              sessionId = sessionId.split("#").pop();
            }
            if (!this.session.rooms.includes(sessionId)) {
              this.warningMessage = `房间"${sessionId}"不存在！`;
              return;
            }
          }
          break;
        case "seatNum": {
            let seatNum = Number(this.input[0]);
            if (!seatNum || Math.floor(seatNum) != seatNum || seatNum > this.players.length) {
              this.warningMessage = "无效的座位号！";
              return;
            }
          }
          break;
        case "bootlegger":
          break;
        case "timer":
          break;
        case "pronouns":
          break;
        case "changeNameSt":
          if (this.input[0].trim() === "" || this.input[0].trim() === "空座位" || this.input[0].trim() === "说书人") {
            this.warningMessage = "昵称非法！";
            this.$nextTick(() => {
              this.$refs["input-1"][0].select();
            })
            return;
          }
          break;
        case "reminder":
          break;
        case "json":
          break;
      }

      if (this.session.inputResolver) {
          this.session.inputResolver(this.input);
      }

      this.close()
    },
    confirmYes() {
      this.session.inputResolver(true);
      this.close();
    },
    close() {
      if (this.session.inputResolver && this.session.inputModal === "text") {
          this.session.inputResolver(true);
      } else if (this.session.inputRejecter) {
        this.session.inputRejecter(null);
      }
      this.$store.commit("session/setTyping", false);
      this.$store.commit("session/clearInputHandlers");
      this.input = [""];
      this.warningMessage = "";

      this.toggleModal('input');

      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
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

.input-box {
  display: flex;
  flex-direction: column;
  gap: 15px;
  width: 100%;
}

.input-actions {  
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.input-box input[type="text"] {
  width: 100%;
  padding: 10px 15px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 20px;
  height: 35px;
  box-sizing: border-box;
}

.input-box input:focus {
  outline: none;
}

.input-box button {
  padding: 8px 15px; 
  border: none;
  border-radius: 20px; 
  cursor: pointer;
  font-weight: bold;
}

.input-box button.confirm {
 background-color: #0a65dd;
 color: white;
 transition: background-color 0.3s;
}

.input-box button.confirm:focus {
  outline: none;
}

.input-box button.confirm:hover {
  background-color: darken(#0a65dd, 10%);
}

.input-box button[type="button"] {
  background-color: #e84b20;
  color: white;
  transition: background-color 0.3s;
}

.input-box button[type="button"]:hover {
  background-color: darken(#e84b20, 10%);
}

.warning {
  color: red;
}
</style>
