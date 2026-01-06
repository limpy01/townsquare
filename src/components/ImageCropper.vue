<template>
  <div>
    <div v-show="cropping" class="overlay">
      <div class="cropper-modal">
        <input 
          v-show="false"
          type="file" 
          ref="upload" 
          accept="image/*" 
          @change="onFileChange"
        />
        <div v-if="image" class="canvas">
          <img :src="image" ref="image" alt="Image to crop" />
          <div>
            <button @click="startCropping">裁剪</button>
            <button @click="startMoving">移动</button>
            <button @click="cropImage">预览</button>
            <button @click="sendImage">确定</button>
            <button @click="closeCropping">关闭</button>
          </div>
          <div v-if="croppedImage">
            <img :src="croppedImage" alt="Cropped Image" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>


<script>
import { mapState } from "vuex";
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

export default {
  data() {
    return {
      image: null,
      croppedImage: null,
      cropper: null,
      cropping: false
    };
  },
  computed: {
    ...mapState(["session"])
  },
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
    async uploadAvatar() {
      if (!this.session.sessionId) {
        await this.showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["头像上传成功！"],
          }
        }).catch(() => {
          return null;
        });
        return;
      }
      this.$refs.upload.click();
    },
    onFileChange(event) {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.image = e.target.result;
          this.$nextTick(() => {
            this.initCropper();
          });
        };
        reader.readAsDataURL(file);
      }
      this.cropping = true;
    },
    initCropper() {
      if (this.cropper) {
        this.cropper.destroy();
      }
      this.cropper = new Cropper(this.$refs.image, {
        aspectRatio: 1,
        viewMode: 1,
        autoCrop: false, 
        autoCropArea: 1,
        dragMode: 'move',
        rotatable: false
      });
    },
    startCropping() {
      this.cropper.setDragMode('crop');
    },
    startMoving() {
      this.cropper.setDragMode('move');
      this.cropper.clear();
    },
    cropImage() {
      const canvas = this.cropper.getCroppedCanvas();
      this.croppedImage = canvas.toDataURL('image/webp');
    },
    sendImage() {
      const canvas = this.cropper.getCroppedCanvas();
      this.croppedImage = canvas.toDataURL('image/webp')
      this.$store.commit("session/setPlayerAvatar", this.croppedImage);
      this.closeCropping();
    },
    closeCropping() {
      this.cropping = false;
      this.$refs.upload.value = '';
      this.image = null;
      this.croppedImage = null;
      this.cropper = null;
    }
  },
};
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.cropper-modal {
  background: #fff; /* Solid background */
  opacity: 1;
  padding: 20px;
  border-radius: 8px;
  position: relative;
  z-index: 1001; /* Ensures it stays on top of the overlay */
  width: 80%;
  height: 80%;
  max-width: 500px;
  overflow-x: scroll;
  overflow-y: scroll;
  display: flex;
  justify-content: center;
  /* align-items: center; */
}

.canvas {
  position: relative;
  width: 90%;
  height: 65%;
}

img {
  max-height: 100%;
  max-width: 100%;
  height: 100%;
  overflow-y: scroll;
  overflow-x: hidden;
}
</style>


