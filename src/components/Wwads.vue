<script setup>
import { onMounted, ref } from 'vue';

defineProps({
  horizontal: {
    type: Boolean,
    default: true
  },
});

const loaded = ref(false);

onMounted(() => {
  // Ensure wwads script is loaded
  if (!document.querySelector('script[src*="wwads"]')) {
    const script = document.createElement('script');
    script.src = 'https://cdn.wwads.cn/js/makemoney.js';
    script.async = true;
    document.head.appendChild(script);
  }
  // Mark as loaded after a short delay to allow the ad to render
  setTimeout(() => {
    loaded.value = true;
  }, 500);
});
</script>

<template>
  <div class="wwads-wrapper">
    <div
      class="wwads-cn container"
      :class="horizontal ? 'wwads-horizontal' : 'wwads-vertical'"
      data-id="264"
    ></div>
  </div>
</template>

<style scoped>
.wwads-wrapper {
  margin: 0 auto;
  max-width: 100%;
}

:deep(.wwads-cn) {
  color: var(--wwads-text-color, #374151);
  background-color: rgba(255, 255, 255, 0.8) !important;
  border-radius: 1rem;
  border: 1px solid rgb(243 244 246);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  backdrop-filter: blur(24px);
  padding: 16px;
}

:deep(.wwads-text) {
  color: var(--wwads-text-color, #374151) !important;
}

:deep(.wwads-hide) {
  color: #9ca3af !important;
}

:deep(.wwads-poweredby) {
  color: #9ca3af !important;
}

:deep(.wwads-img img) {
  border-radius: 0.5rem;
}

/* Dark mode support */
:global(.dark) :deep(.wwads-cn) {
  color: #e5e7eb !important;
  background-color: rgba(31, 41, 55, 0.8) !important;
  border-color: rgb(55 65 81);
}

:global(.dark) :deep(.wwads-text) {
  color: #e5e7eb !important;
}

:global(.dark) :deep(.wwads-hide) {
  color: #6b7280 !important;
}

:global(.dark) :deep(.wwads-poweredby) {
  color: #6b7280 !important;
}
</style>
