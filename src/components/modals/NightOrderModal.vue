<template>
  <Modal
    class="night-reference"
    @close="modals.toggle('nightOrder')"
    v-if="modals.nightOrder && roles.size"
  >
    <font-awesome-icon
      @click="modals.toggle('reference')"
      icon="address-card"
      class="toggle"
      title="Show Character Reference"
    />
    <h3>
      夜间顺序
      <font-awesome-icon icon="cloud-moon" />
      {{ edition.name || "Custom Script" }}
    </h3>
    <div
      v-if="!session.isSpectator"
      class="check-box"
      @click="toggleVacantSeats()"
    >
      <span>显示空座位提示</span> &nbsp;
      <em>
        <font-awesome-icon
          :icon="['fas', isShowVacant ? 'check-square' : 'square']"
        />
      </em>
    </div>
    <div class="night">
      <ul class="first">
        <li class="headline">首夜</li>
        <li
          v-for="role in rolesFirstNight"
          :key="role.name"
          :class="[role.team]"
        >
          <span class="name">
            {{ role.name }}
            <span class="player" v-if="role.players.length">
              <br />
              <small
                v-for="(player, index) in role.players"
                v-show="isShowVacant || player.id"
                :class="{ dead: player.isDead }"
                :key="index"
                >{{
                  Number(player.index) +
                  1 +
                  "." +
                  (player.name ? player.name : "空座位") +
                  (role.players.length > Number(index) + 1 ? "," : "") +
                  (player.another ? player.another : "")
                }}</small
              >
            </span>
          </span>
          <span
            class="icon"
            v-if="role.id"
            :style="{
              backgroundImage: `url(${
                role.image && grimoire.isImageOptIn
                  ? role.image
                  : require(
                      '../../assets/icons/' +
                        (role.imageAlt || role.id.replace(/old1$/, '')) +
                        '.png',
                    )
              })`,
            }"
          ></span>
          <span class="reminder" v-if="role.firstNightReminder">
            {{ role.firstNightReminder }}
          </span>
        </li>
      </ul>
      <ul class="other">
        <li class="headline">其他夜</li>
        <li
          v-for="role in rolesOtherNight"
          :key="role.name"
          :class="[role.team]"
        >
          <span
            class="icon"
            v-if="role.id"
            :style="{
              backgroundImage: `url(${
                role.image && grimoire.isImageOptIn
                  ? role.image
                  : require(
                      '../../assets/icons/' +
                        (role.imageAlt || role.id.replace(/old1$/, '')) +
                        '.png',
                    )
              })`,
            }"
          ></span>
          <span class="name">
            {{ role.name }}
            <span class="player" v-if="role.players.length">
              <br />
              <small
                v-for="(player, index) in role.players"
                v-show="isShowVacant || player.id"
                :class="{ dead: player.isDead }"
                :key="index"
                >{{
                  Number(player.index) +
                  1 +
                  "." +
                  (player.name ? player.name : "空座位") +
                  (role.players.length > Number(index) + 1 ? "," : "") +
                  (player.another ? player.another : "")
                }}</small
              >
            </span>
          </span>
          <span class="reminder" v-if="role.otherNightReminder">
            {{ role.otherNightReminder }}
          </span>
        </li>
      </ul>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Modal from "./Modal.vue";
import { useGrimoireStore } from "../../stores/grimoire";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import { useSessionIdentityStore } from "../../stores/session-identity";

const modals = useModalStore();
const grimoire = useGrimoireStore();
const playerState = usePlayersStore();
const scenario = useScenarioStore();
const session = useSessionIdentityStore();
const players = computed(() => playerState.players);
const fabled = computed(() => playerState.fabled);
const roles = scenario.roles as Map<string, any>;
const edition = computed(() => scenario.edition ?? ({} as any));
const isShowVacant = ref(false);

const setPlayerAnnotations = () => {
  // 打开行动顺序时先给所有座位加上座位号，同时检索是其他类型的token
  players.value.forEach((player, index) => {
    player.index = index;
    let another = "";
    player.reminders.forEach((reminder: any) => {
      switch (reminder.name) {
        case "是学徒":
          another = another + "（学徒）";
          break;
        case "是叫花子":
          another = another + "（叫花子）";
          break;
        case "是酒鬼":
          another = another + "（酒鬼）";
          break;
        case "是疯子":
          another = another + "（疯子）";
          break;
        case "是哲学家":
          another = another + "（哲学家）";
          break;
        case "是炼金术士":
          another = another + "（炼金术士）";
          break;
        case "是炼金术士（旧）":
          another = another + "（炼金术士）";
          break;
        case "是正牙医生":
          another = another + "（正牙医生）";
          break;
        case "是悟道者":
          another = another + "（悟道者）";
          break;
      }
    });
    player.another = another;
  });
};

const rolesFirstNight = computed(() => {
  setPlayerAnnotations();
  const rolesFirstNight: any[] = [];
  // add minion / demon infos to night order sheet
  if (players.value.length > 6) {
    rolesFirstNight.push(
      {
        id: "evil",
        alias: "minioninfo",
        name: "爪牙信息",
        firstNight: grimoire.isForwardEvilInfo ? 0 : 15,
        team: "minion",
        players: players.value.filter((p) => p.role.team === "minion"),
        firstNightReminder:
          "如果爪牙多于一位，让他们互相看清彼此。" +
          "展示这是恶魔卡片，指向恶魔。（夜间顺序15）",
      },
      {
        id: "evil",
        alias: "demoninfo",
        name: "恶魔信息与伪装身份",
        firstNight: grimoire.isForwardEvilInfo ? 0 : 21,
        team: "demon",
        players: players.value.filter((p) => p.role.team === "demon"),
        firstNightReminder:
          "展示这些是你的爪牙卡片，并指向每个爪牙。" +
          "展示这些身份不在游戏中卡片，并展示3个不在场的善良身份。（夜间顺序21）",
      },
    );
  }
  roles.forEach((role) => {
    const rolePlayers = players.value.filter((p) => p.role.id === role.id);
    if (role.firstNight && (role.team !== "traveler" || rolePlayers.length)) {
      if (rolePlayers.length > 0 && !rolePlayers[0].id)
        rolePlayers[0].name = "";
      rolesFirstNight.push(Object.assign({ players: rolePlayers }, role));
    }
  });
  fabled.value
    .filter(({ firstNight }) => firstNight)
    .forEach((fabled) => {
      rolesFirstNight.push(Object.assign({ players: [] }, fabled));
    });
  const rolesList = [...roles.values()];
  const roleIds = [
    ...rolesList.filter((role) => role.firstNight > 0).map((role) => role.id),
    ...fabled.value
      .filter((role) => role.firstNight > 0)
      .map((role) => role.id),
    "dusk",
    "dawn",
    "minioninfo",
    "demoninfo",
  ];
  const customOrder =
    scenario.firstNight.every((role: any) => roleIds.includes(role)) &&
    roleIds.every((role) => scenario.firstNight.includes(role));
  rolesFirstNight.sort((a, b) => {
    return customOrder
      ? (scenario.firstNight as any[]).indexOf(a.alias || a.id) -
          (scenario.firstNight as any[]).indexOf(b.alias || b.id)
      : a.firstNight - b.firstNight;
  });
  return rolesFirstNight;
});
const rolesOtherNight = computed(() => {
  const rolesOtherNight: any[] = [];
  roles.forEach((role) => {
    const rolePlayers = players.value.filter((p) => p.role.id === role.id);
    if (role.otherNight && (role.team !== "traveler" || rolePlayers.length)) {
      if (rolePlayers.length > 0 && !rolePlayers[0].id)
        rolePlayers[0].name = "";
      rolesOtherNight.push(Object.assign({ players: rolePlayers }, role));
    }
  });
  fabled.value
    .filter(({ otherNight }) => otherNight)
    .forEach((fabled) => {
      rolesOtherNight.push(Object.assign({ players: [] }, fabled));
    });
  const rolesList = [...roles.values()];
  const roleIds = [
    ...rolesList.filter((role) => role.otherNight > 0).map((role) => role.id),
    ...fabled.value
      .filter((role) => role.otherNight > 0)
      .map((role) => role.id),
    "dusk",
    "dawn",
  ];
  const customOrder =
    scenario.otherNight.every((role: any) => roleIds.includes(role)) &&
    roleIds.every((role) => scenario.otherNight.includes(role));
  rolesOtherNight.sort((a, b) => {
    return customOrder
      ? (scenario.otherNight as any[]).indexOf(a.id) -
          (scenario.otherNight as any[]).indexOf(b.id)
      : a.otherNight - b.otherNight;
  });
  return rolesOtherNight;
});
function toggleVacantSeats() {
  isShowVacant.value = !isShowVacant.value;
}
</script>

<style lang="scss" scoped>
@import "../../vars.scss";

.toggle {
  position: absolute;
  left: 20px;
  top: 15px;
  cursor: pointer;
  &:hover {
    color: red;
  }
}

h3 {
  margin: 0 40px;
  svg {
    vertical-align: middle;
  }
}

h4 {
  text-transform: capitalize;
  display: flex;
  align-items: center;
  height: 20px;
  &:before,
  &:after {
    content: " ";
    width: 100%;
    height: 1px;
    border-radius: 2px;
  }
  &:before {
    margin-right: 15px;
  }
  &:after {
    margin-left: 15px;
  }
}

.fabled {
  .name {
    background: linear-gradient(90deg, $fabled, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $fabled, transparent 35%);
    }
  }
}
.townsfolk {
  .name {
    background: linear-gradient(90deg, $townsfolk, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $townsfolk, transparent 35%);
    }
  }
}
.outsider {
  .name {
    background: linear-gradient(90deg, $outsider, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $outsider, transparent 35%);
    }
  }
}
.minion {
  .name {
    background: linear-gradient(90deg, $minion, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $minion, transparent 35%);
    }
  }
}
.demon {
  .name {
    background: linear-gradient(90deg, $demon, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $demon, transparent 35%);
    }
  }
}
.traveler {
  .name {
    background: linear-gradient(90deg, $traveler, transparent 35%);
    .night .other & {
      background: linear-gradient(-90deg, $traveler, transparent 35%);
    }
  }
}
ul {
  li {
    display: flex;
    width: 100%;
    margin-bottom: 3px;
    .icon {
      width: 6vh;
      background-size: cover;
      background-position: 0 0;
      flex-grow: 0;
      flex-shrink: 0;
      text-align: center;
      margin: 0 2px;
      &:after {
        content: " ";
        display: block;
        padding-top: 66%;
      }
    }
    .name {
      flex-grow: 0;
      flex-shrink: 0;
      width: 15%;
      text-align: right;
      font-size: 110%;
      padding: 5px;
      border-left: 1px solid rgba(255, 255, 255, 0.4);
      border-right: 1px solid rgba(255, 255, 255, 0.4);
      small {
        color: #888;
        margin-right: 5px;
        &.dead {
          text-decoration: line-through;
        }
      }
    }
    .reminder {
      position: fixed;
      padding: 5px 10px;
      left: 50%;
      bottom: 10%;
      width: 500px;
      z-index: 25;
      background: rgba(0, 0, 0, 0.75);
      border-radius: 10px;
      border: 3px solid black;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
      text-align: left;
      pointer-events: none;
      opacity: 0;
      transition: opacity 200ms ease-in-out;
      margin-left: -250px;
    }
    &:hover .reminder {
      opacity: 1;
    }
  }
  &.legend {
    font-weight: bold;
    height: 20px;
    margin-top: 10px;
    li span {
      background: none;
      height: auto;
      font-family: inherit;
      font-size: inherit;
    }
    .icon:after {
      padding-top: 0;
    }
  }
}

.night {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  > *:first-child {
    margin-right: 2vh;
  }
  > * {
    flex-grow: 0;
    flex-wrap: nowrap;
    flex-direction: column;
  }
  .headline {
    display: block;
    font-weight: bold;
    border-bottom: 1px solid rgba(255, 255, 255, 0.4);
    padding: 5px 10px;
    border-radius: 0;
    text-align: center;
  }
  .name {
    flex-grow: 1;
  }
  .first {
    .name {
      border-left: 0;
    }
  }
  .other {
    li .name {
      text-align: left;
      border-right: 0;
    }
  }
}

.check-box {
  display: flex;
  justify-content: center;
  align-items: center;
  width: fit-content;

  margin-left: auto;
  margin-right: auto;

  cursor: pointer;
  &:hover {
    color: red;
  }
}

/** hide players when town square is set to "public" **/
#townsquare.public ~ .night-reference .modal .player {
  display: none;
}
</style>
