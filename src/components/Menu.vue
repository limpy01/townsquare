<template>
  <div id="controls">
    <span
      v-if="
        !!session.sessionId &&
        session.isSpectator &&
        (!!connection.isHostAllowed || !!connection.isJoinAllowed)
      "
    >
      <font-awesome-icon
        icon="microphone"
        v-if="microphoneSetting === 'free' && audio.listeningFrame"
        @click="stopListening(microphoneSetting)"
      />
      <font-awesome-icon
        icon="microphone-slash"
        v-if="microphoneSetting === 'free' && !audio.listeningFrame"
        @click="startListening(microphoneSetting)"
      />
      <font-awesome-icon
        icon="keyboard"
        v-if="microphoneSetting === 'keyboard'"
        :style="keyboardIcon"
      />

      <select
        v-show="!isHandHeld"
        id="microphone"
        v-model="microphoneSetting"
        @change="stopListening(microphoneSetting)"
      >
        <option value="free">自由发言</option>
        <option value="keyboard">按f2发言</option>
      </select>
    </span>

    <span
      v-if="
        !!session.sessionId &&
        (!session.isSpectator ||
          !!connection.isHostAllowed ||
          !!connection.isJoinAllowed)
      "
    >
      <button
        v-if="!session.isSpectator && (!timing || timer.seconds <= 0)"
        @click="() => startTimer()"
        class="timerButton"
      >
        开始
      </button>
      <button
        v-if="!session.isSpectator && timing && timer.seconds > 0"
        @click="stopTimer"
        class="timerButton"
      >
        停止
      </button>
      <span style="font-size: 20px" @click="setTimer">
        <span>计时 </span>
        <span :style="lessThanOneMinute">{{ formattedTime }}</span>
      </span>
    </span>

    <span
      class="nomlog-summary"
      v-show="voting.voteHistory.length && session.sessionId"
      @click="toggleModal('voteHistory')"
      :title="`${voting.voteHistory.length} recent ${
        voting.voteHistory.length == 1 ? 'nomination' : 'nominations'
      }`"
    >
      <font-awesome-icon icon="book-dead" />
      {{ voting.voteHistory.length }}
    </span>
    <span
      class="session"
      :class="{
        spectator: session.isSpectator,
        reconnecting: connection.isReconnecting,
      }"
      v-if="
        !!session.sessionId &&
        (!session.isSpectator ||
          !!connection.isHostAllowed ||
          !!connection.isJoinAllowed)
      "
      @click="leaveSession"
      :title="`${connection.playerCount} other players in this session${
        connection.ping ? ' (' + connection.ping + 'ms latency)' : ''
      }`"
    >
      <!-- <font-awesome-icon icon="broadcast-tower" />
      {{ connection.playerCount }} -->
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
                  :icon="['fas', review.isReview ? 'check-square' : 'square']"
                />
              </em>
            </li>
            <li @click="toggleNightOrder" v-if="players.length">
              夜间顺序
              <em>
                <font-awesome-icon
                  :icon="[
                    'fas',
                    grimoire.isNightOrder ? 'check-square' : 'square',
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
              <em><font-awesome-icon icon="image" /></em>
            </li>
            <li @click="emit('trigger', ['uploadAvatar'])">
              上传头像
              <em><font-awesome-icon icon="user" /></em>
            </li>
            <li @click="changeName">
              设置昵称
              <em><font-awesome-icon icon="user-edit" /></em>
            </li>
            <li v-if="!edition.isOfficial" @click="imageOptIn">
              <small>允许自定义图标</small>
              <em
                ><font-awesome-icon
                  :icon="[
                    'fas',
                    grimoire.isImageOptIn ? 'check-square' : 'square',
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
                  :icon="[
                    'fas',
                    grimoire.isStatic ? 'check-square' : 'square',
                  ]"
              /></em>
            </li>
            <li v-if="!session.isSpectator" @click="useOldOrderAsk">
              使用原夜间顺序
            </li>
            <li v-if="!session.isSpectator" @click="useOldRoleAsk">
              使用原角色能力
            </li>
            <li v-if="!!session.sessionId && session.isSpectator">
              <div class="wrap">
                <div @click="startEditingThreshold">
                  <span>麦克风阈值</span>
                  <span v-if="!isEditingThreshold"
                    >（{{ audioThresholdNumber }}）</span
                  >
                  <input
                    v-else
                    ref="audioInputNumber"
                    type="number"
                    v-model.number="audioThresholdNumber"
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
                  :icon="[
                    'fas',
                    grimoire.isMuted ? 'volume-mute' : 'volume-up',
                  ]"
              /></em>
            </li>
            <li @click="clearLocalStorage">
              清空储存
              <em><font-awesome-icon icon="trash-alt" /></em>
            </li>
          </div>
        </template>

        <template v-if="tab === 'session'">
          <!-- Session -->
          <li class="headline" v-if="session.sessionId">
            {{ session.isSpectator ? "玩家" : "说书人" }}
          </li>
          <li class="headline" v-else>联机</li>
          <div class="options">
            <template v-if="!session.sessionId">
              <li @click="hostSession">创建房间<em>[H]</em></li>
              <li @click="joinSession">加入房间<em>[J]</em></li>
            </template>
            <template v-else>
              <li v-if="connection.ping">
                与{{ session.isSpectator ? "说书人" : "玩家" }}延迟
                <em>{{ connection.ping }}ms</em>
              </li>
              <li @click="copySessionUrl">
                复制链接
                <em><font-awesome-icon icon="copy" /></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeAsk">
                发送角色
                <em><font-awesome-icon icon="theater-masks" /></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeTypeAsk">
                发送角色类型
              </li>
              <li v-if="!session.isSpectator" @click="distributeBluffsAsk">
                发送伪装身份
                <em><font-awesome-icon icon="hat-wizard" /></em>
              </li>
              <li v-if="!session.isSpectator" @click="distributeGrimoireAsk">
                发送魔典
                <em><font-awesome-icon icon="book" /></em>
              </li>
              <li
                v-if="voting.voteHistory.length || !session.isSpectator"
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
            <li @click="() => addPlayer()" v-if="players.length < 20">
              添加座位<!--<em>[A]</em>-->
            </li>
            <li @click="randomizeSeatings" v-if="players.length > 2">
              随机座位
              <em><font-awesome-icon icon="dice" /></em>
            </li>
            <li @click="clearPlayers" v-if="players.length">
              移除全部
              <em><font-awesome-icon icon="trash-alt" /></em>
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
              <small> 选择全角色合集范围 </small>
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
              <small> 自定义私货商人 </small>
            </li>
            <li @click="clearRoles" v-if="players.length">
              移除全部
              <em><font-awesome-icon icon="trash-alt" /></em>
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
              <a href="https://botcgrimoire.top/manual" target="_blank"
                >使用说明参考</a
              >
            </li>
            <li @click="toggleModal('version')">更新日志</li>
            <li @click="toggleModal('legal')">法律与署名</li>
            <li @click="toggleModal('gameState')">
              游戏状态JSON
              <em><font-awesome-icon icon="file-code" /></em>
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
      <br />
      <span>
        <label>麻脸巫婆</label>
        <input
          type="checkbox"
          v-model="pendingOldOrder.pithag"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>教授</label>
        <input
          type="checkbox"
          v-model="pendingOldOrder.professor"
          class="checkbox"
        />
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
      <br />
      <span>
        <label>气球驾驶员</label>
        <input
          type="checkbox"
          v-model="pendingOldRole.balloonist"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>杂技演员</label>
        <input
          type="checkbox"
          v-model="pendingOldRole.acrobat"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>小怪宝</label>
        <input
          type="checkbox"
          v-model="pendingOldRole.lilmonsta"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>炼金术士</label>
        <input
          type="checkbox"
          v-model="pendingOldRole.alchemist"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>半兽人</label>
        <input
          type="checkbox"
          v-model="pendingOldRole.lycanthrope"
          class="checkbox"
        />
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
        <input type="checkbox" v-model="isSendingBluff" class="checkbox" />
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
        <button @click="distributeBluffs(null, true)">输入座位号</button>
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
        <button @click="distributeGrimoire(null, true)">输入座位号</button>
        <button @click="distributeGrimoire()">取消</button>
      </div>
    </div>
    <div v-if="selectingEditions" class="dialog">
      <span>
        <b
          >请选择全角色合集的剧本范围（该功能仅对自己生效{{
            !session.isSpectator ? "，请说书人公开通知玩家" : ""
          }}）</b
        >
      </span>
      <br />
      <span>
        <label>暗流涌动</label>
        <input type="checkbox" v-model="pendingEditions.tb" class="checkbox" />
      </span>
      &emsp;
      <span>
        <label>暗月初生</label>
        <input type="checkbox" v-model="pendingEditions.bmr" class="checkbox" />
      </span>
      &emsp;
      <span>
        <label>梦殒春宵</label>
        <input type="checkbox" v-model="pendingEditions.snv" class="checkbox" />
      </span>
      &emsp;
      <span>
        <label>实验性角色</label>
        <input type="checkbox" v-model="pendingEditions.exp" class="checkbox" />
      </span>
      &emsp;
      <span>
        <label>华灯初上</label>
        <input
          type="checkbox"
          v-model="pendingEditions.hdcs"
          class="checkbox"
        />
      </span>
      &emsp;
      <span>
        <label>山雨欲来</label>
        <input
          type="checkbox"
          v-model="pendingEditions.syyl"
          class="checkbox"
        />
      </span>
      &emsp;
      <div>
        <button @click="selectEditions(true)">确定</button>
        <button @click="selectEditions(false)">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useLobbyStore } from "../stores/lobby";
import { showInputModal } from "../services/input-modal";
import { useInteractionStore } from "../stores/interaction";
import { useSessionConnectionStore } from "../stores/session-connection";
import { useAudioStore } from "../stores/audio";
import { useTimerStore } from "../stores/timer";
import { useReviewStore } from "../stores/review";
import { useLegacyOptionsStore } from "../stores/legacy-options";
import { useVotingStore } from "../stores/voting";
import { useSessionSettingsStore } from "../stores/session-settings";
import { useProfileStore } from "../stores/profile";
import { useMessageOutboxStore } from "../stores/message-outbox";
import { useChatStore } from "../stores/chat";
import { useDistributionStore } from "../stores/distribution";
import { useModalStore, type ModalName } from "../stores/modals";
import { usePlayersStore } from "../stores/players";
import { useGrimoireStore } from "../stores/grimoire";
import { useRoleActivityStore } from "../stores/role-activity";
import { useScenarioStore } from "../stores/scenario";
import { useSessionIdentityStore } from "../stores/session-identity";
import { emitGameEvent } from "../store/game-events";
import { clearTownsquareStorage, readStoredArray } from "../store/storage";

const emit = defineEmits<{
  trigger: [command: ["uploadAvatar"]];
}>();
const grimoire = useGrimoireStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const playersState = usePlayersStore();
const lobby = useLobbyStore();
const connection = useSessionConnectionStore();
const audio = useAudioStore();
const timer = useTimerStore();
const review = useReviewStore();
const legacyOptions = useLegacyOptionsStore();
const voting = useVotingStore();
const settings = useSessionSettingsStore();
const profile = useProfileStore();
const outbox = useMessageOutboxStore();
const chat = useChatStore();
const distribution = useDistributionStore();
const modals = useModalStore();
const roleActivity = useRoleActivityStore();
const interaction = useInteractionStore();
const audioInputNumber = ref<HTMLInputElement | null>(null);
const microphoneSetting = ref("free");
const audioThresholdNumber = ref(150);
const audioThresholdSlider = ref(150);
const isEditingThreshold = ref(false);
const audioContext = ref<AudioContext | null>(null);
const audioStream = ref<MediaStream | null>(null);
const analyser = ref<AnalyserNode | null>(null);
const audioSource = ref<MediaStreamAudioSourceNode | null>(null);
const selectingEditions = ref(false);
const pendingEditions = ref({
  tb: true,
  bmr: true,
  snv: true,
  exp: true,
  hdcs: true,
  syyl: true,
});
const selectingOldOrder = ref(false);
const selectingOldRole = ref(false);
const pendingOldOrder = ref({ pithag: false, professor: false });
const pendingOldRole = ref({
  balloonist: false,
  acrobat: false,
  lilmonsta: false,
  alchemist: false,
  lycanthrope: false,
});
const timing = ref(false);
const distributing = ref(false);
const distributingBluffs = ref(false);
const distributingGrimoire = ref(false);
const distributingTypes = ref(false);
const isSendingBluff = ref(true);
const players = computed(() => playersState.players);
const edition = computed(() => scenario.edition);
const selectedEditions = computed(() => scenario.selectedEditions);
const tab = ref("grimoire");
const formattedTime = computed(() => {
  const minutes = Math.floor(timer.seconds / 60);
  const seconds = Math.ceil(timer.seconds % 60);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
});
const lessThanOneMinute = computed(() => ({
  color: timer.seconds < 60 ? "red" : "white",
}));
const keyboardIcon = computed(() => ({
  color: audio.listeningFrame ? "red" : "white",
}));
const isHandHeld = computed(() => {
  const deviceType = navigator.userAgent.toLocaleLowerCase();
  console.log(deviceType);
  return /mobile|android|touch|webos|iphone|ipod/i.test(deviceType);
});
const publish = (type: string, payload?: unknown) =>
  emitGameEvent(type, payload);
const toggleGrimoire = () => {
  grimoire.toggle("isPublic");
  publish("toggleGrimoire");
};
const setGrimoirePublic = (isPublic: boolean) => {
  grimoire.toggle("isPublic", isPublic);
  publish("toggleGrimoire", isPublic);
};
const toggleMenu = () => grimoire.toggle("isMenuOpen");
const toggleImageOptIn = () => {
  grimoire.toggle("isImageOptIn");
  publish("toggleImageOptIn");
};
const toggleForwardEvilInfo = () => grimoire.toggle("isForwardEvilInfo");
const toggleMuted = () => {
  grimoire.toggle("isMuted");
  publish("toggleMuted");
};
const toggleNightOrder = () => grimoire.toggle("isNightOrder");
const toggleStatic = () => {
  grimoire.toggle("isStatic");
  publish("toggleStatic");
};
const setZoom = (value: number) => {
  grimoire.set("zoom", value);
  publish("setZoom", value);
};
const toggleModal = (name: ModalName) => modals.toggle(name);
const setTalking = (isTalking: boolean) => {
  const payload = { seatNum: session.claimedSeat, isTalking };
  audio.setTalking(isTalking);
  playersState.setTalking({ ...payload, playerId: session.playerId });
  publish("session/setTalking", payload);
};
const setAudioThreshold = (value: number) => {
  grimoire.set("audioThreshold", value);
  publish("setAudioThreshold", value);
};
const setSessionId = (sessionId: string) => {
  session.setSessionId(sessionId);
  publish("session/setSessionId", sessionId);
};
const setSpectator = (isSpectator: boolean) =>
  session.setSpectator(isSpectator);
const claimSeat = (seat: number) => {
  session.claimSeat(seat);
  publish("session/claimSeat", seat);
};
const setBootlegger = (bootlegger: string) => {
  settings.setBootlegger(bootlegger);
  publish("session/setBootlegger", bootlegger);
};
const setPlayerVotes = (votes: number) => {
  voting.setPlayerVotes(votes);
  publish("session/setPlayerVotes", votes);
};
const setSecretVote = (secret: boolean) => {
  voting.setSecretVote(secret);
  publish("session/setSecretVote", secret);
};
const setReview = (isReview: boolean) => {
  review.setReview(isReview);
  publish("session/setIsReview", isReview);
};
const setRole = (payload: Parameters<typeof roleActivity.setRole>[0]) => {
  roleActivity.setRole(payload);
  publish("session/setIsRole", payload);
};
const clearVoteHistory = (indexes: number[] = []) => {
  voting.clearVoteHistory(indexes);
  publish("session/clearVoteHistory", indexes);
};
const clearPlayersDirect = (emptyFabled = false) => {
  playersState.clear(emptyFabled);
  publish("players/clear", emptyFabled);
};
const removeGroup = (chatId: string) => {
  chat.removeGroup(chatId).forEach((change) => playersState.update(change));
  publish("session/removeGroupChat", { chatId });
};
const removeQueuedMessage = (index: number) => {
  outbox.remove(index);
  publish("session/deleteMessageQueue", index);
};
const setNomination = (payload?: unknown) => {
  voting.setNomination(payload as never, {
    isSecretVote: voting.isSecretVote,
    claimedSeat: session.claimedSeat,
  });
  publish("session/nomination", payload);
};
const addPlayerDirect = (stImage: string | null, stName: string | null) => {
  const payload = { name: "", stImage, stName };
  playersState.add(payload.name);
  if (playersState.fabled.length === 0) playersState.setFabled({ fabled: [] });
  publish("players/add", payload);
};
const setOldOrder = (value: typeof pendingOldOrder.value) => {
  legacyOptions.setUseOldOrder(value);
  publish("session/setUseOldOrder", value);
};
const setOldRole = (value: typeof pendingOldRole.value) => {
  legacyOptions.setUseOldRole(value);
  publish("session/setUseOldRole", value);
};
const setEdition = (value: typeof scenario.edition) => {
  scenario.setEdition(value);
  publish("setEdition", value);
};
const setCustomRoles = (value: unknown[]) => {
  if (scenario.setCustomRoles(value)) publish("setCustomRoles", value);
};
const startTimerDirect = (seconds: number) => {
  timer.startTimer(seconds);
  publish("session/startTimer", seconds);
};
const stopTimerDirect = () => {
  timer.stopTimer();
  publish("session/stopTimer");
};
const setDistribution = (
  kind: "roles" | "types" | "bluffs" | "grimoire",
  active: boolean,
  payload?: unknown,
) => {
  if (kind === "roles") distribution.setRoles(active);
  else if (kind === "types") distribution.setTypes(active);
  else if (kind === "bluffs") distribution.setBluffs(active);
  else distribution.setGrimoire(active);
  const type = {
    roles: "session/distributeRoles",
    types: "session/distributeTypes",
    bluffs: "session/distributeBluffs",
    grimoire: "session/distributeGrimoire",
  }[kind];
  publish(type, payload ?? active);
};
const initAudio = async () => {
  if (audioContext.value) return;

  const nextContext = new AudioContext();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const source = nextContext.createMediaStreamSource(stream);
  const nextAnalyser = nextContext.createAnalyser();
  nextAnalyser.fftSize = 256;
  source.connect(nextAnalyser);
  audioContext.value = nextContext;
  audioStream.value = stream;
  audioSource.value = source;
  analyser.value = nextAnalyser;
};
const runAudioDetection = () => {
  const activeAnalyser = analyser.value;
  const activeContext = audioContext.value;
  if (!activeAnalyser || !activeContext) return;

  const dataArray = new Uint8Array(activeAnalyser.frequencyBinCount);
  const humanVoiceRange = { min: 250, max: 400 };
  const detectSpeechActivity = () => {
    if (!analyser.value || !audioContext.value) return;
    activeAnalyser.getByteFrequencyData(dataArray);
    const binSize =
      activeContext.sampleRate / (2 * activeAnalyser.frequencyBinCount);
    let totalVolume = 0;
    for (let index = 0; index < activeAnalyser.frequencyBinCount; index++) {
      const frequency = index * binSize;
      if (frequency >= humanVoiceRange.min && frequency <= humanVoiceRange.max)
        totalVolume += dataArray[index] ?? 0;
    }

    if (totalVolume > grimoire.audioThreshold && !audio.isTalking)
      setTalking(true);
    else if (totalVolume <= grimoire.audioThreshold && audio.isTalking)
      setTalking(false);

    audio.setListeningFrame(requestAnimationFrame(detectSpeechActivity));
  };

  detectSpeechActivity();
};
const startListening = (mode: string) => {
  if (audio.listeningFrame || mode !== microphoneSetting.value) return;
  void initAudio().then(runAudioDetection);
};
const stopListening = (mode: string) => {
  if (!audio.listeningFrame || mode !== microphoneSetting.value) return;
  cancelAnimationFrame(audio.listeningFrame);
  audio.setListeningFrame(null);
  setTalking(false);
};
const startEditingThreshold = () => {
  isEditingThreshold.value = true;
  nextTick(() => {
    audioInputNumber.value?.focus();
    audioInputNumber.value?.select();
  });
};
const stopEditingThreshold = (save: boolean) => {
  isEditingThreshold.value = false;
  if (!save || !audioThresholdNumber.value) {
    audioThresholdNumber.value = audioThresholdSlider.value;
    return;
  }

  audioThresholdNumber.value = Math.max(
    0,
    Math.min(400, Math.round(audioThresholdNumber.value)),
  );
  syncAudioThresholdSlider(save);
};
const syncAudioThresholdSlider = (save: boolean) => {
  audioThresholdSlider.value = audioThresholdNumber.value;
  if (save) setAudioThreshold(audioThresholdNumber.value);
};
const syncAudioThresholdNumber = (save: boolean) => {
  audioThresholdNumber.value = audioThresholdSlider.value;
  if (save) setAudioThreshold(audioThresholdSlider.value);
};
const addPlayer = (
  stImage: string | null = null,
  stName: string | null = null,
) => {
  if (session.isSpectator || playersState.players.length >= 20) return;
  addPlayerDirect(stImage, stName);
};
const confirm = (name: string) =>
  showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: [name] },
  }).catch(() => null);
const randomizeSeatings = async () => {
  if (session.isSpectator || (await confirm("确定要随机分配座位吗？")) !== true)
    return;
  playersState.randomize();
  publish("players/randomize");
};
const clearPlayers = async () => {
  if (session.isSpectator || (await confirm("确定要移除所有座位吗？")) !== true)
    return;
  if (voting.nomination) setNomination();
  clearPlayersDirect(!session.sessionId);
};
const clearRoles = async () => {
  if (
    (session.isSpectator && review.isReview) ||
    (await confirm("确定要移除所有玩家角色吗？")) !== true
  )
    return;
  playersState.clearRoles(session.isSpectator);
  publish("players/clearRoles");
};
const customiseBootlegger = async () => {
  if (session.isSpectator) return;
  const input = await showInputModal({
    inputType: "bootlegger",
    inputModal: "input",
    inputData: { name: ["输入私货商人内容"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (!Array.isArray(input)) return;
  setBootlegger((input[0] ?? "").trim());
};
const toggleNight = () => {
  grimoire.toggle("isNight");
  publish("toggleNight");
  if (grimoire.isNight) {
    voting.setMarkedPlayer(-1, { isSecretVote: voting.isSecretVote });
    publish("session/setMarkedPlayer", -1);
  }
};
const selectEditionsAsk = () => {
  selectingEditions.value = !selectingEditions.value;
  if (selectingEditions.value)
    pendingEditions.value = {
      tb: scenario.selectedEditions.tb ?? false,
      bmr: scenario.selectedEditions.bmr ?? false,
      snv: scenario.selectedEditions.snv ?? false,
      exp: scenario.selectedEditions.exp ?? false,
      hdcs: scenario.selectedEditions.hdcs ?? false,
      syyl: scenario.selectedEditions.syyl ?? false,
    };
};
const selectEditions = (update = false) => {
  nextTick(() => document.getElementById("app")?.focus());
  selectingEditions.value = false;
  if (update) {
    scenario.setSelectedEditions(pendingEditions.value);
    publish("setSelectedEditions", pendingEditions.value);
  }
};
const imageOptIn = async () => {
  const popup = grimoire.isImageOptIn
    ? false
    : await showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: {
          name: [
            "确定要启用自定义游戏图标吗？木马剧本拥有者可能以此来追踪你的IP地址。",
          ],
        },
      }).catch(() => null);
  if (popup === null) return;
  if (grimoire.isImageOptIn || popup === true) toggleImageOptIn();
};
const focusApp = () => nextTick(() => document.getElementById("app")?.focus());
const useOldOrderAsk = () => {
  selectingOldRole.value = false;
  selectingOldOrder.value = !selectingOldOrder.value;
  if (selectingOldOrder.value)
    pendingOldOrder.value = { ...legacyOptions.useOldOrder };
};
const selectOldOrder = (update = false) => {
  focusApp();
  selectingOldOrder.value = false;
  if (!update) return;
  setOldOrder(pendingOldOrder.value);
  setEdition(scenario.edition);
};
const useOldRoleAsk = () => {
  selectingOldOrder.value = false;
  selectingOldRole.value = !selectingOldRole.value;
  if (selectingOldRole.value)
    pendingOldRole.value = { ...legacyOptions.useOldRole };
};
const selectOldRole = (update = false) => {
  focusApp();
  selectingOldRole.value = false;
  if (!update) return;
  setOldRole(pendingOldRole.value);
  if (localStorage.getItem("roles"))
    setCustomRoles(readStoredArray(localStorage, "roles"));
  setEdition(scenario.edition);
};
const setBackground = async () => {
  const input = await showInputModal({
    inputType: "background",
    inputModal: "input",
    inputData: { name: ["输入自定义背景图URL"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (Array.isArray(input)) {
    grimoire.set("background", input[0] ?? "");
    publish("setBackground", input[0]);
  }
};
const changeName = async () => {
  const input = await showInputModal({
    inputType: "changeName",
    inputModal: "input",
    inputData: { name: ["输入玩家昵称"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (Array.isArray(input)) {
    profile.setPlayerName(input[0] ?? "");
    publish("session/setPlayerName", input[0]);
  }
};
const copySessionUrl = () => {
  const url = window.location.href.split("#")[0];
  void navigator.clipboard
    .writeText(`${url}#${session.sessionId}`)
    .catch(() => {});
};
const showNetworkWarning = () =>
  showInputModal({
    inputType: "alert",
    inputModal: "text",
    inputData: { name: ["网络连接不稳定，请稍等！"] },
  }).catch(() => null);
const hostSession = async () => {
  if (!profile.playerName) await changeName();
  if (!profile.playerName || session.sessionId) return;
  if (lobby.rooms === null) {
    await showNetworkWarning();
    return;
  }
  let sessionPlaceholder = String(Math.round(Math.random() * 10000));
  while (lobby.rooms.includes(sessionPlaceholder))
    sessionPlaceholder = String(Math.round(Math.random() * 10000));
  const input = await showInputModal({
    inputType: "hostSession",
    inputModal: "input",
    inputData: {
      name: ["请输入房间号", "请输入玩家人数"],
      length: 2,
      placeholder: [sessionPlaceholder, "12"],
    },
  }).catch(() => null);
  if (!Array.isArray(input)) return;
  const sessionId = Number(input[0]).toString();
  const numPlayers = Math.min(Number(input[1]), 20);
  if (!sessionId) return;
  clearVoteHistory();
  setSpectator(false);
  setSessionId(sessionId);
  clearPlayersDirect();
  for (let index = 0; index < numPlayers; index++) addPlayer();
  copySessionUrl();
};
const leaveSession = async () => {
  const confirmed = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: ["确定要离开/解散该房间吗？"] },
  }).catch(() => null);
  if (confirmed !== true) return;
  claimSeat(-1);
  setSpectator(false);
  setSessionId("");
  connection.setIsHostAllowed(null);
  connection.setIsJoinAllowed(null);
  if (voting.nomination) setNomination();
  clearPlayersDirect(true);
  if (settings.bootlegger) setBootlegger("");
  if (voting.playerVotes > 1) setPlayerVotes(1);
  if (voting.isSecretVote) setSecretVote(false);
  if (review.isReview) setReview(false);
  interaction.setChatOpen(false);
  chat.groups.forEach((group) => removeGroup(group.id));
  while (outbox.queue.length > 0) removeQueuedMessage(0);
  setRole({
    role: "wraith",
    property: "active",
    value: false,
  });
  setRole({
    role: "wraith",
    property: "using",
    value: false,
    st: true,
  });
};
const joinSession = async () => {
  if (session.sessionId) return leaveSession();
  if (!profile.playerName) await changeName();
  if (!profile.playerName) return;
  if (lobby.rooms === null) {
    await showNetworkWarning();
    return;
  }
  const input = await showInputModal({
    inputType: "joinSession",
    inputModal: "input",
    inputData: { name: ["输入房间号/链接"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (!Array.isArray(input)) return;
  const sessionId = Number((input[0] ?? "").split("#").pop()).toString();
  if (!sessionId) return;
  clearVoteHistory();
  setSpectator(true);
  setGrimoirePublic(false);
  setSessionId(sessionId);
};
const startTimer = (time?: number) => {
  if (session.isSpectator) return;
  startTimerDirect(time ?? timer.seconds);
  timing.value = true;
};
const stopTimer = () => {
  if (session.isSpectator) return;
  stopTimerDirect();
  timing.value = false;
};
const setTimer = async () => {
  if (session.isSpectator || !session.sessionId) return;
  const input = await showInputModal({
    inputType: "timer",
    inputModal: "input",
    inputData: { name: ["输入时间（分）"], length: 1, placeholder: [""] },
  }).catch(() => null);
  if (!Array.isArray(input)) return;
  const time = Number(input[0]);
  if (!time || time <= 0) return;
  timing.value = true;
  stopTimer();
  startTimer(time * 60);
};
const distributeAsk = () => {
  distributingBluffs.value = false;
  distributingGrimoire.value = false;
  distributingTypes.value = false;
  distributing.value = !distributing.value;
};
const distributeRoles = (confirmed: boolean) => {
  void nextTick(focusApp);
  distributing.value = false;
  if (!confirmed || session.isSpectator) return;
  setDistribution("roles", true);
  setTimeout(() => setDistribution("roles", false), 2000);
  if (!isSendingBluff.value) return;
  setDistribution("bluffs", true, {
    val: true,
    role: "demonAll",
  });
  setTimeout(() => setDistribution("bluffs", false, { val: false }), 2000);
};
const distributeTypes = () => {
  distributingTypes.value = false;
  if (session.isSpectator) return;
  setDistribution("types", true);
  setTimeout(() => setDistribution("types", false), 2000);
};
const distributeTypeAsk = async () => {
  distributing.value = false;
  distributingBluffs.value = false;
  distributingGrimoire.value = false;
  distributingTypes.value = !distributingTypes.value;
  const confirmed = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: ["确定要发送角色类型给玩家？"] },
  }).catch(() => null);
  if (confirmed === true) distributeTypes();
};
const distributeBluffsAsk = () => {
  distributing.value = false;
  distributingGrimoire.value = false;
  distributingTypes.value = false;
  distributingBluffs.value = !distributingBluffs.value;
};
const distributeBluffs = async (role: string | null = null, seat = false) => {
  void nextTick(focusApp);
  if (!role && !seat) {
    distributingBluffs.value = false;
    return;
  }
  let seatNum: string | undefined;
  if (seat) {
    const input = await showInputModal({
      inputType: "seatNum",
      inputModal: "input",
      inputData: { name: ["请输入座位号"], length: 1, placeholder: [""] },
    }).catch(() => null);
    if (!Array.isArray(input)) return;
    seatNum = input[0];
  }
  const roleText =
    role === "demon"
      ? "恶魔"
      : role === "lunatic"
      ? "疯子"
      : role === "snitch"
      ? "爪牙"
      : "";
  const confirmed = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: {
      name: [`确定要发送伪装身份给${roleText || `${seatNum}号位`}？`],
    },
  }).catch(() => null);
  if (confirmed !== true || session.isSpectator) return;
  setDistribution("bluffs", true, { val: true, role, seatNum });
  setTimeout(() => setDistribution("bluffs", false, { val: false }), 2000);
  distributingBluffs.value = false;
};
const distributeGrimoireAsk = () => {
  distributing.value = false;
  distributingBluffs.value = false;
  distributingTypes.value = false;
  distributingGrimoire.value = !distributingGrimoire.value;
};
const distributeGrimoire = async (role: string | null = null, seat = false) => {
  void nextTick(focusApp);
  if (!role && !seat) {
    distributingGrimoire.value = false;
    return;
  }
  let seatNum: string | undefined;
  if (seat) {
    const input = await showInputModal({
      inputType: "seatNum",
      inputModal: "input",
      inputData: { name: ["请输入座位号"], length: 1, placeholder: [""] },
    }).catch(() => null);
    if (!Array.isArray(input)) return;
    seatNum = input[0];
  }
  const roleText = role === "widow" ? "寡妇" : role === "spy" ? "间谍" : "";
  const confirmed = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: [`确定要发送魔典给${roleText || `${seatNum}号位`}？`] },
  }).catch(() => null);
  if (confirmed !== true || session.isSpectator) return;
  setDistribution("grimoire", true, { val: true, role, seatNum });
  setTimeout(() => setDistribution("grimoire", false, { val: false }), 2000);
  distributingGrimoire.value = false;
};
const toggleIsReview = async () => {
  if (session.isSpectator) return;
  const confirmed = review.isReview
    ? false
    : await showInputModal({
        inputType: "confirm",
        inputModal: "confirm",
        inputData: { name: ["是否开启复盘视角？（所有玩家将看到角色）"] },
      }).catch(() => null);
  if (confirmed === null) return;
  if (!review.isReview && confirmed === true) {
    setReview(true);
    playersState.realivePlayers();
    publish("players/realivePlayers");
  } else if (review.isReview) {
    setReview(false);
  }
};
const clearLocalStorage = async () => {
  const clear = await showInputModal({
    inputType: "confirm",
    inputModal: "confirm",
    inputData: { name: ["确定清空所有内容吗？（将清除昵称头像和聊天记录等）"] },
  }).catch(() => null);
  if (!clear) return;
  clearTownsquareStorage(window.localStorage);
  await showInputModal({
    inputType: "alert",
    inputModal: "text",
    inputData: { name: ["清理完成，请刷新网页！"] },
  }).catch(() => null);
};
watch(
  () => grimoire.audioThreshold,
  (value) => {
    audioThresholdNumber.value = value;
    audioThresholdSlider.value = value;
  },
  { immediate: true },
);

defineExpose({
  hostSession,
  joinSession,
  startListening,
  stopListening,
  toggleNight,
  setTimer,
});
</script>

<style scoped lang="scss">
@use "../vars.scss" as *;

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

      .wrap {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }

      .input {
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
  background-color: rgba(0, 0, 0, 0.5);
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
