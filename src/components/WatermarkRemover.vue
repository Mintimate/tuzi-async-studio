<script setup>
import { createWatermarkEngine, removeWatermarkFromImage } from '@pilio/gemini-watermark-remover/browser';
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const emit = defineEmits(['log']);

// 状态
const isDragging = ref(false);
const isProcessing = ref(false);
const uploadedFiles = ref([]); // { file, originalUrl, processedUrl, processedBlob, status, name, error }
const engine = ref(null);

// 初始化引擎
const getEngine = async () => {
  if (!engine.value) {
    engine.value = await createWatermarkEngine();
  }
  return engine.value;
};

// 处理文件选择
const fileInputRef = ref(null);

const handleFileSelect = (e) => {
  const files = Array.from(e.target.files);
  if (files.length > 0) {
    addFiles(files);
  }
  // 重置 input 以便重复选择同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const handleDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  if (files.length > 0) {
    addFiles(files);
  }
};

const handleDragOver = (e) => {
  e.preventDefault();
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const addFiles = (files) => {
  const validFiles = files.filter(f => {
    return f.type.match(/^image\/(jpeg|png|webp)$/) && f.size <= 20 * 1024 * 1024;
  });

  if (validFiles.length === 0) {
    emit('log', { content: t('watermark.logs.invalidFile'), type: 'warning' });
    return;
  }

  for (const file of validFiles) {
    const originalUrl = URL.createObjectURL(file);
    uploadedFiles.value.push({
      file,
      name: file.name,
      originalUrl,
      processedUrl: null,
      processedBlob: null,
      status: 'pending', // pending | processing | done | error
      error: null
    });
  }

  emit('log', { content: t('watermark.logs.filesAdded', { count: validFiles.length }), type: 'info' });

  // 自动开始处理
  processAllFiles();
};

const processAllFiles = async () => {
  const pendingFiles = uploadedFiles.value.filter(f => f.status === 'pending');
  if (pendingFiles.length === 0) return;

  isProcessing.value = true;
  emit('log', { content: t('watermark.logs.startProcessing', { count: pendingFiles.length }), type: 'info' });

  try {
    const eng = await getEngine();

    for (const item of pendingFiles) {
      item.status = 'processing';
      try {
        // 加载图片
        const img = await loadImage(item.file);
        // 去水印
        const result = await removeWatermarkFromImage(img, { engine: eng });
        const canvas = result.canvas;
        const meta = result.meta;

        // 转为 Blob
        const blob = await canvasToBlob(canvas);
        item.processedUrl = URL.createObjectURL(blob);
        item.processedBlob = blob;
        item.status = 'done';

        const statusText = meta?.applied ? t('watermark.logs.removed') : t('watermark.logs.noWatermark');
        emit('log', { content: `${item.name}: ${statusText}`, type: 'success' });
      } catch (err) {
        item.status = 'error';
        item.error = err.message;
        emit('log', { content: `${item.name}: ${t('watermark.logs.processFailed')} - ${err.message}`, type: 'error' });
      }
    }
  } catch (err) {
    emit('log', { content: t('watermark.logs.engineFailed') + ': ' + err.message, type: 'error' });
  } finally {
    isProcessing.value = false;
    emit('log', { content: t('watermark.logs.allDone'), type: 'success' });
  }
};

// 加载图片为 HTMLImageElement
const loadImage = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// Canvas 转 Blob
const canvasToBlob = (canvas) => {
  return new Promise((resolve, reject) => {
    // 优先使用 OffscreenCanvas 的 convertToBlob
    if (typeof canvas.convertToBlob === 'function') {
      canvas.convertToBlob({ type: 'image/png' }).then(resolve).catch(reject);
      return;
    }
    // 回退到 HTMLCanvasElement 的 toBlob
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob returned null'));
      }, 'image/png');
      return;
    }
    reject(new Error('Canvas does not support blob conversion'));
  });
};

// 下载单张图片
const downloadImage = (item) => {
  if (!item.processedUrl) return;
  const a = document.createElement('a');
  a.href = item.processedUrl;
  const baseName = item.name.replace(/\.[^.]+$/, '');
  a.download = `unwatermarked_${baseName}.png`;
  a.click();
};

// 下载全部
const downloadAll = () => {
  const doneFiles = uploadedFiles.value.filter(f => f.status === 'done');
  doneFiles.forEach(item => downloadImage(item));
};

// 移除单个文件
const removeFile = (index) => {
  const item = uploadedFiles.value[index];
  if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
  if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
  uploadedFiles.value.splice(index, 1);
};

// 清空全部
const clearAll = () => {
  uploadedFiles.value.forEach(item => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
  });
  uploadedFiles.value = [];
};

// 组件卸载时清理
onBeforeUnmount(() => {
  uploadedFiles.value.forEach(item => {
    if (item.originalUrl) URL.revokeObjectURL(item.originalUrl);
    if (item.processedUrl) URL.revokeObjectURL(item.processedUrl);
  });
});
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- 上传区域 -->
    <div
      @click="fileInputRef?.click()"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      :class="[
        'relative flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200',
        isDragging
          ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500 bg-gray-50/50 dark:bg-gray-700/30 hover:bg-emerald-50/50 dark:hover:bg-gray-700/50'
      ]"
    >
      <div class="flex flex-col items-center justify-center">
        <div class="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-3">
          <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-300">{{ t('watermark.upload.text') }}</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ t('watermark.upload.hint') }}</p>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        class="hidden"
        @change="handleFileSelect"
      />
    </div>

    <!-- 处理状态 -->
    <div v-if="isProcessing" class="flex items-center justify-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
      <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ t('watermark.processing') }}
    </div>

    <!-- 操作按钮 -->
    <div v-if="uploadedFiles.length > 0" class="flex items-center justify-between">
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('watermark.fileCount', { total: uploadedFiles.length, done: uploadedFiles.filter(f => f.status === 'done').length }) }}
      </span>
      <div class="flex gap-2">
        <button
          v-if="uploadedFiles.some(f => f.status === 'done')"
          @click="downloadAll"
          class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {{ t('watermark.downloadAll') }}
        </button>
        <button
          @click="clearAll"
          class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          {{ t('watermark.clearAll') }}
        </button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="uploadedFiles.length > 0" class="space-y-4">
      <div
        v-for="(item, index) in uploadedFiles"
        :key="index"
        class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
      >
        <div class="flex flex-col sm:flex-row">
          <!-- 图片预览 -->
          <div class="flex gap-2 p-3 sm:p-4 flex-1 min-w-0">
            <!-- 原图 -->
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">{{ t('watermark.original') }}</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                <img :src="item.originalUrl" class="max-w-full max-h-full object-contain" :alt="item.name" />
              </div>
            </div>
            <!-- 箭头 -->
            <div class="flex items-center justify-center px-1 sm:px-2 self-center mt-5">
              <svg class="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <!-- 处理后 -->
            <div class="flex-1 min-w-0">
              <p class="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">{{ t('watermark.result') }}</p>
              <div class="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden aspect-video flex items-center justify-center">
                <template v-if="item.status === 'done'">
                  <img :src="item.processedUrl" class="max-w-full max-h-full object-contain" :alt="'processed_' + item.name" />
                </template>
                <template v-else-if="item.status === 'processing'">
                  <svg class="animate-spin w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </template>
                <template v-else-if="item.status === 'error'">
                  <div class="text-center p-2">
                    <svg class="w-6 h-6 text-red-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-xs text-red-400">{{ t('watermark.error') }}</p>
                  </div>
                </template>
                <template v-else>
                  <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('watermark.waiting') }}</p>
                </template>
              </div>
            </div>
          </div>

          <!-- 操作栏 -->
          <div class="flex sm:flex-col items-center justify-end gap-2 p-3 sm:p-4 border-t sm:border-t-0 sm:border-l border-gray-100 dark:border-gray-700 sm:w-28">
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px] sm:max-w-full sm:text-center" :title="item.name">{{ item.name }}</p>
            <div class="flex sm:flex-col gap-1.5">
              <button
                v-if="item.status === 'done'"
                @click="downloadImage(item)"
                class="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                :title="t('watermark.download')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                @click="removeFile(index)"
                class="p-2 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                :title="t('watermark.remove')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 来源说明 -->
    <div class="text-center pt-4 border-t border-gray-100 dark:border-gray-700">
      <p class="text-xs text-gray-400 dark:text-gray-500">
        {{ t('watermark.poweredBy') }}
        <a href="https://github.com/GargantuaX/gemini-watermark-remover" target="_blank" class="text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 underline underline-offset-2">
          gemini-watermark-remover
        </a>
        (MIT License)
      </p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
        {{ t('watermark.privacyNote') }}
      </p>
    </div>
  </div>
</template>
