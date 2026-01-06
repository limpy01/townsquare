<template>
  <div id="controls">
    <span v-if="!!session.sessionId && session.isSpectator && (!!session.isHostAllowed || !!session.isJoinAllowed)">
      <font-awesome-icon icon="microphone" v-if="microphoneSetting === 'free' && listeningFrame"
      @click="stopListening(microphoneSetting)"
      />
      <font-awesome-icon icon="microphone-slash" v-if="microphoneSetting === 'free' && !listeningFrame"
      @click="startListening(microphoneSetting)"
      />
      <font-awesome-icon icon="keyboard" v-if="microphoneSetting === 'keyboard'" :style="keyboardIcon"/>
      
      <select v-show="!isHandHeld" id="microphone" v-model="microphoneSetting" @change="stopListening(microphoneSetting)">
        <option value="free">自由发言</option>
        <option value="keyboard">按f2发言</option>
      </select>
    </span>

    <span v-if="!!session.sessionId && (!session.isSpectator || !!session.isHostAllowed || !!session.isJoinAllowed)">
      <button v-if="!session.isSpectator && (!timing || session.timer <= 0)" @click="startTimer" class="timerButton">开始</button>
      <button v-if="!session.isSpectator && timing && session.timer > 0" @click="stopTimer" class="timerButton">停止</button>
      <span style="font-size: 20px;" @click="setTimer">
        <span>计时 </span>
        <span :style="lessThanOneMinute">{{ formattedTime }}</span>
      </span>
    </span>

    <span
      class="nomlog-summary"
      v-show="session.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="
        `${session.voteHistory.length} recent ${
          session.voteHistory.length == 1 ? 'nomination' : 'nominations'
        }`
      "
    >
      <font-awesome-icon icon="book-dead" />
      {{ session.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: session.isReconnecting
      }"
      v-if="!!session.sessionId && (!session.isSpectator || !!session.isHostAllowed || !!session.isJoinAllowed)"
      @click="leaveSession"
      :title="
        `${session.playerCount} other players in this session${
          session.ping ? ' (' + session.ping + 'ms latency)' : ''
        }`
      "
    >
      <!-- <font-awesome-icon icon="broadcast-tower" />
      {{ session.playerCount }} -->
    </span>
    <div class="menu" :class="{ open: grimoire.isMenuOpen }">
      <font-awesome-icon icon="cog" @click="toggleMenu" />
      <ul>
        <li class="tabs" :class="tab">
          <font-awesome-icon icon="book-open" @click="tab = 'grimoire'" />
          <font-awesome-icon icon="broadcast-tower" @click="tab = 'session'" />
          <font-awesome-icon
            icon="users"
            v-if="!session.isSpectator"
            @click="tab = 'players'"
          />
          <font-awesome-icon icon="theater-masks" @click="tab = 'characters'" />
          <font-awesome-icon icon="question" @click="tab = 'help'" />
        </li>

        <template v-if="tab === 'grimoire'">
          <!-- Grimoire -->
          <li class="headline">魔典</li>
          <div class="options">
            <li @click="toggleGrimoire" v-if="players.length">
              <template v-if="!grimoire.isPublic">隐藏</template>
              <template v-if="grimoire.isPublic">显示</template>
              <em>[G]</em>
            </li>
            <li @click="toggleNight" v-if="!session.isSpectator">
              <template v-if="!grimoire.isNight">切换至夜晚</template>
              <template v-if="grimoire.isNight">切换至白天</template>
              <em>[S]</em>
            </li>
            <li @click="toggleModal('groupChat')" v-if="!session.isSpectator">
              创建群聊（beta）
              <em>[D]</em>
            </li>
            <li @click="toggleIsReview" v-if="!session.isSpectator">
              复盘视角
              <em>
                <font-awesome-icon
                  :icon="[
                    'fas',
                    session.isReview ? 'check-square' : 'square'
                  ]"
                />
              </em>
            </li>
            <li @click="toggleNightOrder" v-if="players.length">
              夜间顺序
              <em>
                <font-awesome-icon
                  :icon="[
                    'fas',
                    grimoire.isNightOrder ? 'check-square' : 'square'
                  ]"
                />
              </em>
            </li>
            <li v-if="players.length">
              缩放
              <em>
                <font-awesome-icon
                  @click="setZoom(grimoire.zoom - 1)"
                  icon="search-minus"
                />
                {{ Math.round(100 + grimoire.zoom * 10) }}%
                <font-awesome-icon
                  @click="setZoom(grimoire.zoom + 1)"
                  icon="search-plus"
                />
              </em>
            </li>
            <li @click="setBackground">
              背景图
              <em><font-awesome-icon icon="image"/></em>
            </li>
            <li @click="$emit('trigger', ['uploadAvatar'])">
              上传头像
              <em><font-awesome-icon icon="user"/></em>
            </li>
            <li @click="changeName">
              设置昵称
              <em><font-awesome-icon icon="user-edit"/></em>
            </li>
            <li v-if="!edition.isOfficial" @click="imageOptIn">
              <small>允许自定义图标</small>
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    grimoire.isImageOptIn ? 'check-square' : 'square'
                  ]"
              /></em>
            </li>
            <!-- <li v-if="!edition.isOfficial" @click="toggleForwardEvilInfo">
              <small>提前邪恶互认和信息</small>
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    grimoire.isForwardEvilInfo ? 'check-square' : 'square'
                  ]"
              /></em>
            </li> -->
            <li @click="toggleStatic">
              关闭动画
              <em
                ><font-awesome-icon
                  :icon="['fas', grimoire.isStatic ? 'check-square' : 'square']"
              /></em>
            </li>
            <li v-if="!session.isSpectator" @click="useOldOrderAsk">
              使用原夜间顺序
            </li>
            <li v-if="!session.isSpectator" @click="useOldRoleAsk">
              使用原角色能力
            </li>
            <li v-if="!!session.sessionId & session.isSpectator">
              <div class="wrap">
                <div @click="startEditingThreshold">
                  <span>麦克风阈值</span>
                  <span v-if="!isEditingThreshold">（{{ audioThresholdNumber }}）</span>
                  <input v-else ref="audioInputNumber" type="number" v-model.number="audioThresholdNumber"
                  class="input"
                  @blur="stopEditingThreshold(false)"
                  @keyup.esc="stopEditingThreshold(false)"
                  @keyup.enter="stopEditingThreshold(true)"
                  />
                </div>
                <input
                  type="range"
                  v-model.number="audioThresholdSlider"
                  min="0"
                  max="400"
                  step="1"
                  @input="syncAudioThresholdNumber(false)"
                  @mouseup="syncAudioThresholdNumber(true)"
                />
              </div>
            </li>
            <li @click="toggleMuted">
              静音
              <em
                ><font-awesome-icon
                  :icon="['fas', grimoire.isMuted ? 'volume-mute' : 'volume-up']"
              /></em>
            </li>
            <li @click="clearLocalStorage">
              清空储存
              <em
                ><font-awesome-icon icon="trash-alt"/></em>
            </li>
          </div>
        </template>

        <template v-if="tab === 'session'">
          <!-- Session -->
          <li class="headline" v-if="session.sessionId">
            {{ session.isSpectator ? "玩家" : "说书人" }}
          </li>
          <li class="headline" v-else>
            联机
          </li>
          <div class="options">
            <template v-if="!session.sessionId">
              <li @click="hostSession">创建房间<em>[H]</em></li>
              <li @click="joinSession">加入房间<em>[J]</em></li>
            </template>
            <template v-else>
              <li v-if="session.ping">
                与{{ session.isSpectator ? "说书人" : "玩家" }}延迟
                <em>{{ session.ping }}ms</em>
              </li>
              <li @click="copySessionUrl">
                复制链接
                <em><font-awesome-icon icon="copy"/></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeAsk">
                发送角色
                <em><font-awesome-icon icon="theater-masks"/></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeTypeAsk">
                发送角色类型
              </li>
              <li v-if="!session.isSpectator" @click="distributeBluffsAsk">
                发送伪装身份
                <em><font-awesome-icon icon="hat-wizard"/></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeGrimoireAsk">
                发送魔典
                <em><font-awesome-icon icon="book"/></em>
              </li>
              <li
                v-if="session.voteHistory.length || !session.isSpectator"
                @click="toggleModal('voteHistory')"
              >
                投票记录<em>[V]</em>
              </li>
              <li @click="leaveSession">
                <span v-if="session.isSpectator">退出房间</span>
                <span v-if="!session.isSpectator">解散房间</span>
                <em>{{ session.sessionId }}</em>
              </li>
            </template>
          </div>
        </template>

        <template v-if="tab === 'players' && !session.isSpectator">
          <!-- Users -->
          <li class="headline">玩家</li>
          <div class="options">
            <li @click="addPlayer" v-if="players.length < 20">添加座位<!--<em>[A]</em>--></li>
            <li @click="randomizeSeatings" v-if="players.length > 2">
              随机座位
              <em><font-awesome-icon icon="dice"/></em>
            </li>
            <li @click="clearPlayers" v-if="players.length">
              移除全部
              <em><font-awesome-icon icon="trash-alt"/></em>
            </li> 
          </div>
        </template>

        <template v-if="tab === 'characters'">
          <!-- Characters -->
          <li class="headline">角色</li>
          <div class="options">
            <li v-if="!session.isSpectator" @click="toggleModal('edition')">
              选择剧本
              <em>[E]</em>
            </li>
            <li @click="selectEditionsAsk()">
              <small>
                选择全角色合集范围
              </small>
            </li>
            <li
              @click="toggleModal('roles')"
              v-if="!session.isSpectator && players.length > 4"
            >
              配置角色
              <em>[C]</em>
            </li>
            <li v-if="!session.isSpectator" @click="toggleModal('fabled')">
              添加传奇角色
              <em>[F]</em>
            </li>
            <li v-if="!session.isSpectator" @click="customiseBootlegger">
              <small>
                自定义私货商人
              </small>
            </li>
            <li @click="clearRoles" v-if="players.length">
              移除全部
              <em><font-awesome-icon icon="trash-alt"/></em>
            </li>
          </div>
        </template>

        <template v-if="tab === 'help'">
          <!-- Help -->
          <li class="headline">帮助</li>
          <div>
            <li @click="toggleModal('reference')">
              角色技能表
              <em>[R]</em>
            </li>
            <li @click="toggleModal('nightOrder')">
              夜间顺序表
              <em>[N]</em>
            </li>
            <li>
              <a href="https://botcgrimoire.top/manual" target="_blank">使用说明参考</a>
            </li>
            <li @click="toggleModal('version')">
              更新日志
            </li>
            <li @click="toggleModal('gameState')">
              游戏状态JSON
              <em><font-awesome-icon icon="file-code"/></em>
            </li>
            <!-- <li>
              <a href="https://discord.gg/Gd7ybwWbFk" target="_blank">
                Join Discord
              </a>
              <em>
                <a href="https://discord.gg/Gd7ybwWbFk" target="_blank">
                  <font-awesome-icon :icon="['fab', 'discord']" />
                </a>
              </em>
            </li> -->
            <li>
              <a href="https://github.com/limpy01/townsquare" target="_blank">
                源代码
              </a>
              <em>
                <a href="https://github.com/limpy01/townsquare" target="_blank">
                  <font-awesome-icon :icon="['fab', 'github']" />
                </a>
              </em>
            </li>
          </div>
        </template>
      </ul>
    </div>

    <div v-if="selectingOldOrder" class="dialog">
      <span>
        <b>请选择想要使用原版顺序的官方角色</b>
      </span>
      <br>
      <span>
        <label>麻脸巫婆</label>
        <input type="checkbox" v-model="pendingOldOrder.pithag" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>教授</label>
        <input type="checkbox" v-model="pendingOldOrder.professor" class="checkbox"/>
      </span>
      &emsp;
      <div>
        <button @click="selectOldOrder(true)">确定</button>
        <button @click="selectOldOrder(false)">取消</button>
      </div>
    </div>
    <div v-if="selectingOldRole" class="dialog">
      <span>
        <b>请选择想要使用原（旧）版能力的官方角色</b>
      </span>
      <br>
      <span>
        <label>气球驾驶员</label>
        <input type="checkbox" v-model="pendingOldRole.balloonist" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>杂技演员</label>
        <input type="checkbox" v-model="pendingOldRole.acrobat" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>小怪宝</label>
        <input type="checkbox" v-model="pendingOldRole.lilmonsta" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>炼金术士</label>
        <input type="checkbox" v-model="pendingOldRole.alchemist" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>半兽人</label>
        <input type="checkbox" v-model="pendingOldRole.lycanthrope" class="checkbox"/>
      </span>
      &emsp;
      <div>
        <button @click="selectOldRole(true)">确定</button>
        <button @click="selectOldRole(false)">取消</button>
      </div>
    </div>
    <div v-if="distributing" class="dialog">
      <span>
        <label>是否同时给恶魔（疯子）发送伪装身份？</label>
        <input type="checkbox" v-model="isSendingBluff" class="checkbox"/>
      </span>
      <div>
        <button @click="distributeRoles(true)">确定</button>
        <button @click="distributeRoles(false)">取消</button>
      </div>
    </div>
    <div v-if="distributingBluffs" class="dialog">
      <span>
        <label>发送伪装身份给：</label>
      </span>
      <div>
        <button @click="distributeBluffs('demon')">恶魔</button>
        <button @click="distributeBluffs('lunatic')">疯子</button>
        <button @click="distributeBluffs('snitch')">爪牙（告密者）</button>
        <button @click="distributeBluffs(role = null, seat = true)">输入座位号</button>
        <button @click="distributeBluffs()">取消</button>
      </div>
    </div>
    <div v-if="distributingGrimoire" class="dialog">
      <span>
        <label>发送魔典给：</label>
      </span>
      <div>
        <button @click="distributeGrimoire('widow')">寡妇</button>
        <button @click="distributeGrimoire('spy')">间谍</button>
        <button @click="distributeGrimoire(role = null, seat = true)">输入座位号</button>
        <button @click="distributeGrimoire()">取消</button>
      </div>
    </div>
    <div v-if="selectingEditions" class="dialog">
      <span>
        <b>请选择全角色合集的剧本范围（该功能仅对自己生效{{ !session.isSpectator ? "，请说书人公开通知玩家" : "" }}）</b>
      </span>
      <br>
      <span>
        <label>暗流涌动</label>
        <input type="checkbox" v-model="pendingEditions.tb" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>暗月初生</label>
        <input type="checkbox" v-model="pendingEditions.bmr" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>梦殒春宵</label>
        <input type="checkbox" v-model="pendingEditions.snv" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>实验性角色</label>
        <input type="checkbox" v-model="pendingEditions.exp" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>华灯初上</label>
        <input type="checkbox" v-model="pendingEditions.hdcs" class="checkbox"/>
      </span>
      &emsp;
      <span>
        <label>山雨欲来</label>
        <input type="checkbox" v-model="pendingEditions.syyl" class="checkbox"/>
      </span>
      &emsp;
      <div>
        <button @click="selectEditions(true)">确定</button>
        <button @click="selectEditions(false)">取消</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import { nextTick } from 'vue';

export default {
  computed: {
    ...mapState(["grimoire", "session", "edition", "channels", "selectedEditions"]),
    ...mapState("players", ["players"]),
    formattedTime() {
      const minutes = Math.floor(this.session.timer / 60);
      const seconds = Math.ceil(this.session.timer % 60);
      return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    },
    lessThanOneMinute() {
      return {
        color: this.session.timer < 60 ? 'red' : 'white'
      }
    },
    keyboardIcon() {
      return {
        color: this.listeningFrame ? 'red' : 'white'
      }
    },
    isHandHeld() {
      const deviceType = navigator.userAgent.toLocaleLowerCase();
      console.log(deviceType);
      if (/mobile|android|touch|webos|iphone|ipod/i.test(deviceType)) return true;
      return false;
    }
  },
  data() {
    return {
      tab: "grimoire",
      timing: false,
      distributing: false,
      distributingBluffs: false,
      distributingGrimoire: false,
      distributingTypes: false,
      isSendingBluff: true,
      selectingEditions: false,
      selectingOldOrder: false,
      selectingOldRole: false,
      pendingEditions: {
        tb: true,
        bmr: true,
        snv: true,
        exp: true,
        hdcs: true,
        syyl: true
      },
      pendingOldOrder: {
        pithag: false,
        professor: false
      },
      pendingOldRole: {
        balloonist: false,
        acrobat: false,
        lilmonsta: false,
        alchemist: false,
        lycanthrope: false
      },
      recognition: null,
      microphoneSetting: "free",
      // 语音检测
      audioContext: null,
      audioStream: null,
      analyser: null,
      source: null,
      listeningFrame: null, // also in session.js for global reference
      audioThresholdNumber: 150,
      audioThresholdSlider: 150,
      isEditingThreshold: false
    };
  },
  watch: {
    'grimoire.audioThreshold': {
      handler(val) {
        this.audioThresholdNumber = val;
        this.audioThresholdSlider = val;
      },
      immediate: true
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
    async setBackground() {
      const input = await this.showInputModal({
        inputType: "background",
        inputModal: "input",
        inputData: {
          name: ["输入自定义背景图URL"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;
      
      const background = input[0];
      this.$store.commit("setBackground", background);
    },
    async changeName() {
      const input = await this.showInputModal({
        inputType: "changeName",
        inputModal: "input",
        inputData: {
          name: ["输入玩家昵称"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const newName = input[0];
      this.$store.commit("session/setPlayerName", newName);
    },
    async hostSession() {
      if (!this.session.playerName) await this.changeName();
      if (!this.session.playerName) return;

      if (this.session.sessionId) return;
      if (this.session.rooms === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["网络连接不稳定，请稍等！"],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
      
      let sessionPlaceholder = Math.round(Math.random() * 10000);
      while (this.session.rooms.includes(sessionPlaceholder)) {
        sessionPlaceholder = Math.round(Math.random() * 10000);
      }
      const input = await this.showInputModal({
        inputType: "hostSession",
        inputModal: "input",
        inputData: {
          name: ["请输入房间号", "请输入玩家人数"],
          length: 2,
          placeholder: [String(sessionPlaceholder), "12"]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const sessionId = input[0];
      const numPlayers = Math.min(input[1], 20);
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory", []);
        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", sessionId);
        this.$store.commit("players/clear");
        for(let i=0; i < numPlayers; i++){
          this.addPlayer();
        }
        this.copySessionUrl();
      };
    },
    copySessionUrl() {
      const url = window.location.href.split("#")[0];
      const link = url + "#" + this.session.sessionId;
      navigator.clipboard.writeText(link);
    },
    distributeAsk() {
      this.distributingBluffs = false;
      this.distributingGrimoire = false;
      this.distributingTypes = false;
      this.distributing = !this.distributing;
    },
    distributeRoles(confirm) {
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
      this.distributing = false;
      if (!confirm) return;
      if (this.session.isSpectator) return;
      this.$store.commit("session/distributeRoles", true);
      setTimeout(
        (() => {
          this.$store.commit("session/distributeRoles", false);
        }).bind(this),
        2000
      );
      if (!this.isSendingBluff) return;
      this.$store.commit("session/distributeBluffs", {val: true, role: "demonAll"});
      setTimeout(
        (() => {
          this.$store.commit("session/distributeBluffs", {val:false});
        }).bind(this),
        2000
      );
    },
    async distributeTypeAsk() {
      this.distributing = false;
      this.distributingBluffs = false;
      this.distributingGrimoire = false;
      this.distributingTypes = !this.distributingTypes;

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要发送角色类型给玩家？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        this.distributeTypes();
      }
    },
    distributeTypes() {
      this.distributingTypes = false;
      if (this.session.isSpectator) return;
      this.$store.commit("session/distributeTypes", true);
      setTimeout(
        (() => {
          this.$store.commit("session/distributeTypes", false);
        }).bind(this),
        2000
      );
    },
    distributeBluffsAsk() {
      this.distributing = false;
      this.distributingGrimoire = false;
      this.distributingTypes = false;
      this.distributingBluffs = !this.distributingBluffs;
    },
    async distributeBluffs(role = null, seat = false) {
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
      if (!role && !seat) {
        this.distributingBluffs = false;
        return;
      }
      let seatNum;
      if (seat) {
        const input = await this.showInputModal({
          inputType: "seatNum",
          inputModal: "input",
          inputData: {
            name: ["请输入座位号"],
            length: 1,
            placeholder: [""]
          }
        }).catch(() => {
          return null;
        });
        if (input === null) return;
        seatNum = input[0];
      }
      
      var roleText = "";
      switch (role) {
        case "demon":
          roleText = "恶魔";
          break;
        case "lunatic":
          roleText = "疯子";
          break;
        case "snitch":
          roleText = "爪牙";
          break;
      }
      const text = roleText ? roleText : (seatNum + "号位");
      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要发送伪装身份给" + text + "？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;
      if (confirm === true) {
        if (this.session.isSpectator) return;
        this.$store.commit("session/distributeBluffs", {val: true, role, seatNum});
        setTimeout(
          (() => {
            this.$store.commit("session/distributeBluffs", {val:false});
          }).bind(this),
          2000
        );
        this.distributingBluffs = false;
      }
    },
    distributeGrimoireAsk(){
      this.distributing = false;
      this.distributingBluffs = false;
      this.distributingTypes = false;
      this.distributingGrimoire = !this.distributingGrimoire
    },
    async distributeGrimoire(role = null, seat = false){
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
      if (!role && !seat) {
        this.distributingGrimoire = false;
        return;
      }
      
      let seatNum;
      if (seat) {
        const input = await this.showInputModal({
          inputType: "seatNum",
          inputModal: "input",
          inputData: {
            name: ["请输入座位号"],
            length: 1,
            placeholder: [""]
          }
        }).catch(() => {
          return null;
        });
        if (input === null) return;
        seatNum = input[0];
      }

      let roleText;
      switch (role) {
        case "widow":
          roleText = "寡妇";
          break;
        case "spy":
          roleText = "间谍";
          break;
      }
      const text = roleText ? roleText : (seatNum + "号位");

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要发送魔典给" + text + "？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        if (this.session.isSpectator) return;
        this.$store.commit("session/distributeGrimoire", {val: true, role, seatNum});
        setTimeout(
          (() => {
            this.$store.commit("session/distributeGrimoire", {val:false});
          }).bind(this),
          2000
        );
        this.distributingGrimoire = false;
      }
    },
    selectEditionsAsk() {
      this.selectingEditions = !this.selectingEditions;
      if (this.selectingEditions) this.pendingEditions = {...this.selectedEditions};
    },
    selectEditions(update = false) {
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })

      this.selectingEditions = false;
      if (!update) return;
      this.$store.commit("setSelectedEditions", this.pendingEditions);
    },
    async imageOptIn() {
      const popup = this.grimoire.isImageOptIn ? false : await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要启用自定义游戏图标吗？木马剧本拥有者可能以此来追踪你的IP地址。"]
        }
      }).catch(() => {
        return null;
      });
      if (popup === null) return;

      if (this.grimoire.isImageOptIn || popup === true) {
        this.toggleImageOptIn();
      }
    },
    async joinSession() {
      if (this.session.sessionId) return this.leaveSession();
      if (!this.session.playerName) await this.changeName();
      if (!this.session.playerName) return;

      if (this.session.rooms === null) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["网络连接不稳定，请稍等！"],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
      const input = await this.showInputModal({
        inputType: "joinSession",
        inputModal: "input",
        inputData: {
          name: ["输入房间号/链接"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const sessionId = Number(input[0].split("#").pop()).toString();
      if (sessionId) {
        this.$store.commit("session/clearVoteHistory", []);
        this.$store.commit("session/setSpectator", true);
        this.$store.commit("toggleGrimoire", false);
        this.$store.commit("session/setSessionId", sessionId);
      }
    },
    async leaveSession() {
      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要离开/解散该房间吗？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        // vacate seat upon leaving the room
        this.$store.commit("session/claimSeat", -1);

        this.$store.commit("session/setSpectator", false);
        this.$store.commit("session/setSessionId", "");
        this.$store.commit("session/setIsHostAllowed", null);
        this.$store.commit("session/setIsJoinAllowed", null);
        
        // clear seats and return to intro
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        this.$store.commit("players/clear", true);

        // clear customBootlegger
        if (this.session.bootlegger) {
          this.$store.commit("session/setBootlegger", "");
        }

        // reset allowed votes
        if (this.session.playerVotes > 1) {
          this.$store.commit("session/setPlayerVotes", 1);
        }

        // reset secret vote
        if (this.session.isSecretVote) {
          this.$store.commit("session/setSecretVote", false);
        }

        // reset review
        if (this.session.isReview) {
          this.$store.commit("session/setIsReview", false);
        }

        // close chat box
        this.$store.commit("session/setChatOpen", false);

        // exit group chat
        this.session.groupChats.forEach(group => {
          this.$store.commit("session/removeGroupChat", {chatId: group.id});
        });

        // clear messages
        while (this.session.messageQueue.length > 0) {
          this.$store.commit("session/deleteMessageQueue", 0);
        }

        // reset wraith
        this.$store.commit("session/setIsRole", {
          role: 'wraith',
          property: 'active',
          value: false
        });
        this.$store.commit("session/setIsRole", {
          role: 'wraith',
          property: 'using',
          value: false,
          st: true
        });
      }
    },
    addPlayer(stImage = null, stName = null) {
      if (this.session.isSpectator) return;
      if (this.players.length >= 20) return;
      
      // setting name to a default value, combining with the seat number
      this.$store.commit("players/add", {name: "", stImage, stName});
    },
    async randomizeSeatings() {
      if (this.session.isSpectator) return;

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要随机分配座位吗？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        this.$store.dispatch("players/randomize");
      }
    },
    async clearPlayers() {
      if (this.session.isSpectator) return;

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要移除所有座位吗？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        // abort vote if in progress
        if (this.session.nomination) {
          this.$store.commit("session/nomination");
        }
        if (this.session.sessionId) {
          this.$store.commit("players/clear");
        } else {
          this.$store.commit("players/clear", true)
        }
      }
    },
    async clearRoles() {
      if (this.session.isSpectator && this.session.isReview) return;

      const confirm = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定要移除所有玩家角色吗？"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (confirm === true) {
        this.$store.dispatch("players/clearRoles");
      }
    },
    async customiseBootlegger() {
      if (this.session.isSpectator) return;

      const input = await this.showInputModal({
        inputType: "bootlegger",
        inputModal: "input",
        inputData: {
          name: ["输入私货商人内容"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const content = input[0].trim();
      this.$store.commit("session/setBootlegger", content);
    },
    toggleNight() {
      this.$store.commit("toggleNight");
      if (this.grimoire.isNight) {
        this.$store.commit("session/setMarkedPlayer", -1);
      }
    },
    async toggleIsReview() {
      if (this.isSpectator) return;

      const confirm = this.session.isReview ? false : await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["是否开启复盘视角？（所有玩家将看到角色）"]
        }
      }).catch(() => {
        return null;
      });
      if (confirm === null) return;

      if (!this.session.isReview && confirm === true) {
        this.$store.commit("session/setIsReview", !this.session.isReview);
        this.$store.dispatch("players/realivePlayers");
      } else if (this.session.isReview) {
        this.$store.commit("session/setIsReview", false);
      }
    },
    useOldOrderAsk() {
      this.selectingOldRole = false;
      this.selectingOldOrder = !this.selectingOldOrder;
      if (this.selectingOldOrder) this.pendingOldOrder = {...this.session.isUseOldOrder};
    },
    selectOldOrder(update = false) {
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
      this.selectingOldOrder = false;
      if (!update) return;
      this.$store.commit("session/setUseOldOrder", this.pendingOldOrder);
      this.$store.commit("setEdition", this.edition);
    },
    useOldRoleAsk() {
      this.selectingOldOrder = false;
      this.selectingOldRole = !this.selectingOldRole;
      if (this.selectingOldRole) this.pendingOldRole = {...this.session.isUseOldRole};
    },
    selectOldRole(update = false) {
      this.$nextTick(() => {
        document.getElementById('app').focus();
      })
      this.selectingOldRole = false;
      if (!update) return;
      this.$store.commit("session/setUseOldRole", this.pendingOldRole);
      if (localStorage.getItem("roles")) this.$store.commit("setCustomRoles", JSON.parse(localStorage.roles));
      this.$store.commit("setEdition", this.edition);
    },
    async setTimer() {
      if (this.session.isSpectator || !this.session.sessionId) return;

      const input = await this.showInputModal({
        inputType: "timer",
        inputModal: "input",
        inputData: {
          name: ["输入时间（分）"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const time = input[0];
      const timeNum = Number(time);
      if (!timeNum) return;
      if (timeNum <= 0) return;
      this.timing = true;
      this.stopTimer();
      this.startTimer(timeNum * 60);
    },
    startTimer(time = null) {
      if (this.session.isSpectator) return;
      if (typeof time != 'number') time = this.session.timer;
      this.$store.commit("session/startTimer", time);
      this.timing = true;
    },
    stopTimer() {
      if (this.session.isSpectator) return;
      this.$store.commit("session/stopTimer");
      this.timing = false;
    },
    async initAudio() {
      // Initialize audioContext and audioStream if not already done
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioStream = stream;

        this.source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.source.connect(this.analyser);
      }
    },
    runAudioDetection() {
      // Web Audio API 语音检测
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      // const SILENCE_THRESHOLD = 120; // Adjust as needed
      const HUMAN_VOICE_RANGE = { min: 250, max: 400 }; // Adjust based on actual FFT resolution

      // Check for microphone activity
      const detectSpeechActivity = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        // Analyze frequency bins corresponding to the human voice range
        const sampleRate = this.audioContext.sampleRate;
        const binCount = this.analyser.frequencyBinCount;
        const binSize = sampleRate / (2 * binCount);
        let totalVolume = 0;
        for (let i = 0; i < binCount; i++) {
          const frequency = i * binSize;
          if (frequency >= HUMAN_VOICE_RANGE.min && frequency <= HUMAN_VOICE_RANGE.max) {
            totalVolume += dataArray[i];
          }
        }

        if (totalVolume > this.grimoire.audioThreshold && !this.session.isTalking) {
          if (!this.session.isTalking) {
            this.$store.commit("session/setTalking", {seatNum:this.session.claimedSeat, isTalking: true});
          }
        } else if (totalVolume <= this.grimoire.audioThreshold && this.session.isTalking) {
          if (this.session.isTalking) {
            this.$store.commit("session/setTalking", {seatNum:this.session.claimedSeat, isTalking: false});
          }
        }

        this.listeningFrame = requestAnimationFrame(detectSpeechActivity);
        this.$store.commit("session/setListeningFrame", this.listeningFrame);
      }

      detectSpeechActivity();
    },
    startListening(mode) {
      if (this.listeningFrame) return;
      if (mode != this.microphoneSetting) return;
      
      this.initAudio().then(() => {
        this.runAudioDetection();
      })
    },
    stopListening(mode) {
      if (!this.listeningFrame) return;
      if (mode != this.microphoneSetting) return;

      if (this.listeningFrame) {
        cancelAnimationFrame(this.listeningFrame);
        this.listeningFrame = null;
        this.$store.commit("session/setListeningFrame", null);
      }
      this.$store.commit("session/setTalking", {seatNum:this.session.claimedSeat, isTalking: false});
    },
    startEditingThreshold() {
      this.isEditingThreshold = true;
      nextTick(() => {
        if (this.$refs.audioInputNumber) {
          this.$refs.audioInputNumber.focus();
          this.$refs.audioInputNumber.select();
        }
      })
    },
    stopEditingThreshold(save) {
      this.isEditingThreshold = false;
      if (!save || !this.audioThresholdNumber) {
        this.audioThresholdNumber = this.audioThresholdSlider;
        return;
      }

      this.audioThresholdNumber = Math.max(0, Math.min(400, Math.round(this.audioThresholdNumber)));
      this.syncAudioThresholdSlider(save);
    },
    syncAudioThresholdSlider(save) {
      this.audioThresholdSlider = this.audioThresholdNumber;
      if (save) this.$store.commit("setAudioThreshold", this.audioThresholdNumber);
    },
    syncAudioThresholdNumber(save) {
      this.audioThresholdNumber = this.audioThresholdSlider;
      if (save) this.$store.commit("setAudioThreshold", this.audioThresholdSlider);
    },
    async clearLocalStorage() {
      const clear = await this.showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: ["确定清空所有内容吗？（将清除昵称头像和聊天记录等）"]
        }
      }).catch(() => {
        return null;
      });
      if (clear === null) return;

      if (!clear) return;
      localStorage.clear();
      await this.showInputModal({
        inputType: "alert",
        inputModal: "text",
        inputData: {
          name: ["清理完成，请刷新网页！"],
        }
      }).catch(() => {
        return null;
      });
      return;
    },
    ...mapMutations([
      "toggleGrimoire",
      "toggleMenu",
      "toggleImageOptIn",
      "toggleForwardEvilInfo",
      "toggleMuted",
      "toggleNightOrder",
      "toggleStatic",
      "setZoom",
      "toggleModal"
    ])
  }
};
</script>

<style scoped lang="scss">
@import "../vars.scss";

// success animation
@keyframes greenToWhite {
  from {
    color: green;
  }
  to {
    color: white;
  }
}

/* width */
::-webkit-scrollbar {
  width: 5px;
}
/* Handle */
::-webkit-scrollbar-thumb {
  background: rgb(54, 54, 54); 
  border-radius: 10px;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: rgb(97, 97, 97); 
}

// Controls
#controls {
  position: absolute;
  right: 3px;
  top: 3px;
  text-align: right;
  padding-right: 50px;
  z-index: 75;

  svg {
    filter: drop-shadow(0 0 5px rgba(0, 0, 0, 1));
    &.success {
      animation: greenToWhite 1s normal forwards;
      animation-iteration-count: 1;
    }
  }

  > span {
    display: inline-block;
    cursor: pointer;
    z-index: 5;
    margin-top: 7px;
    margin-left: 10px;
  }

  span.nomlog-summary {
    color: $townsfolk;
  }

  span.session {
    color: $demon;
    &.spectator {
      color: $townsfolk;
    }
    &.reconnecting {
      animation: blink 1s infinite;
    }
  }
}

@keyframes blink {
  50% {
    opacity: 0.5;
    color: gray;
  }
}

.menu {
  width: 220px;
  transform-origin: 200px 22px;
  transition: transform 500ms cubic-bezier(0.68, -0.55, 0.27, 1.55);
  transform: rotate(-90deg);
  position: absolute;
  right: 0;
  top: 0;

  &.open {
    transform: rotate(0deg);
  }

  > svg {
    cursor: pointer;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    width: 40px;
    height: 50px;
    margin-bottom: -8px;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    padding: 5px 5px 15px;
  }

  a {
    color: white;
    text-decoration: none;
    &:hover {
      color: red;
    }
  }

  ul {
    display: flex;
    list-style-type: none;
    padding: 0;
    margin: 0;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
    border-radius: 10px 0 10px 10px;

    .options {
      overflow-y: auto;
      max-height: calc(85vh - 100px); /* Adjust this value as needed */
    }

    li {
      padding: 2px 5px;
      color: white;
      text-align: left;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 30px;

      .wrap{
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }

      .input{
        width: 45px; // Shrink the width significantly
        right: 0px;
        padding: 2px 3px; // Reduce padding
        border: 1px solid rgba(255, 255, 255, 0.3);
        // background: rgba(0, 0, 0, 0.5);
        background: white;
        color: black;
        text-align: right; // Ensure the number input content is right-aligned
        font-size: inherit; // Make it match the surrounding text font size
        line-height: inherit; // Make it match the surrounding text line height

        // Hide arrows for different browsers
        appearance: textfield; // Firefox
        &::-webkit-outer-spin-button,
        &::-webkit-inner-spin-button {
            -webkit-appearance: none; // Chrome, Safari, Edge
            margin: 0; // Remove margin that might be added by default
        }
      }

      &.tabs {
        display: flex;
        padding: 0;
        svg {
          flex-grow: 1;
          flex-shrink: 0;
          height: 35px;
          border-bottom: 3px solid black;
          border-right: 3px solid black;
          padding: 5px 0;
          cursor: pointer;
          transition: color 250ms;
          &:hover {
            color: red;
          }
          &:last-child {
            border-right: 0;
          }
        }
        &.grimoire .fa-book-open,
        &.players .fa-users,
        &.characters .fa-theater-masks,
        &.session .fa-broadcast-tower,
        &.help .fa-question {
          background: linear-gradient(
            to bottom,
            $townsfolk 0%,
            rgba(0, 0, 0, 0.5) 100%
          );
        }
      }

      &:not(.headline):not(.tabs):hover {
        cursor: pointer;
        color: red;
      }

      em {
        flex-grow: 0;
        font-style: normal;
        margin-left: 10px;
        font-size: 80%;
      }
    }

    .headline {
      font-family: PiratesBay, sans-serif;
      letter-spacing: 1px;
      padding: 0 10px;
      text-align: center;
      justify-content: center;
      background: linear-gradient(
        to right,
        $townsfolk 0%,
        rgba(0, 0, 0, 0.5) 20%,
        rgba(0, 0, 0, 0.5) 80%,
        $demon 100%
      );
    }
  }
}

.timerButton {
  // opacity: 0.5;
  background-color: rgba(0,0,0,0.5);
  border-radius: 5px 5px 5px 5px;
  right: 8px;
  border: white;
  color: white;
  cursor: pointer;
}

.dialog {
  background-color: #000;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  text-align: center;
}

.dialog .checkbox {
  width: 20px;
  height: 20px;
}
</style>
