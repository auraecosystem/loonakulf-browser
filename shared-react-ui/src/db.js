import Dexie from 'dexie';
export const db = new Dexie('BookmarkletBrowserDB');
db.version(1).stores({
  bookmarklets: '++id, title, category, rawCode, cleanCode'
});
