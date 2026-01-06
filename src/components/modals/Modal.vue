<template>
  <transition name="modal-fade">
    <div class="modal-backdrop" @click="closeCheck">
      <div
        class="modal"
        :class="{ maximized: isMaximized, [name]: true }"
        role="dialog"
        aria-labelledby="modalTitle"
        aria-describedby="modalDescription"
        @click.stop=""
      >
        <div class="top-right-buttons" v-if="name != 'input'">
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

<script>
export default {
  props: {
    name: {
      type: String,
      default: ""
    },
    type: {
      type: String,
      default: ""
    }
  },
  data: function() {
    return {
      isMaximized: false
    };
  },
  methods: {
    close() {
      this.$emit("close");
    },
    closeCheck() {
      // 输入时点击背景不关闭
      if (this.name === "input" && this.type === "input") return;
      this.close();
    }
  }
};
</script>

<style lang="scss">

/* width */
::-webkit-scrollbar {
  width: 5px;
}
/* Handle */
::-webkit-scrollbar-thumb {
  background: rgb(54, 54, 54); 
  border-radius: 10px;
}

/* Handle on hover */
::-webkit-scrollbar-thumb:hover {
  background: rgb(97, 97, 97); 
}

.modal-backdrop {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
}

.modal {
  background: rgba(0, 0, 0, 0.8);
  padding: 10px 20px;
  border-radius: 10px;
  box-shadow: 2px 2px 20px 1px #000;
  display: flex;
  flex-direction: column;
  max-height: 95%;
  max-width: 95%;
  overflow-y: auto;
  overflow-x: hidden;

  &.input {
    margin-top: -18vh;
  }

  .vote-history &,
  .night-reference &,
  .characters & {
    overflow-y: auto;
  }

  .roles &,
  .characters & {
    max-height: 100%;
    // max-width: 60%;
  }

  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    align-items: center;
    justify-content: center;
    line-height: 100%;
    max-width: 95%;
  }

  > .top-right-buttons {
    position: absolute;
    z-index: 100;
    top: 15px;
    right: 20px;
    > .top-right-button {
      cursor: pointer;
      width: 28px;
      &:hover {
        color: red;
      }
    }
  }

  > .slot {
    max-height: 100%;
    position: initial;
  }
}



.maximized {
  background: rgba(0, 0, 0, 0.95);
  padding: 0;
  border-radius: 0;
  height: 100%;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-content: center;
  justify-content: center;
  .roles &,
  .characters & {
    max-width: 100%;
    padding: 10px;
  }
}

.modal-fade-enter,
.modal-fade-leave-active {
  opacity: 0;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
</style>
