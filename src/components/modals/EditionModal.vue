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
            backgroundImage: `url(${require('../../assets/editions/' +
              edition.id +
              '.png')})`
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
            backgroundImage: `url(${require('../../assets/editions/custom.png')})`
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
          @click="handleURL(script[1])"
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

<script>
import editionJSON from "../../editions";
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: {
    Modal
  },
  data: function() {
    return {
      editions: editionJSON,
      isCustom: false,
      scripts: [
        [
          "死罪忏悔日",
          "https://gist.githubusercontent.com/bra1n/0337cc44c6fd2c44f7589256ed5486d2/raw/16be38fa3c01aaf49827303ac80577bdb52c0b25/penanceday.json"
        ],
        [
          "人人都该诋毁的鲶鱼11.1",
          "https://gist.githubusercontent.com/bra1n/8a5ec41a7bbf945f6b7dfc1cef72b569/raw/a312ab93c2f302e0ef83c8b65a4e8e82760fda3a/catfishing.json"
        ],
        [
          "如履薄冰（小剧本）",
          "https://gist.githubusercontent.com/bra1n/8dacd9f2abc6f428331ea1213ab153f5/raw/0cacbcaf8ed9bddae0cca25a9ada97e9958d868b/on-thin-ice.json"
        ],
        [
          "逐底竞技（小剧本）",
          "https://gist.githubusercontent.com/bra1n/63e1354cb3dc9d4032bcd0623dc48888/raw/5acb0eedcc0a67a64a99c7e0e6271de0b7b2e1b2/race-to-the-bottom.json"
        ],
        [
          "失控造物（小剧本）",
          "https://gist.githubusercontent.com/bra1n/32c52b422cc01b934a4291eeb81dbcee/raw/5bf770693bbf7aff5e86601c82ca4af3222f4ba6/Frankensteins_Mayor_by_Ted.json"
        ],
        [
          "永生之境（小剧本）",
          "https://gist.githubusercontent.com/bra1n/1f65bd4a999524719d5dabe98c3c2d27/raw/22bbec6bf56a51a7459e5ae41ed47e41971c5445/VigormortisHighSchool.json"
        ],
        [
          "无上愉悦（小剧本）",
          "https://botcgrimoire.top/json/no_greater_joy.json"
        ],
        [
          "噬脑疑局（小剧本）",
          "https://botcgrimoire.top/json/a_lleach_of_distrust.json"
        ]
      ]
    };
  },
  computed: mapState(["modals", "selectedEditions"]),
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
    closeEdition(){
      this.toggleModal('edition');
      this.isCustom = false;
    },
    openUpload() {
      this.$refs.upload.click();
    },
    async handleUpload() {
      const file = this.$refs.upload.files[0];
      if (file && file.size) {
        const reader = new FileReader();
        reader.addEventListener("load", async () => {
          try {
            const roles = JSON.parse(reader.result);
            this.parseRoles(roles);
            this.parseStates(roles);
          } catch (e) {
            await this.showInputModal({
              inputType: "alert",
              inputModal: "text",
              inputData: {
                name: ["读取剧本错误：自定义剧本内容不是有效的JSON文件！"],
              }
            }).catch(() => {
              return null;
            });
            return;
          }
          this.$refs.upload.value = "";
        });
        reader.readAsText(file);
      }
    },
    async promptURL() {
      const input = await this.showInputModal({
        inputType: "json",
        inputModal: "input",
        inputData: {
          name: ["输入custom-script.json文件的URL"],
          length: 1,
          placeholder: [""]
        }
      }).catch(() => {
        return null;
      });
      if (input === null) return;

      const url = input[0];
      if (url) {
        this.handleURL(url);
      }
    },
    async handleURL(url) {
      const res = await fetch(url);
      if (res && res.json) {
        try {
          const script = await res.json();
          this.parseRoles(script);
          this.parseStates(script);
        } catch (e) {
          await this.showInputModal({
            inputType: "alert",
            inputModal: "text",
            inputData: {
              name: ["读取剧本错误：URL内容不是有效的JSON文件！"],
            }
          }).catch(() => {
            return null;
          });
          return;
        }
      }
    },
    async readFromClipboard() {
      const text = await navigator.clipboard.readText();
      try {
        const roles = JSON.parse(text);
        this.parseRoles(roles);
        this.parseStates(roles);
      } catch (e) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["读取剧本错误：剪贴板内容不是有效的JSON文件！"],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
    },
    parseRoles(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map(role => typeof role === "string" ? { id: role } : role);
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      if (meta.bootlegger) {
        for (let i=0; i<meta.bootlegger.length; i++) {
          roles.push({
            "id": `bootlegger${i}`,
            "reminders": [],
            "setup": false,
            "name": `私货商人${i+1}`,
            "team": "fabled",
            "ability": meta.bootlegger[i]
          });
        }
      }
      this.$store.commit("setCustomRoles", roles);
      this.$store.commit(
        "setEdition",
        Object.assign({}, meta, { id: "custom" })
      );
      // check for fabled and set those too, if present
      if (roles.some((role) => this.$store.state.fabled.has(role.id || role))) {
        const fabled = [];
        roles.forEach((role) => {
          if (this.$store.state.fabled.has(role.id || role) && (!meta.bootlegger || role.id !== 'bootlegger')) {
            fabled.push(this.$store.state.fabled.get(role.id || role));
          }
        });
        this.$store.commit("players/setFabled", { fabled });
      }
      this.isCustom = false;
    },
    parseStates(roles) {
      if (!roles || !roles.length) return;
      roles = roles.map(role => typeof role === "string" ? { id: role } : role);
      const metaIndex = roles.findIndex(({ id }) => id === "_meta");
      let meta = {};
      if (metaIndex > -1) {
        meta = roles.splice(metaIndex, 1).pop();
      }
      //状态
      const states = [];
      if (meta.state){
        meta.state.forEach(state => {
          states.push({[state.stateName] : state.stateDescription});
        })
      } else if (meta.status){
        meta.status.forEach(state => {
          states.push({[state.name] : state.skill});
        })
      }
      this.$store.commit("setStates", states);
      // 角色类型名字
      const names = {
        townsfolk: meta.townsfolksName ? meta.townsfolksName : "镇民",
        outsider: meta.outsidersName ? meta.outsidersName : "外来者",
        minion: meta.minionsName ? meta.minionsName : "爪牙",
        demon: meta.demonsName ? meta.demonsName : "恶魔"
      }
      this.$store.commit("setTeamsNames", names);
      // 夜间顺序
      if (!!meta.firstNight && meta.firstNight.length > 0) {
        const firstNight = meta.firstNight.map(role => role.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""));
        this.$store.commit("setFirstNight", firstNight);
      } else {
        this.$store.commit("setFirstNight", []);
      }
      if (!!meta.otherNight && meta.otherNight.length > 0) {
        const otherNight = meta.otherNight.map(role => role.toLocaleLowerCase().replace(/[^a-z0-9]/g, ""));
        this.$store.commit("setOtherNight", otherNight);
      } else {
        this.$store.commit("setOtherNight", []);
      }
    },
    setHomeEdition(edition) {
      if (["tb", "bmr", "snv", "luf", "all", "custom_ankot"].includes(edition.id)) this.$store.commit("setStates", []);
      this.setEdition(edition, this.selectedEditions);
    },
    ...mapMutations(["toggleModal", "setEdition"])
  }
};
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
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000, 0 0 5px rgba(0, 0, 0, 0.75);
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
