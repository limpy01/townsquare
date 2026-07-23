<template>
  <Modal v-if="modals.legal" class="legal" @close="toggleModal('legal')">
    <h3 id="modalTitle">法律与署名</h3>
    <p>
      Copyright (C) 2026 @limpy01
      <a href="mailto:admin@botcgrimoire.top">&lt;admin@botcgrimoire.top&gt;</a>
    </p>
    <p>
      本项目包含由 limpy01 开发的重大修改和原创增强，并基于
      <a
        href="https://github.com/bra1n/townsquare"
        target="_blank"
        rel="noreferrer"
        >bra1n/townsquare</a
      >
      的开源作品继续开发。
    </p>
    <p>
      本项目采用带有 GPLv3 第 7 条附加署名要求的 GPL-3.0-or-later
      许可证；分发时必须保留作者署名、终端版权告知和本入口。
    </p>
    <p>完整许可证与来源说明见仓库中的 LICENSE 和 PROVENANCE.md。</p>
  </Modal>
</template>

<script>
import { mapMutations, mapState } from "vuex";
import Modal from "./Modal";

export default {
  components: { Modal },
  computed: mapState(["modals"]),
  methods: mapMutations(["toggleModal"]),
};
</script>

<style scoped lang="scss">
.legal {
  max-width: 42rem;
  line-height: 1.55;
}
</style>
