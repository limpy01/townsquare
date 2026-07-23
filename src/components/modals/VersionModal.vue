<template>
  <Modal v-if="modals.version" @close="close">
    <h3>更新日志</h3>
    <div v-if="appMeta.version != appMeta.latestVersion">
      <span class="warning">
        当前版本并非最新版本（{{
          appMeta.latestVersion
        }}），请尝试清空缓存获取最新版本！
      </span>
    </div>
    <div>
      <h4>作者的话</h4>
      <div>
        <span
          >官方wiki已将试运营相克收录进相克列表，但是作者觉得很多都很烂，所以魔典不予收录。</span
        >
        <br />
        <span>如需启用这些新相克请手动添加至json。：）</span>
        <br />
      </div>
      <br />
    </div>
    <div v-for="version in changelog" :key="version.id" class="versions">
      <h4>{{ version.name }}</h4>
      <ul>
        <li v-for="(item, index) in version.changelog" :key="index">
          <span>{{ item }}</span>
          <br />
        </li>
      </ul>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Modal from "./Modal.vue";
import versionJSON from "../../version.json";
import { useAppMetaStore } from "../../stores/app-meta";
import { useModalStore } from "../../stores/modals";

const appMeta = useAppMetaStore();
const modals = useModalStore();
const changelog = versionJSON;
const windowWidth = ref(window.innerWidth);
const windowHeight = ref(window.innerHeight);

function close() {
  if (appMeta.version !== appMeta.lastVersion) {
    appMeta.setLastVersion(appMeta.version);
  }
  modals.toggle("version");
}

function handleResize() {
  windowWidth.value = window.innerWidth;
  windowHeight.value = window.innerHeight;
}

onMounted(() => window.addEventListener("resize", handleResize));
onBeforeUnmount(() => window.removeEventListener("resize", handleResize));
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
