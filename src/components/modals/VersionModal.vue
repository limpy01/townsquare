<template>
  <Modal v-if="modals.version" @close="close">
    <h3>更新日志</h3>
    <div v-if="version != latestVersion">
      <span class="warning">
        当前版本并非最新版本（{{ latestVersion }}），请尝试清空缓存获取最新版本！
      </span>
    </div>
    <div
      v-for="version in changelog"
      :key="version.id"
      class="versions"
    >
      <h4>{{ version.name }}</h4>
      <ul>
        <li v-for="(item, index) in version.changelog" :key="index">
          <span>{{ item }}</span>
          <br/>
        </li>
      </ul>
    </div>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import versionJSON from '../../version.json';

export default {
  components: { Modal },
  computed: {
    ...mapState(["modals", "grimoire", "session"]),
    ...mapState(["version", "latestVersion", "lastVersion"])
  },
  data(){
    return {
      changelog: versionJSON,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }
  },
  // watch: {
  //   'modals.version'(isOpen) {
  //     if (isOpen) {
  //       this.checkLatestVersion();
  //     }
  //   }
  // },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    close() {
      if (this.version != this.lastVersion) this.$store.commit("setLastVersion", this.version); 
      this.$store.commit("toggleModal", "version");
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

.versions {
  text-align: left; 

  h4 {
    text-align: left; 
    margin-bottom: 10px;
    padding-left: 5px;
  }

  ul {
    list-style-type: disc;
    list-style-position: outside; 
    
    display: block;  
    flex-wrap: initial;
    
    padding-left: 25px; 
    margin-top: 5px;
    margin-bottom: 0; 
  }
  
  li {
    text-align: left; 
    line-height: 1.5;
    
    display: list-item;
    
    margin-bottom: 5px; 
  }
}

.warning {
  color: red;
}
</style>