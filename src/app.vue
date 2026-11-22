<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { formatNavigationTarget, isBlank } from './utils/urlHelper.js';

const STORAGE_KEY = 'loonakulf_bookmarks_v1';

const defaultBookmarks = [
  { id: 1, name: 'Wikipedia', url: 'https://wikipedia.org' },
  { id: 2, name: 'Invert Colors', url: "javascript:(function(){document.body.style.filter='invert(1)';})()" },
  { id: 3, name: 'Word Count', url: "javascript:alert('Words: ' + document.body.innerText.split(/\\s+/).length)" }
];

const saved = localStorage.getItem(STORAGE_KEY);
const bookmarks = ref(saved ? JSON.parse(saved) : defaultBookmarks);

watch(bookmarks, (updated) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}, { deep: true });

// --- Multi-Tab State ---
const tabs = ref([
  { id: 'tab-1', title: 'New Tab', url: 'about:blank' }
]);
const activeTabId = ref('tab-1');
const addressInput = ref('');
const addressInputRef = ref(null);

const activeTab = computed(() => tabs.value.find(t => t.id === activeTabId.value));

async function createNewTab() {
  const newId = `tab-${Date.now()}`;
  tabs.value.push({ id: newId, title: 'New Tab', url: 'about:blank' });
  activeTabId.value = newId;
  addressInput.value = '';
  await invoke('switch_tab', { tabId: newId });
}

async function selectTab(tab) {
  activeTabId.value = tab.id;
  addressInput.value = tab.url === 'about:blank' ? '' : tab.url;
  await invoke('switch_tab', { tabId: tab.id });
}

async function removeTab(tabId) {
  await invoke('close_tab', { tabId });
  tabs.value = tabs.value.filter(t => t.id !== tabId);

  if (tabs.value.length === 0) {
    await createNewTab();
  } else if (activeTabId.value === tabId) {
    await selectTab(tabs.value[tabs.value.length - 1]);
  }
}

async function handleNavigation(rawTarget = addressInput.value) {
  const target = formatNavigationTarget(rawTarget);
  const tab = activeTab.value;

  // 1. Intercept javascript: bookmarklets
  if (target.toLowerCase().startsWith('javascript:')) {
    if (tab.url === 'about:blank') {
      alert('Open a webpage in this tab first before running a bookmarklet.');
      return;
    }
    const rawJs = decodeURIComponent(target.slice('javascript:'.length));
    await invoke('run_bookmarklet', { tabId: tab.id, code: rawJs });
    return;
  }

  // 2. Navigate active tab to URL
  tab.url = target;
  tab.title = target === 'about:blank' ? 'New Tab' : target.replace(/^https?:\/\//, '');
  addressInput.value = target === 'about:blank' ? '' : target;

  await invoke('navigate_tab', { tabId: tab.id, url: target });
}

// --- Back, Forward, Reload ---
async function triggerTabAction(action) {
  if (activeTab.value.url === 'about:blank') return;
  await invoke('tab_action', { tabId: activeTabId.value, action });
}

// --- Bookmarklet Studio Modal ---
const showEditor = ref(false);
const editorName = ref('');
const editorCode = ref('// Write multi-line JavaScript here\ndocument.body.style.backgroundColor = "#111";\ndocument.body.style.color = "#0f0";');

async function openEditor() {
  showEditor.value = true;
  await invoke('switch_tab', { tabId: 'none' });
}

async function closeEditor() {
  showEditor.value = false;
  await invoke('switch_tab', { tabId: activeTabId.value });
}

function compileBookmarklet(rawJs) {
  const cleaned = rawJs.trim();
  if (cleaned.toLowerCase().startsWith('javascript:')) return cleaned;
  return `javascript:(function(){${encodeURIComponent(cleaned)}})()`;
}

async function testEditorCode() {
  if (activeTab.value.url === 'about:blank') {
    alert('Load a webpage in your active tab first to test this script.');
    return;
  }
  const codeToRun = editorCode.value.trim();
  await closeEditor();
  await invoke('run_bookmarklet', { tabId: activeTabId.value, code: codeToRun });
}

async function saveEditorBookmarklet() {
  if (isBlank(editorName.value) || isBlank(editorCode.value)) {
    alert('Please enter both a name and JavaScript code.');
    return;
  }
  bookmarks.value.push({
    id: Date.now(),
    name: editorName.value.trim(),
    url: compileBookmarklet(editorCode.value)
  });
  editorName.value = '';
  await closeEditor();
}

function removeBookmark(id) {
  bookmarks.value = bookmarks.value.filter(bm => bm.id !== id);
}

// --- JSON Export & Import ---
const fileInputRef = ref(null);

function exportBookmarksJson() {
  const dataStr = JSON.stringify(bookmarks.value, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `loonakulf-bookmarklets-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();

  URL.revokeObjectURL(downloadUrl);
}

function triggerImportJson() {
  fileInputRef.value?.click();
}

function handleImportJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');

      const validItems = imported
        .filter(item => !isBlank(item?.name) && !isBlank(item?.url))
        .map(item => ({
          id: Date.now() + Math.random(),
          name: item.name.trim(),
          url: item.url.trim()
        }));

      bookmarks.value.push(...validItems);
      alert(`Imported ${validItems.length} bookmarks/bookmarklets!`);
    } catch {
      alert('Invalid JSON file. Expected an array of { name, url } objects.');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// --- Keyboard Shortcuts ---
function handleKeydown(e) {
  const isMod = e.ctrlKey || e.metaKey;

  if (isMod && e.key.toLowerCase() === 't') {
    e.preventDefault();
    createNewTab();
  } else if (isMod && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    removeTab(activeTabId.value);
  } else if (isMod && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    addressInputRef.value?.focus();
    addressInputRef.value?.select();
  } else if ((isMod && e.key.toLowerCase() === 'r') || e.key === 'F5') {
    e.preventDefault();
    triggerTabAction('reload');
  }
}

// --- Live URL & Title Syncing ---
let unlistenUrl = null;
let unlistenTitle = null;

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);

  unlistenUrl = await listen('tab-url-changed', (event) => {
    const { tab_id, url } = event.payload;
    const targetTab = tabs.value.find(t => t.id === tab_id);
    if (targetTab) {
      targetTab.url = url;
      if (activeTabId.value === tab_id) {
        addressInput.value = url;
      }
    }
  });

  unlistenTitle = await listen('tab-title-changed', (event) => {
    const { tab_id, title } = event.payload;
    const targetTab = tabs.value.find(t => t.id === tab_id);
    if (targetTab) {
      targetTab.title = title;
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (unlistenUrl) unlistenUrl();
  if (unlistenTitle) unlistenTitle();
});
</script>

<template>
  <div class="loonakulf-app">
    <!-- Top Browser Chrome (148px matches CHROME_HEIGHT = 148.0 in Rust) -->
    <header class="browser-chrome">
      <!-- Row 1: Tab Strip -->
      <div class="tab-strip">
        <div 
          v-for="tab in tabs" 
          :key="tab.id" 
          class="tab" 
          :class="{ active: tab.id === activeTabId }"
          @click="selectTab(tab)"
        >
          <span class="tab-title">{{ tab.title }}</span>
          <button type="button" class="close-tab" @click.stop="removeTab(tab.id)">×</button>
        </div>
        <button type="button" class="new-tab-btn" @click="createNewTab">+</button>
      </div>

      <!-- Row 2: Navigation & Address Bar -->
      <form class="toolbar" @submit.prevent="handleNavigation()">
        <button type="button" :disabled="activeTab.url === 'about:blank'" @click="triggerTabAction('back')" title="Back">←</button>
        <button type="button" :disabled="activeTab.url === 'about:blank'" @click="triggerTabAction('forward')" title="Forward">→</button>
        <button type="button" :disabled="activeTab.url === 'about:blank'" @click="triggerTabAction('reload')" title="Reload (Ctrl+R)">↻</button>

        <input 
          ref="addressInputRef"
          v-model="addressInput" 
          placeholder="Enter URL or javascript:... bookmarklet (Ctrl+L)" 
        />
        <button type="submit">Go</button>
        <button type="button" @click="openEditor">+ New Bookmarklet</button>
      </form>

      <!-- Row 3: Bookmarks & Bookmarklets Bar -->
      <nav class="bookmarks-bar">
        <div class="bookmark-list">
          <div v-for="bm in bookmarks" :key="bm.id" class="bookmark-item">
            <a href="#" @click.prevent="handleNavigation(bm.url)">{{ bm.name }}</a>
            <button type="button" class="delete-btn" @click="removeBookmark(bm.id)">×</button>
          </div>
        </div>

        <div class="bookmark-tools">
          <button type="button" @click="exportBookmarksJson" title="Export JSON">Export</button>
          <button type="button" @click="triggerImportJson" title="Import JSON">Import</button>
          <input 
            ref="fileInputRef" 
            type="file" 
            accept=".json,application/json" 
            style="display: none" 
            @change="handleImportJson" 
          />
        </div>
      </nav>
    </header>

    <!-- New Tab Blank Viewport -->
    <main v-if="activeTab.url === 'about:blank' && !showEditor" class="blank-viewport">
      <h1>Loonakulf Browser</h1>
      <p>Enter a website URL above, or click <strong>+ New Bookmarklet</strong> to write custom page scripts.</p>
    </main>

    <!-- Bookmarklet Studio Modal -->
