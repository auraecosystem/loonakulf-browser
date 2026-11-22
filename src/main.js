import { createApp } from 'vue';
import App from './App.vue';

// Reset default browser margins so Loonakulf fills 100% of the window cleanly
document.body.style.margin = '0';
document.body.style.padding = '0';
document.body.style.overflow = 'hidden';

createApp(App).mount('#app');
