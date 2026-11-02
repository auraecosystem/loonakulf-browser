import Dexie from 'dexie';

// 1. Initialize the local IndexedDB database instance
export const db = new Dexie('BookmarkletBrowserDB');

// 2. Define the storage schema (id is auto-incrementing, index by title and category)
db.version(1).stores({
  bookmarklets: '++id, title, category, rawCode, cleanCode'
});
