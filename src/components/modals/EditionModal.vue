<template>
  <Modal class="editions" v-if="modals.edition" @close="closeEdition()">
    <div v-if="!isCustom">
      <h3>选择剧本</h3>
      <ul class="editions">
        <li
          v-for="edition in editions"
          class="edition"
          :class="['edition-' + edition.id]"
          :style="{
            backgroundImage: `url(${editionImage(edition.id)})`,
          }"
          :key="edition.id"
          @click="setHomeEdition(edition)"
        >
          {{ edition.name }}
        </li>
        <li
          class="edition edition-custom"
          @click="isCustom = true"
          :style="{
            backgroundImage: `url(${editionImage('custom')})`,
          }"
        >
          自定义剧本/角色
        </li>
      </ul>
    </div>
    <div class="custom" v-else>
      <h3>加载自定义剧本/角色</h3>
      若想玩自定义剧本，请在
      <a href="https://clocktower.gstonegames.com/script_tool/" target="_blank"
        >官方（中文）剧本工具</a
      >
      中选择想玩的角色然后上传生成的"custom-list.json"文件或提供包含JSON文件的URL链接。

      <br />
      若想玩自定义角色，请查阅关于如何编写自定义角色定义文件的文档。
      <br />
      <b>请勿上传未知来源的自定义JSON文件！</b>
      <h3>剧本：</h3>
      <ul class="scripts">
        <li
          v-for="(script, index) in scripts"
          :key="index"
          @click="handleURL(script[1] ?? '')"
        >
          {{ script[0] }}
        </li>
      </ul>
      <input
        type="file"
        ref="upload"
        accept="application/json"
        @change="handleUpload"
      />
      <div class="button-group">
        <div class="button" @click="openUpload">
          <font-awesome-icon icon="file-upload" /> 上传JSON
        </div>
        <div class="button" @click="promptURL">
          <font-awesome-icon icon="link" /> 输入URL
        </div>
        <div class="button" @click="readFromClipboard">
          <font-awesome-icon icon="clipboard" /> 使用剪贴板中的JSON
        </div>
        <div class="button" @click="isCustom = false">
          <font-awesome-icon icon="undo" /> 返回
        </div>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { editionImage } from "../../assets/images";
import editionJSON from "../../editions.json";
import Modal from "./Modal.vue";
import { showInputModal } from "../../services/input-modal";
import { emitGameEvent } from "../../store/game-events";
import { useModalStore } from "../../stores/modals";
import { usePlayersStore } from "../../stores/players";
import { useScenarioStore } from "../../stores/scenario";
import type { ScenarioCatalogRole } from "@townsquare/domain";

type ScriptRole = Record<string, unknown> & { id?: string };
type ScriptEdition = { id: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValues = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const stringValue = (value: unknown, fallback: string) =>
  typeof value === "string" ? value : fallback;

const modals = useModalStore();
const players = usePlayersStore();
const scenario = useScenarioStore();
const upload = ref<HTMLInputElement | null>(null);
const editions = editionJSON;
const isCustom = ref(false);
const scripts = [
  [
    "死罪忏悔日",
    "https://gist.githubusercontent.com/bra1n/0337cc44c6fd2c44f7589256ed5486d2/raw/16be38fa3c01aaf49827303ac80577bdb52c0b25/penanceday.json",
  ],
  [
    "人人都该诋毁的鲶鱼11.1",
    "https://gist.githubusercontent.com/bra1n/8a5ec41a7bbf945f6b7dfc1cef72b569/raw/a312ab93c2f302e0ef83c8b65a4e8e82760fda3a/catfishing.json",
  ],
  [
    "如履薄冰（小剧本）",
    "https://gist.githubusercontent.com/bra1n/8dacd9f2abc6f428331ea1213ab153f5/raw/0cacbcaf8ed9bddae0cca25a9ada97e9958d868b/on-thin-ice.json",
  ],
  [
    "逐底竞技（小剧本）",
    "https://gist.githubusercontent.com/bra1n/63e1354cb3dc9d4032bcd0623dc48888/raw/5acb0eedcc0a67a64a99c7e0e6271de0b7b2e1b2/race-to-the-bottom.json",
  ],
  [
    "失控造物（小剧本）",
    "https://gist.githubusercontent.com/bra1n/32c52b422cc01b934a4291eeb81dbcee/raw/5bf770693bbf7aff5e86601c82ca4af3222f4ba6/Frankensteins_Mayor_by_Ted.json",
  ],
  [
    "永生之境（小剧本）",
    "https://gist.githubusercontent.com/bra1n/1f65bd4a999524719d5dabe98c3c2d27/raw/22bbec6bf56a51a7459e5ae41ed47e41971c5445/VigormortisHighSchool.json",
  ],
  ["无上愉悦（小剧本）", "https://botcgrimoire.top/json/no_greater_joy.json"],
  [
    "噬脑疑局（小剧本）",
    "https://botcgrimoire.top/json/a_lleach_of_distrust.json",
  ],
];

function closeEdition() {
  modals.toggle("edition");
  isCustom.value = false;
}
function openUpload() {
  upload.value?.click();
}
async function alertError(message: string) {
  await showInputModal({
    inputType: "alert",
    inputModal: "text",
    inputData: { name: [message] },
  }).catch(() => null);
}
function normalizeRoles(raw: unknown): ScriptRole[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw.flatMap((role) => {
    if (typeof role === "string") return [{ id: role }];
    return isRecord(role) ? [role] : [];
  });
}
function getMeta(roles: ScriptRole[]) {
  const copy = [...roles];
  const index = copy.findIndex((role) => role.id === "_meta");
  return {
    roles:
      index >= 0
        ? copy.filter((_role, roleIndex) => roleIndex !== index)
        : copy,
    meta: index >= 0 ? copy[index]! : {},
  };
}
function installScript(raw: unknown) {
  const normalized = normalizeRoles(raw);
  if (!normalized) return;
  const { roles, meta } = getMeta(normalized);
  stringValues(meta.bootlegger).forEach((ability, index) =>
    roles.push({
      id: `bootlegger${index}`,
      reminders: [],
      setup: false,
      name: `私货商人${index + 1}`,
      team: "fabled",
      ability,
    }),
  );
  if (!scenario.setCustomRoles(roles)) return;
  emitGameEvent("setCustomRoles", roles);
  applyEdition(Object.assign({}, meta, { id: "custom" }));
  const fabledMap = scenario.fabled;
  const fabled = roles.flatMap((role): ScenarioCatalogRole[] => {
    if (
      typeof role.id !== "string" ||
      (stringValues(meta.bootlegger).length > 0 && role.id === "bootlegger")
    )
      return [];
    const fabledRole = fabledMap.get(role.id);
    return fabledRole ? [fabledRole] : [];
  });
  if (fabled.length) {
    const payload = { fabled };
    players.setFabled(payload);
    emitGameEvent("players/setFabled", payload);
  }
  const states: Record<string, string>[] = [];
  const stateEntries = Array.isArray(meta.state)
    ? meta.state
    : Array.isArray(meta.status)
    ? meta.status
    : [];
  stateEntries.filter(isRecord).forEach((state) => {
    const name = stringValue(state.stateName ?? state.name, "");
    const description = stringValue(state.stateDescription ?? state.skill, "");
    if (name) states.push({ [name]: description });
  });
  scenario.setStates(states);
  emitGameEvent("setStates", states);
  const teamsNames = {
    townsfolk: stringValue(meta.townsfolksName, "镇民"),
    outsider: stringValue(meta.outsidersName, "外来者"),
    minion: stringValue(meta.minionsName, "爪牙"),
    demon: stringValue(meta.demonsName, "恶魔"),
  };
  scenario.setTeamsNames(teamsNames);
  emitGameEvent("setTeamsNames", teamsNames);
  const firstNight = stringValues(meta.firstNight).map((role) =>
    role.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  scenario.setFirstNight(firstNight);
  emitGameEvent("setFirstNight", firstNight);
  const otherNight = stringValues(meta.otherNight).map((role) =>
    role.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  scenario.setOtherNight(otherNight);
  emitGameEvent("setOtherNight", otherNight);
  isCustom.value = false;
}
async function handleUpload() {
  const file = upload.value?.files?.[0];
  if (file && file.size) {
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      try {
        installScript(JSON.parse(String(reader.result)));
      } catch {
        await alertError("读取剧本错误：自定义剧本内容不是有效的JSON文件！");
        return;
      }
      if (upload.value) upload.value.value = "";
    });
    reader.readAsText(file);
  }
}
async function promptURL() {
  const input = await showInputModal({
    inputType: "json",
    inputModal: "input",
    inputData: {
      name: ["输入custom-script.json文件的URL"],
      length: 1,
      placeholder: [""],
    },
  }).catch(() => null);
  if (input === null || !Array.isArray(input)) return;

  const url = input[0];
  if (url) {
    handleURL(url);
  }
}
async function handleURL(url: string) {
  const res = await fetch(url);
  if (res && res.json) {
    try {
      const script = await res.json();
      installScript(script);
    } catch {
      await alertError("读取剧本错误：URL内容不是有效的JSON文件！");
    }
  }
}
async function readFromClipboard() {
  const text = await navigator.clipboard.readText();
  try {
    installScript(JSON.parse(text));
  } catch {
    await alertError("读取剧本错误：剪贴板内容不是有效的JSON文件！");
  }
}
function setHomeEdition(edition: ScriptEdition) {
  if (["tb", "bmr", "snv", "luf", "all", "custom_ankot"].includes(edition.id)) {
    scenario.setStates([]);
    emitGameEvent("setStates", []);
  }
  applyEdition(edition);
}

function applyEdition(edition: unknown) {
  const fabled = scenario.setEdition(edition);
  emitGameEvent("setEdition", edition);
  if (fabled) emitGameEvent("players/setFabled", { fabled });
}
</script>

<style scoped lang="scss">
ul.editions .edition {
  font-family: PiratesBay, sans-serif;
  letter-spacing: 1px;
  text-align: center;
  padding-top: 15%;
  background-position: center center;
  background-size: 100% auto;
  background-repeat: no-repeat;
  height: 200px;
  width: 250px;
  margin: 5px;
  font-size: 120%;
  text-shadow:
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000,
    0 0 5px rgba(0, 0, 0, 0.75);
  cursor: pointer;
  &:hover {
    color: red;
  }
}

.custom {
  text-align: center;
  input[type="file"] {
    display: none;
  }
  .scripts {
    list-style-type: disc;
    font-size: 120%;
    cursor: pointer;
    display: block;
    width: 50%;
    text-align: left;
    margin: 10px auto;
    li:hover {
      color: red;
    }
  }
}
</style>
