<script setup>
import { ref, computed } from 'vue';
import { formatNavigationTarget } from './utils/urlHelper.js';

// Change this to 'web', 'electron', or 'tauri' depending on your build target
const RUNTIME = 'web'; 

const tabs = ref([
  { id: 1, title: 'New Tab', url: 'about:blank', history: ['about:blank'], historyIndex: 0 }
]);
const activeTabId = ref(1);
const addressInput = ref('');
const webviewRef = ref(null); // Used for Electron <webview>

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));
const canGoBack = computed(() => activeTab.value.historyIndex > 0);
const canGoForward = computed(() => activeTab.value.historyIndex < activeTab.value.history.length - 1);

function navigate(rawInput = addressInput.value) {
  const targetUrl = formatNavigationTarget(rawInput);
  const tab = activeTab.value;

  // Trim forward history if navigating to a new page after going back
  tab.history = tab.history.slice(0, tab.historyIndex + 1);
  tab.history.push(targetUrl);
  tab.historyIndex++;

  tab.url = targetUrl;
  tab.title = targetUrl === 'about:blank' ? 'New Tab' : targetUrl;
  addressInput.value = targetUrl === 'about:blank' ? '' : targetUrl;
}

function goBack() {
  if (RUNTIME === 'electron' && webviewRef.value?.canGoBack()) {
    webviewRef.value.goBack();
    return;
  }
  if (canGoBack.value) {
    activeTab.value.historyIndex--;
    const prevUrl = activeTab.value.history[activeTab.value.historyIndex];
    activeTab.value.url = prevUrl;
    addressInput.value = prevUrl === 'about:blank' ? '' : prevUrl;
  }
}

function goForward() {
  if (RUNTIME === 'electron' && webviewRef.value?.canGoForward()) {
    webviewRef.value.goForward();
    return;
  }
  if (canGoForward.value) {
    activeTab.value.historyIndex++;
    const nextUrl = activeTab.value.history[activeTab.value.historyIndex];
    activeTab.value.url = nextUrl;
    addressInput.value = nextUrl === 'about:blank' ? '' : nextUrl;
  }
}

function createNewTab() {
  const newId = Date.now();
  tabs.value.push({ id: newId, title: 'New Tab', url: 'about:blank', history: ['about:blank'], historyIndex: 0 });
  activeTabId.value = newId;
  addressInput.value = '';
}
</script>

<template>
  <div class="loonakulf-shell">
    <!-- Tab Strip -->
    <header class="tabs">
      <button v-for="tab in tabs" :key="tab.id" @click="activeTabId = tab.id">
        {{ tab.title }}
      </button>
      <a href="#" @click.prevent="createNewTab">+ New Tab</a>
    </header>

    <!-- Navigation & Address Bar -->
    <form class="toolbar" @submit.prevent="navigate()">
      <button type="button" :disabled="!canGoBack" @click="goBack">←</button>
      <button type="button" :disabled="!canGoForward" @click="goForward">→</button>
      <input v-model="addressInput" placeholder="Search or enter URL (about:blank)" />
      <button type="submit">Go</button>
    </form>

    <!-- Viewport Switcher -->
    <main class="viewport">
      <!-- Blank / New Tab Screen -->
      <div v-if="activeTab.url === 'about:blank'" class="new-tab-screen">
        <h1>Loonakulf Browser</h1>
        <p>Enter a URL above to start browsing.</p>
      </div>

      <!-- Option A: Web Simulator -->
      <iframe v-else-if="RUNTIME === 'web'" :src="activeTab.url" class="frame"></iframe>

      <!-- Option B: Electron Desktop App -->
      <webview v-else-if="RUNTIME === 'electron'" ref="webviewRef" :src="activeTab.url" class="frame"></webview>
    </main>
  </div>
</template>
