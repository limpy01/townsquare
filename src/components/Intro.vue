<template>
  <div class="intro">
    <img src="/static/apple-icon.png" alt="" class="logo" />
    <div>
      欢迎来到城镇广场。 请点击右上角处
      <span class="button" @click="toggleMenu">
        <font-awesome-icon icon="cog" /> 菜单
      </span>
      工具进行浏览。点击
      <span class="button" @click="hostSession"> 创建房间 </span>
      <b>[H]</b>开始说书，或者
      <span class="button" @click="joinSession"> 加入房间 </span>
      <b>[J]</b>进入已有的房间。<br />
      <div class="footer">
        <span>
          这个项目是免费和开源的，原版源码可以在
          <a href="https://github.com/bra1n/townsquare" target="_blank"
            >GitHub</a
          >
          上找到，本项目对其进行了修改。本项目是非官方项目，旨在交流网站构建和应用。该网站为私人项目，仅供测试及展示。
        </span>
        <br />
        <span
          >如有bug反馈、建议、其他需求，请联系<a
            href="mailto:admin@botcgrimoire.top"
            >admin@botcgrimoire.top</a
          ></span
        >
      </div>
    </div>
    <!-- <a
      class="redirect"
      v-if="language === 'zh-CN'"
      href="https://clocktower.gstonegames.com"
    >
      <img src="../assets/gstone.png" class="gstone" alt="" />
      官方中文魔典请由此进入
    </a> -->
  </div>
</template>

<script setup lang="ts">
import { useGrimoireStore } from "../stores/grimoire";

const emit = defineEmits<{
  trigger: [command: ["hostSession" | "joinSession"]];
}>();
const grimoire = useGrimoireStore();

function hostSession() {
  emit("trigger", ["hostSession"]);
}

function joinSession() {
  emit("trigger", ["joinSession"]);
}

function toggleMenu() {
  grimoire.toggle("isMenuOpen");
}
</script>

<style lang="scss">
@use "../styles/intro";
</style>
