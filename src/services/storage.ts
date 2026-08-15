import { Notebook, StorageStats } from '../types';
import { getSampleZustandNotebook } from '../sampleRepos';

const DB_NAME = 'RepoNotebookDB';
const DB_VERSION = 1;
const STORE_NOTEBOOKS = 'notebooks';
const STORE_SETTINGS = 'settings';

const STORAGE_KEY_NOTEBOOKS = 'reponotebook_saved_notebooks_v1';
const STORAGE_KEY_ACTIVE_ID = 'reponotebook_active_notebook_id_v1';
const STORAGE_KEY_GITHUB_TOKEN = 'reponotebook_github_token_v1';

// IndexedDB Helper
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
        db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all notebooks:
 * 1. Try server disk storage endpoint (/api/storage/notebooks)
 * 2. If offline or error, try IndexedDB
 * 3. Fallback to localStorage
 * 4. Fallback to sample demo notebook
 */
export async function loadPersistentNotebooks(): Promise<Notebook[]> {
  // 1. Try Server Disk Storage
  try {
    const res = await fetch('/api/storage/notebooks', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.notebooks) && data.notebooks.length > 0) {
        // Cache to IndexedDB & localStorage for instant offline access
        await saveToIndexedDB(data.notebooks);
        saveToLocalStorage(data.notebooks);
        return data.notebooks;
      }
    }
  } catch (e) {
    console.warn('[Storage] Server storage fetch failed, falling back to client cache:', e);
  }

  // 2. Try IndexedDB
  try {
    const idbNotebooks = await loadFromIndexedDB();
    if (idbNotebooks && idbNotebooks.length > 0) {
      // Sync to backend disk in background
      syncToBackendDisk(idbNotebooks).catch(() => {});
      return idbNotebooks;
    }
  } catch (e) {
    console.warn('[Storage] IndexedDB read failed:', e);
  }

  // 3. Try localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTEBOOKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        saveToIndexedDB(parsed).catch(() => {});
        syncToBackendDisk(parsed).catch(() => {});
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Storage] localStorage read failed:', e);
  }

  // 4. Default to sample Zustand notebook
  const demo = getSampleZustandNotebook();
  await savePersistentNotebooks([demo]);
  return [demo];
}

/**
 * Synchronous initial read for immediate render
 */
export function getInitialNotebooksSync(): Notebook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTEBOOKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // fallback
  }
  return [getSampleZustandNotebook()];
}

/**
 * Save notebooks to all persistence layers:
 * - Backend local disk storage (`/api/storage/notebooks`)
 * - Client IndexedDB
 * - LocalStorage
 */
export async function savePersistentNotebooks(notebooks: Notebook[]): Promise<void> {
  // Always update localStorage and IndexedDB immediately
  saveToLocalStorage(notebooks);
  await saveToIndexedDB(notebooks).catch((err) => console.warn('[Storage] IndexedDB save failed', err));

  // Sync to server disk storage
  await syncToBackendDisk(notebooks).catch((err) => console.warn('[Storage] Server disk sync failed', err));
}

// IndexedDB Operations
async function saveToIndexedDB(notebooks: Notebook[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
    const store = tx.objectStore(STORE_NOTEBOOKS);

    // Clear old items and write new ones
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const nb of notebooks) {
          store.put(nb);
        }
        resolve();
      };
      clearReq.onerror = () => reject(clearReq.error);
    });
  } catch {
    // Silently continue if IndexedDB not available
  }
}

async function loadFromIndexedDB(): Promise<Notebook[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
      const store = tx.objectStore(STORE_NOTEBOOKS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result as Notebook[];
        resolve(result && result.length > 0 ? result : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// LocalStorage helpers
function saveToLocalStorage(notebooks: Notebook[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_NOTEBOOKS, JSON.stringify(notebooks));
  } catch (e) {
    // If quota exceeded, remove large content temporarily from localStorage only (IndexedDB/Disk will keep full content)
    try {
      const slim = notebooks.map((n) => ({
        ...n,
        // keep up to 10 files in slim localStorage cache
        files: n.files.slice(0, 10),
        chunks: n.chunks.slice(0, 20),
      }));
      localStorage.setItem(STORAGE_KEY_NOTEBOOKS, JSON.stringify(slim));
    } catch {
      console.warn('[Storage] LocalStorage quota exceeded, relying on IndexedDB & Disk');
    }
  }
}

// Server Disk Persistence Sync
async function syncToBackendDisk(notebooks: Notebook[]): Promise<void> {
  try {
    await fetch('/api/storage/notebooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebooks }),
    });
  } catch (e) {
    // Non-blocking background sync error
  }
}

// Active Notebook ID Persistence
export function getSavedActiveNotebookId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || 'demo-zustand-notebook';
  } catch {
    return 'demo-zustand-notebook';
  }
}

export function saveActiveNotebookId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch {
    // ignore
  }
}

// GitHub Token Persistence
export function getSavedGitHubToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN) || '';
  } catch {
    return '';
  }
}

export function saveGitHubToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_GITHUB_TOKEN);
    }
  } catch {
    // ignore
  }
}

// Get Storage Diagnostics & Disk Status
export async function getStorageDiagnostics(): Promise<StorageStats> {
  try {
    const res = await fetch('/api/storage/status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  // Fallback client calculation
  const notebooks = getInitialNotebooksSync();
  const totalFiles = notebooks.reduce((acc, n) => acc + (n.files?.length || 0), 0);
  const totalChunks = notebooks.reduce((acc, n) => acc + (n.chunks?.length || 0), 0);
  const totalMessages = notebooks.reduce((acc, n) => acc + (n.messages?.length || 0), 0);
  const totalNotes = notebooks.reduce((acc, n) => acc + (n.notes?.length || 0), 0);
  const totalArtifacts = notebooks.reduce((acc, n) => acc + (n.artifacts?.length || 0), 0);

  return {
    totalNotebooks: notebooks.length,
    totalFiles,
    totalChunks,
    totalMessages,
    totalNotes,
    totalArtifacts,
    diskUsageBytes: JSON.stringify(notebooks).length,
    storagePath: '.reponotebook_data/notebooks.json',
    isDiskAvailable: true,
    lastSavedAt: new Date().toISOString(),
  };
}

// Export all data as JSON
export function exportAllDataAsJSON(notebooks: Notebook[]): void {
  const payload = {
    appName: 'RepoNotebook',
    version: '2.5',
    exportedAt: new Date().toISOString(),
    notebooks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reponotebook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import data from JSON
export async function importDataFromJSON(file: File): Promise<Notebook[]> {
  const text = await file.text();
  const data = JSON.parse(text);

  let notebooksToImport: Notebook[] = [];
  if (Array.isArray(data)) {
    notebooksToImport = data;
  } else if (data && Array.isArray(data.notebooks)) {
    notebooksToImport = data.notebooks;
  } else {
    throw new Error('Invalid JSON structure: Expected a notebooks array or export backup object');
  }

  if (notebooksToImport.length === 0) {
    throw new Error('No valid notebooks found in imported backup file');
  }

  await savePersistentNotebooks(notebooksToImport);
  return notebooksToImport;
}
