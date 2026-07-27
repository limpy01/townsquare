<template>
  <transition name="modal-fade">
    <div v-show="props.visible" class="modal-backdrop" @click="closeCheck">
      <div
        class="modal"
        :class="{ maximized: isMaximized, [props.name]: true }"
        role="dialog"
        aria-labelledby="modalTitle"
        aria-describedby="modalDescription"
        @click.stop=""
      >
        <div class="top-right-buttons" v-if="props.name != 'input'">
          <font-awesome-icon
            @click="isMaximized = !isMaximized"
            class="top-right-button"
            :icon="['fas', isMaximized ? 'window-minimize' : 'window-maximize']"
          />
          <font-awesome-icon
            @click="close"
            class="top-right-button"
            icon="times-circle"
          />
        </div>
        <div class="slot">
          <slot></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    name?: string;
    type?: string;
    visible?: boolean;
  }>(),
  {
    name: "",
    type: "",
    visible: true,
  },
);

const emit = defineEmits<{ close: [] }>();
const isMaximized = ref(false);

function close() {
  emit("close");
}

function closeCheck() {
  // 输入时点击背景不关闭
  if (props.name === "input" && props.type === "input") return;
  close();
}
</script>

<style lang="scss">
@use "../../styles/modal";
</style>
