<script setup>
import { ref, computed } from 'vue';
import { formatNavigationTarget } from './utils/urlHelper.js';

// Manage open tabs (starting with one blank tab)
const tabs = ref([
  { id: 1, title: 'New Tab', url: 'about:blank' }
]);
const activeTabId = ref(1);
const addressInput = ref('');

const activeTab = computed(() => 
  tabs.value.find(tab => tab.id === activeTabId.value)
);

// Open a new tab defaulting to about:blank
function createNewTab() {
  const newId = Date.now();
  tabs.value.push({ id: newId, title: 'New Tab', url: 'about:blank' });
  activeTabId.value = newId;
  addressInput.value = '';
}

// Navigate active tab when user submits the address bar
function navigate() {
  const targetUrl = formatNavigationTarget(addressInput.value);
  activeTab.value.url = targetUrl;
  activeTab.value.title = targetUrl === 'about:blank' ? 'New Tab' : targetUrl;
}
</script>

<template>
  <div class="browser-window">
    <!-- Tab Bar -->
    <div class="tab-bar">
      <button 
        v-for="tab in tabs" 
        :key="tab.id" 
        @click="activeTabId = tab.id; addressInput = tab.url === 'about:blank' ? '' : tab.url"
      >
        {{ tab.title }}
      </button>
      <!-- Uses @click.prevent so it never triggers unwanted link behavior -->
      <a href="#" @click.prevent="createNewTab">+ New Tab</a>
    </div>

    <!-- Address Bar -->
    <form class="address-bar" @submit.prevent="navigate">
      <input 
        v-model="addressInput" 
        type="text" 
        placeholder="Search or enter web address (or about:blank)" 
      />
      <button type="submit">Go</button>
    </form>

    <!-- Viewport (In Electron, swap <iframe> for <webview>) -->
    <div class="viewport">
      <div v-if="activeTab.url === 'about:blank'" class="blank-page">
        <h2>Loonakulf Browser</h2>
        <p>Start typing in the address bar above.</p>
      </div>
      <iframe v-else :src="activeTab.url" class="web-frame"></iframe>
    </div>
  </div>
</template>
