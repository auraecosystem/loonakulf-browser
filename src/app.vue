<script setup>
import { ref, computed, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
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

// --- Bookmarklet Editor Modal State ---
const showEditor = ref(false);
const editorName = ref('');
const editorCode = ref('// Write multi-line JavaScript here\ndocument.body.style.backgroundColor = "#111";\ndocument.body.style.color = "#0f0";');

async function openEditor() {
  showEditor.value = true;
  // Temporarily hide native webview so the HTML modal renders cleanly on top
  await invoke('switch_tab', { tabId: 'none' });
}

async function closeEditor() {
  showEditor.value = false;
  await invoke('switch_tab', { tabId: activeTabId.value });
}

// Wraps multi-line JS into a safe single-line javascript:(function(){...})() bookmarklet
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

      <!-- Row 2: Address Bar -->
      <form class="toolbar" @submit.prevent="handleNavigation()">
        <input v-model="addressInput" placeholder="Enter URL or javascript:... bookmarklet" />
        <button type="submit">Go</button>
        <button type="button" @click="openEditor">+ New Bookmarklet</button>
      </form>

      <!-- Row 3: Bookmarks & Bookmarklets Bar -->
      <nav class="bookmarks-bar">
        <div v-for="bm in bookmarks" :key="bm.id" class="bookmark-item">
          <a href="#" @click.prevent="handleNavigation(bm.url)">{{ bm.name }}</a>
          <button type="button" class="delete-btn" @click="removeBookmark(bm.id)">×</button>
        </div>
      </nav>
    </header>

    <!-- New Tab Blank Viewport (Visible when active tab is about:blank) -->
    <main v-if="activeTab.url === 'about:blank' && !showEditor" class="blank-viewport">
      <h1>Loonakulf Browser</h1>
      <p>Enter a website URL above, or click <strong>+ New Bookmarklet</strong> to write custom page scripts.</p>
    </main>

    <!-- Bookmarklet Editor Modal -->
    <div v-if="showEditor" class="editor-modal">
      <div class="editor-card">
        <h2>Bookmarklet Studio</h2>
        <input v-model="editorName" placeholder="Bookmarklet Name (e.g., Dark Mode)" class="name-input" />
        <textarea v-model="editorCode" rows="10" spellcheck="false"></textarea>
        <div class="editor-actions">
          <button type="button" @click="testEditorCode">▶ Run on Active Tab</button>
          <button type="button" class="primary" @click="saveEditorBookmarklet">Save to Bar</button>
          <button type="button" @click="closeEditor">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loonakulf-app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #11111b;
  color: #cdd6f4;
  font-family: system-ui, sans-serif;
}
.browser-chrome {
  height: 148px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1e1e2e;
  border-bottom: 1px solid #313244;
}
.tab-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
}
.tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #181825;
  border-radius: 6px;
  cursor: pointer;
  max-width: 180px;
  font-size: 13px;
}
.tab.active {
  background: #313244;
  color: #fff;
  font-weight: 600;
}
.tab-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.close-tab, .new-tab-btn {
  background: none;
  border: none;
  color: #a6adc8;
  cursor: pointer;
}
.toolbar {
  display: flex;
  gap: 8px;
}
.toolbar input {
  flex: 1;
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid #45475a;
  background: #11111b;
  color: #fff;
}
.bookmarks-bar {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  align-items: center;
}
.bookmark-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #313244;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 12px;
}
.bookmark-item a {
  color: #89b4fa;
  text-decoration: none;
}
.delete-btn {
  background: none;
  border: none;
  color: #f38ba8;
  cursor: pointer;
}
.blank-viewport {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #a6adc8;
}
.editor-modal {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.editor-card {
  width: 100%;
  max-width: 600px;
  background: #1e1e2e;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #45475a;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.name-input, textarea {
  width: 100%;
  box-sizing: border-box;
  background: #11111b;
  color: #a6e3a1;
  border: 1px solid #45475a;
  border-radius: 6px;
  padding: 10px;
  font-family: monospace;
}
.editor-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}
button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #45475a;
  background: #313244;
  color: #fff;
  cursor: pointer;
}
button.primary {
  background: #89b4fa;
  color: #11111b;
  font-weight: bold;
}
</style>
