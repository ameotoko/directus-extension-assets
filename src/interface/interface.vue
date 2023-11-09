<template>
</template>

<script setup lang="ts">
import 'cropperjs/src/css/cropper.css';
import { onMounted, ref } from 'vue';
import Cropper from 'cropperjs';

const props = defineProps({
  value: { type: String, default: null }
});

const emit = defineEmits(['input']);

const cropper = ref<Cropper | null>(null);
const image = ref<HTMLImageElement | null>(null);

onMounted(() => {

  // Give img time to load its base64 src
  setTimeout(() => {
    image.value = document.querySelector('.file-preview-replace .image img') as HTMLImageElement | null;

    try {
      cropper.value = new Cropper(image.value, {
        modal: false,
        highlight: false,
        autoCrop: !!props.value,
        rotatable: false,
        zoomable: false,
        zoomOnWheel: false,
        toggleDragModeOnDblclick: false,
        ready: onCropperReady,
        cropend: onCropEnd
      });
    } catch (e) {}
  }, 500);
});

function onCropperReady() {
  props.value && cropper.value?.setData(
      fractionsToPixels(<Cropper.SetDataOptions>props.value)
  );

  // double-click inside crop area to delete it
  document
      .querySelector<HTMLDivElement>('.cropper-crop-box')
      .addEventListener('dblclick', resetCrop);
}

function onCropEnd(): void {
  emit('input', pixelsToFractions(cropper.value?.getData()));
}

function resetCrop() {
  cropper.value?.clear();
  emit('input', null);
}

function pixelsToFractions(cropArea: Cropper.SetDataOptions) {
  const data: Cropper.SetDataOptions = {
    x: Math.max(0, Math.min(1, cropArea.x / image.value?.width)),
    y: Math.max(0, Math.min(1, cropArea.y / image.value?.height))
  };

  data.width = Math.min(1 - data.x, cropArea.width / image.value?.width);
  data.height = Math.min(1 - data.y, cropArea.height / image.value?.height);

  return data;
}

function fractionsToPixels(cropArea: Cropper.SetDataOptions) {
  const data: Cropper.SetDataOptions = {
    x: Math.round(cropArea.x * image.value?.width),
    y: Math.round(cropArea.y * image.value?.height),
    width: Math.round(cropArea.width * image.value?.width),
    height: Math.round(cropArea.height * image.value?.height),
  };

  return data;
}
</script>

<style>
.file-preview-replace .image {
  position: relative;
  width: max-content;
}
</style>
