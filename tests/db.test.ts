import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDatabase,
  getAllNotebooks,
  getNotebookById,
  saveNotebook,
  saveNotebooks,
  deleteNotebook,
  getStorageDiagnostics,
} from '../server/db';
import { Notebook } from '../src/types';

describe('SQLite Database & Storage Engine (server/db.ts)', () => {
  beforeAll(async () => {
    // Ensure DB initialized
    await getDatabase();
  });

  const testNotebookId = `test-nb-${Date.now()}`;
  const mockNotebook: Notebook = {
    id: testNotebookId,
    name: 'test-user/test-repo',
    repoUrl: 'https://github.com/test-user/test-repo',
    ref: 'main',
    pathFilter: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexStatus: 'ready',
    source: {
      repoUrl: 'https://github.com/test-user/test-repo',
      owner: 'test-user',
      name: 'test-repo',
      fullName: 'test-user/test-repo',
      description: 'Test repository for unit testing',
      defaultBranch: 'main',
      selectedRef: 'main',
      license: 'MIT',
      stars: 10,
      forks: 2,
      openIssues: 0,
      topics: ['test', 'reponotebook'],
      languages: { TypeScript: 100 },
      primaryLanguage: 'TypeScript',
      avatarUrl: '',
      lastSyncedAt: new Date().toISOString(),
      isPrivate: false,
      totalFiles: 1,
      totalLines: 15,
      categoryCounts: { doc: 0, code: 1, config: 0, test: 0, workflow: 0 },
    },
    files: [
      {
        id: `f-${testNotebookId}-1`,
        path: 'src/main.ts',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 200,
        lineCount: 15,
        content: 'export function helloWorld() { return "hello from test"; }',
      },
    ],
    chunks: [
      {
        id: `c-${testNotebookId}-1`,
        fileId: `f-${testNotebookId}-1`,
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 15,
        chunkType: 'function',
        symbolName: 'helloWorld',
        content: 'export function helloWorld() { return "hello from test"; }',
        language: 'TypeScript',
        fileCategory: 'code',
      },
    ],
    messages: [
      {
        id: `m-${testNotebookId}-1`,
        role: 'assistant',
        content: 'Hello! This is a test message with citation [src/main.ts:L1].',
        citations: [
          {
            id: 'cit-test-1',
            filePath: 'src/main.ts',
            startLine: 1,
            endLine: 1,
            snippet: 'export function helloWorld()',
            fileCategory: 'code',
          },
        ],
        createdAt: new Date().toISOString(),
        confidence: 'grounded',
        modelUsed: 'gemini-3.7-flash',
      },
    ],
    notes: [
      {
        id: `note-${testNotebookId}-1`,
        notebookId: testNotebookId,
        title: 'Test Note',
        content: 'This is a test note content.',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        citations: [],
      },
    ],
    artifacts: [
      {
        id: `art-${testNotebookId}-1`,
        notebookId: testNotebookId,
        type: 'overview',
        title: 'Test Overview Artifact',
        content: '# Test Overview Content',
        citations: [],
        createdAt: new Date().toISOString(),
      },
    ],
    pinnedCitations: [
      {
        id: 'pin-1',
        filePath: 'src/main.ts',
        startLine: 1,
        endLine: 15,
        fileCategory: 'code',
      },
    ],
    suggestedQuestions: ['What does test-repo do?'],
  };

  it('should initialize SQLite tables successfully', async () => {
    const db = await getDatabase();
    expect(db).toBeDefined();

    // Verify tables exist in SQLite sqlite_master
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
    const tableNames = res[0].values.map((row) => row[0]);
    expect(tableNames).toContain('notebooks');
    expect(tableNames).toContain('files');
    expect(tableNames).toContain('chunks');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('notes');
    expect(tableNames).toContain('artifacts');
    expect(tableNames).toContain('pinned_citations');
  });

  it('should save a notebook with all nested files, chunks, messages, notes, artifacts, and pinned citations', async () => {
    await saveNotebook(mockNotebook);

    const retrieved = await getNotebookById(testNotebookId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(testNotebookId);
    expect(retrieved?.name).toBe('test-user/test-repo');
    expect(retrieved?.files).toHaveLength(1);
    expect(retrieved?.files[0].path).toBe('src/main.ts');
    expect(retrieved?.chunks).toHaveLength(1);
    expect(retrieved?.chunks[0].symbolName).toBe('helloWorld');
    expect(retrieved?.messages).toHaveLength(1);
    expect(retrieved?.messages[0].citations).toHaveLength(1);
    expect(retrieved?.notes).toHaveLength(1);
    expect(retrieved?.artifacts).toHaveLength(1);
    expect(retrieved?.pinnedCitations).toHaveLength(1);
  });

  it('should update an existing notebook when saved again', async () => {
    const updatedNb: Notebook = {
      ...mockNotebook,
      name: 'test-user/updated-repo-name',
      notes: [
        ...mockNotebook.notes,
        {
          id: `note-${testNotebookId}-2`,
          notebookId: testNotebookId,
          title: 'Second Note',
          content: 'Additional notes.',
          tags: ['architecture'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          citations: [],
        },
      ],
    };

    await saveNotebook(updatedNb);
    const retrieved = await getNotebookById(testNotebookId);
    expect(retrieved?.name).toBe('test-user/updated-repo-name');
    expect(retrieved?.notes).toHaveLength(2);
  });

  it('should bulk save notebooks with saveNotebooks', async () => {
    const bulk1: Notebook = { ...mockNotebook, id: `bulk-1-${Date.now()}`, name: 'bulk/repo-1' };
    const bulk2: Notebook = { ...mockNotebook, id: `bulk-2-${Date.now()}`, name: 'bulk/repo-2' };

    await saveNotebooks([bulk1, bulk2]);

    const res1 = await getNotebookById(bulk1.id);
    const res2 = await getNotebookById(bulk2.id);

    expect(res1?.name).toBe('bulk/repo-1');
    expect(res2?.name).toBe('bulk/repo-2');

    // Clean up bulk notebooks
    await deleteNotebook(bulk1.id);
    await deleteNotebook(bulk2.id);
  });

  it('should return null for non-existent notebook ID', async () => {
    const res = await getNotebookById('non-existent-id-99999');
    expect(res).toBeNull();
  });

  it('should list all notebooks in the SQLite database', async () => {
    const all = await getAllNotebooks();
    expect(all.length).toBeGreaterThanOrEqual(1);
    const found = all.find((n) => n.id === testNotebookId);
    expect(found).toBeDefined();
    expect(found?.name).toBe('test-user/updated-repo-name');
  });

  it('should return accurate storage diagnostics', async () => {
    const diagnostics = await getStorageDiagnostics();
    expect(diagnostics.storageType).toBe('sqlite');
    expect(diagnostics.totalNotebooks).toBeGreaterThanOrEqual(1);
    expect(diagnostics.totalFiles).toBeGreaterThanOrEqual(1);
    expect(diagnostics.totalChunks).toBeGreaterThanOrEqual(1);
    expect(diagnostics.storagePath).toContain('reponotebook.sqlite');
  });

  it('should delete a notebook and cascade-delete its records', async () => {
    const deleted = await deleteNotebook(testNotebookId);
    expect(deleted).toBe(true);

    const retrieved = await getNotebookById(testNotebookId);
    expect(retrieved).toBeNull();
  });

  it('should safely execute concurrent saves without database lock errors', async () => {
    const concurrent1: Notebook = { ...mockNotebook, id: `conc-1-${Date.now()}`, name: 'conc/repo-1' };
    const concurrent2: Notebook = { ...mockNotebook, id: `conc-2-${Date.now()}`, name: 'conc/repo-2' };

    await Promise.all([saveNotebook(concurrent1), saveNotebook(concurrent2)]);

    const res1 = await getNotebookById(concurrent1.id);
    const res2 = await getNotebookById(concurrent2.id);

    expect(res1).not.toBeNull();
    expect(res2).not.toBeNull();

    await deleteNotebook(concurrent1.id);
    await deleteNotebook(concurrent2.id);
  });
});
