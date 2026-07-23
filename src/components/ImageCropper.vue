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
          <div v-if="warning" style="color: red">
            <span>{{ warning }}</span>
          </div>
          <div>
            <button @click="startCropping" :disabled="disabled.startCropping">裁剪</button>
            <button @click="startMoving" :disabled="disabled.startMoving">移动</button>
            <button @click="cropImage" :disabled="disabled.cropImage">预览</button>
            <button @click="sendImage" :disabled="disabled.sendImage">确定</button>
            <button @click="closeCropping" :disabled="disabled.closeCropping">关闭</button>
          </div>
          <div v-if="croppedImage && preview">
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
import { apiBase } from "../config";
import { showInputModal } from "../services/input-modal";

export default {
  data() {
    return {
      image: null,
      croppedImage: null,
      cropper: null,
      cropping: false,
      preview: false,
      warning: "",
      disabled: {
        startCropping: false,
        startMoving: false,
        cropImage: false,
        sendImage: false
      }
    };
  },
  computed: {
    ...mapState(["session"])
  },
  methods: {
    showInputModal,
    async uploadAvatar() {
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
      this.preview = true;
      this.warning = "";
      const canvas = this.cropper.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
      this.croppedImage = canvas.toDataURL('image/webp', 0.85);
    },
    async sendImage() {
      this.preview = false;
      this.warning = "";
      for (const button in this.disabled) {
        this.disabled[button] = true;
      }
      const canvas = this.cropper.getCroppedCanvas({
        width: 512,
        height: 512,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high'
      });
      this.croppedImage = canvas.toDataURL('image/webp', 0.85)
      const maxBase64Length = 1 * 1024 * 1024 * (4 / 3);
      if (this.croppedImage.length > maxBase64Length) {
        this.warning = "图片过大，请选择更小的图片进行上传！"
      } else {
        // this.$store.commit("session/setPlayerAvatar", this.croppedImage);
        try {
          const response = await fetch(`${apiBase}/upload/avatar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              playerId: this.session.playerId,
              uploadContent: this.croppedImage
            })
          });
          const result = await response.json();
          if (!response.ok || result.status !== "success") {
            this.warning = "图片上传失败！请重试！";
          } else {
            this.$store.commit("session/updatePlayerAvatar", result.avatarUrl);
            this.closeCropping();
            await this.showInputModal({
              inputType: "alert",
              inputModal: "text",
              inputData: {
                name: ["头像上传成功！"],
              }
            }).catch(() => {
              return null;
            });
          }
        } catch (e) {
          this.warning = "图片上传失败！请重试！";
          for (const button in this.disabled) {
            this.disabled[button] = false;
          }
        }
      }
    },
    closeCropping() {
      this.cropping = false;
      this.$refs.upload.value = '';
      this.image = null;
      this.croppedImage = null;
      this.cropper = null;
      this.warning = "";
      this.preview = false;
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
