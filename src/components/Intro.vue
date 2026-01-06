<template>
  <div class="intro">
    <img src="static/apple-icon.png" alt="" class="logo" />
    <div>
      欢迎来到城镇广场。
      请点击右上角处
      <span class="button" @click="toggleMenu">
        <font-awesome-icon icon="cog" /> 菜单
      </span>
      工具进行浏览。点击
      <span class="button" @click="hostSession()">
         创建房间
      </span>
       <b>[H]</b>开始说书，或者
      <span class="button" @click="joinSession()">
         加入房间
      </span>
       <b>[J]</b>进入已有的房间。<br />
      <div class="footer">
        <span>
          这个项目是免费和开源的，原版源码可以在
          <a href="https://github.com/bra1n/townsquare" target="_blank">GitHub</a>
          上找到，本项目对其进行了修改。本项目是非官方项目，旨在交流网站构建和应用。该网站为私人项目，仅供测试及展示。
        </span>
        <br/>
        <span>如有bug反馈、建议、其他需求，请联系<a href="mailto:admin@botcgrimoire.top">admin@botcgrimoire.top</a></span>
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

<script>
import { mapMutations } from "vuex";

export default {
  data() {
    return {
      language: window.navigator.userLanguage || window.navigator.language
    };
  },
  methods: {
    hostSession() {
      this.$emit("trigger", ["hostSession"]);
    },
    joinSession () {
      this.$emit("trigger", ["joinSession"]);
    },
    ...mapMutations(["toggleMenu"])
  }
};
</script>

<style scoped lang="scss">
// Intro
.intro {
  text-align: center;
  width: 50%;
  font-size: 120%;
  position: absolute;
  padding: 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 3px solid black;
  border-radius: 10px;
  z-index: 3;
  display: flex;
  justify-content: center;
  a {
    color: white;
  }
  a.redirect {
    display: block;
    text-decoration: none;
    position: absolute;
    top: 100%;
    margin-top: 2vh;
    padding: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: 3px solid black;
    border-radius: 10px;

    &:hover {
      color: red;
    }
    img {
      width: 120px;
      display: block;
      margin: auto;
      margin-bottom: 1vh;
    }
  }

  img.logo {
    position: absolute;
    bottom: 100%;
    width: 25vh;
    margin-bottom: 2vh;
    max-width: 192px;
    border-radius: 50%;
    box-shadow: 0 0 10px black;
    border: 3px solid black;
  }
  .footer {
    font-size: 60%;
    opacity: 0.75;
  }
}
</style>
