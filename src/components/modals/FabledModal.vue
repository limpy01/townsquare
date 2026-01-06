<template>
  <Modal v-if="modals.fabled && fabled.length" @close="toggleModal('fabled')">
    <h3>
      选择一个传奇角色
    </h3>
    <ul class="tokens">
      <li v-for="role in fabled" :key="role.id" @click="setFabled(role)"
        :style="tokenWidth">
        <Token :role="role" />
      </li>
    </ul>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";
import Token from "../Token";

export default {
  components: { Token, Modal },
  computed: {
    ...mapState(["modals", "fabled", "grimoire"]),
    fabled() {
      const fabled = [];
      this.$store.state.fabled.forEach(role => {
        // don't show fabled that are already in play
        if (
          !this.$store.state.players.fabled.some(fable => fable.id === role.id) || role.id === "deusexfiascoold2" // 失败的上帝（非官方）可以循环使用
        ) {
          fabled.push(role);
        }
      });
      return fabled;
    },
    tokenWidth() {
      const percentage = 0.06
      const width = percentage * this.windowWidth;
      return width >= 80 ? "width: 6vw" : "width: 80px";
    },
  },
  data(){
    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    }
  },
  mounted(){
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy(){
    window.removeEventListener("resize", this.handleResize);
  },
  methods: {
    setFabled(role) {
      this.$store.commit("players/setFabled", {
        fabled: role
      });
      this.$store.commit("toggleModal", "fabled");
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

ul.tokens li {
  border-radius: 50%;
  // width: 120px;
  margin: 0.5%;
  transition: transform 500ms ease;

  &:hover {
    transform: scale(1.2);
    z-index: 10;
  }
}
</style>
