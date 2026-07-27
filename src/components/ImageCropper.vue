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
          <img :src="image" ref="imageElement" alt="Image to crop" />
          <div v-if="warning" style="color: red">
            <span>{{ warning }}</span>
          </div>
          <div>
            <button @click="startCropping" :disabled="disabled.startCropping">
              裁剪
            </button>
            <button @click="startMoving" :disabled="disabled.startMoving">
              移动
            </button>
            <button @click="cropImage" :disabled="disabled.cropImage">
              预览
            </button>
            <button @click="sendImage" :disabled="disabled.sendImage">
              确定
            </button>
            <button @click="closeCropping" :disabled="disabled.closeCropping">
              关闭
            </button>
          </div>
          <div v-if="croppedImage && preview">
            <img :src="croppedImage" alt="Cropped Image" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import { apiBase } from "../config";
import { showInputModal } from "../services/input-modal";
import { emitGameEvent } from "../store/game-events";
import { useProfileStore } from "../stores/profile";
import { useSessionIdentityStore } from "../stores/session-identity";

const session = useSessionIdentityStore();
const profile = useProfileStore();
const upload = ref<HTMLInputElement | null>(null);
const imageElement = ref<HTMLImageElement | null>(null);
const image = ref<string | null>(null);
const croppedImage = ref<string | null>(null);
const cropper = ref<Cropper | null>(null);
const cropping = ref(false);
const preview = ref(false);
const warning = ref("");
const disabled = ref({
  startCropping: false,
  startMoving: false,
  cropImage: false,
  sendImage: false,
  closeCropping: false,
});

async function uploadAvatar() {
  upload.value?.click();
}
function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      image.value = String(e.target?.result ?? "");
      nextTick(initCropper);
    };
    reader.readAsDataURL(file);
  }
  cropping.value = true;
}
function initCropper() {
  cropper.value?.destroy();
  if (!imageElement.value) return;
  cropper.value = new Cropper(imageElement.value, {
    aspectRatio: 1,
    viewMode: 1,
    autoCrop: false,
    autoCropArea: 1,
    dragMode: "move",
    rotatable: false,
  });
}
function startCropping() {
  cropper.value?.setDragMode("crop");
}
function startMoving() {
  cropper.value?.setDragMode("move");
  cropper.value?.clear();
}
function getCanvas() {
  return cropper.value?.getCroppedCanvas({
    width: 512,
    height: 512,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });
}
function cropImage() {
  const canvas = getCanvas();
  if (!canvas) return;
  preview.value = true;
  warning.value = "";
  croppedImage.value = canvas.toDataURL("image/webp", 0.85);
}
async function sendImage() {
  preview.value = false;
  warning.value = "";
  for (const button of Object.keys(
    disabled.value,
  ) as (keyof typeof disabled.value)[])
    disabled.value[button] = true;
  const canvas = getCanvas();
  if (!canvas) return;
  croppedImage.value = canvas.toDataURL("image/webp", 0.85);
  const maxBase64Length = 1 * 1024 * 1024 * (4 / 3);
  if (croppedImage.value.length > maxBase64Length) {
    warning.value = "图片过大，请选择更小的图片进行上传！";
  } else {
    try {
      const response = await fetch(`${apiBase}/upload/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: session.playerId,
          uploadContent: croppedImage.value,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "success") {
        warning.value = "图片上传失败！请重试！";
      } else {
        profile.updatePlayerAvatar(result.avatarUrl);
        emitGameEvent("session/updatePlayerAvatar", result.avatarUrl);
        closeCropping();
        await showInputModal({
          inputType: "alert",
          inputModal: "text",
          inputData: {
            name: ["头像上传成功！"],
          },
        }).catch(() => null);
      }
    } catch {
      warning.value = "图片上传失败！请重试！";
      for (const button of Object.keys(
        disabled.value,
      ) as (keyof typeof disabled.value)[])
        disabled.value[button] = false;
    }
  }
}
function closeCropping() {
  cropping.value = false;
  if (upload.value) upload.value.value = "";
  image.value = null;
  croppedImage.value = null;
  cropper.value = null;
  warning.value = "";
  preview.value = false;
}
defineExpose({ uploadAvatar });
</script>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgb(0 0 0 / 20%);
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
  overflow: scroll;
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
  overflow: hidden scroll;
}
</style>
