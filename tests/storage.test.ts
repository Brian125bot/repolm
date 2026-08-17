import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadPersistentNotebooks,
  getInitialNotebooksSync,
  savePersistentNotebooks,
  getSavedActiveNotebookId,
  saveActiveNotebookId,
  getSavedGitHubToken,
  saveGitHubToken,
  getStorageDiagnostics,
  importDataFromJSON,
} from '../src/services/storage';
import { getSampleZustandNotebook } from '../src/sampleRepos';
import { Notebook } from '../src/types';

describe('Client Storage Service (src/services/storage.ts)', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = global.localStorage;

  let localStore: Record<string, string> = {};

  beforeEach(() => {
    localStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => localStore[key] || null,
      setItem: (key: string, value: string) => {
        localStore[key] = value;
      },
      removeItem: (key: string) => {
        delete localStore[key];
      },
      clear: () => {
        localStore = {};
      },
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  describe('Active Notebook ID Persistence', () => {
    it('should return default active notebook ID if localStorage is empty', () => {
      const activeId = getSavedActiveNotebookId();
      expect(activeId).toBe('demo-zustand-notebook');
    });

    it('should save and retrieve active notebook ID from localStorage', () => {
      saveActiveNotebookId('nb-custom-123');
      expect(getSavedActiveNotebookId()).toBe('nb-custom-123');
    });
  });

  describe('GitHub Token Persistence', () => {
    it('should return empty string if no token saved', () => {
      expect(getSavedGitHubToken()).toBe('');
    });

    it('should save and retrieve GitHub PAT token', () => {
      saveGitHubToken('ghp_test_token_12345');
      expect(getSavedGitHubToken()).toBe('ghp_test_token_12345');
    });

    it('should remove GitHub token if empty value passed', () => {
      saveGitHubToken('ghp_test_token_12345');
      expect(getSavedGitHubToken()).toBe('ghp_test_token_12345');
      saveGitHubToken('');
      expect(getSavedGitHubToken()).toBe('');
    });
  });

  describe('Sync Notebooks Read', () => {
    it('should return sample notebook if localStorage has no saved notebooks', () => {
      const notebooks = getInitialNotebooksSync();
      expect(notebooks.length).toBeGreaterThan(0);
      expect(notebooks[0].source.fullName).toBe('pmndrs/zustand');
    });

    it('should return saved notebooks from localStorage if present', () => {
      const sample = getSampleZustandNotebook();
      sample.id = 'nb-sync-test';
      localStorage.setItem('reponotebook_saved_notebooks_v1', JSON.stringify([sample]));

      const notebooks = getInitialNotebooksSync();
      expect(notebooks).toHaveLength(1);
      expect(notebooks[0].id).toBe('nb-sync-test');
    });
  });

  describe('loadPersistentNotebooks', () => {
    it('should fetch notebooks from server disk storage if server returns 200', async () => {
      const sample = getSampleZustandNotebook();
      sample.id = 'nb-server-storage';

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ notebooks: [sample] }),
      }));

      const notebooks = await loadPersistentNotebooks();
      expect(notebooks).toHaveLength(1);
      expect(notebooks[0].id).toBe('nb-server-storage');
    });

    it('should fallback to localStorage / sample if server fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const sample = getSampleZustandNotebook();
      sample.id = 'nb-local-fallback';
      localStorage.setItem('reponotebook_saved_notebooks_v1', JSON.stringify([sample]));

      const notebooks = await loadPersistentNotebooks();
      expect(notebooks).toHaveLength(1);
      expect(notebooks[0].id).toBe('nb-local-fallback');
    });
  });

  describe('savePersistentNotebooks', () => {
    it('should save notebooks to localStorage and attempt server sync', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const sample = getSampleZustandNotebook();
      sample.id = 'nb-save-test';

      await savePersistentNotebooks([sample]);

      const storedRaw = localStorage.getItem('reponotebook_saved_notebooks_v1');
      expect(storedRaw).not.toBeNull();
      const parsed = JSON.parse(storedRaw!);
      expect(parsed[0].id).toBe('nb-save-test');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/storage/notebooks',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  describe('getStorageDiagnostics', () => {
    it('should fetch diagnostics from server endpoint if available', async () => {
      const mockDiag = {
        storageType: 'sqlite',
        totalNotebooks: 5,
        totalFiles: 20,
        totalChunks: 100,
        totalMessages: 10,
        totalNotes: 2,
        totalArtifacts: 1,
        diskUsageBytes: 12345,
        storagePath: '.reponotebook_data/reponotebook.sqlite',
        isDiskAvailable: true,
        lastSavedAt: new Date().toISOString(),
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDiag,
      }));

      const diag = await getStorageDiagnostics();
      expect(diag.storageType).toBe('sqlite');
      expect(diag.totalNotebooks).toBe(5);
    });

    it('should return fallback diagnostic calculations if server fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Server offline')));

      const diag = await getStorageDiagnostics();
      expect(diag.isDiskAvailable).toBe(true);
      expect(typeof diag.totalNotebooks).toBe('number');
    });
  });

  describe('importDataFromJSON', () => {
    it('should import notebooks from a valid export backup JSON object', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const sample = getSampleZustandNotebook();
      sample.id = 'nb-imported-1';

      const backupObj = {
        appName: 'RepoNotebook',
        version: '2.5',
        exportedAt: new Date().toISOString(),
        notebooks: [sample],
      };

      const file = {
        text: async () => JSON.stringify(backupObj),
      } as File;

      const imported = await importDataFromJSON(file);
      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('nb-imported-1');
    });

    it('should import notebooks from a direct JSON array file', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      const sample = getSampleZustandNotebook();
      sample.id = 'nb-imported-array';

      const file = {
        text: async () => JSON.stringify([sample]),
      } as File;

      const imported = await importDataFromJSON(file);
      expect(imported).toHaveLength(1);
      expect(imported[0].id).toBe('nb-imported-array');
    });

    it('should throw an error for invalid JSON structure or empty notebooks', async () => {
      const fileInvalidObj = {
        text: async () => JSON.stringify({ invalidKey: true }),
      } as File;

      await expect(importDataFromJSON(fileInvalidObj)).rejects.toThrow('Invalid JSON structure');

      const fileEmptyArray = {
        text: async () => JSON.stringify([]),
      } as File;

      await expect(importDataFromJSON(fileEmptyArray)).rejects.toThrow('No valid notebooks');
    });
  });
});
