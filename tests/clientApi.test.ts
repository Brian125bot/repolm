import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  scanLocalDirectory,
  ingestRepository,
  askRepoQuestion,
  generateRepoArtifact,
  mergeNotesToBriefing,
} from '../src/services/api';
import { getSampleZustandNotebook } from '../src/sampleRepos';

describe('Client API Service Wrapper (src/services/api.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  describe('scanLocalDirectory', () => {
    it('should call /api/local/scan with localPath parameter', async () => {
      const mockResult = {
        path: '/app/src',
        exists: true,
        totalFiles: 10,
        detectedLanguages: ['TypeScript'],
        previewFiles: [],
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const res = await scanLocalDirectory('src');
      expect(res.exists).toBe(true);
      expect(res.totalFiles).toBe(10);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/local/scan',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ localPath: 'src' }),
        })
      );
    });

    it('should throw an error if scan request fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Path restricted' }),
      } as Response);

      await expect(scanLocalDirectory('/etc')).rejects.toThrow('Path restricted');
    });
  });

  describe('ingestRepository', () => {
    it('should handle Case 1: Browser folder upload', async () => {
      const sampleNotebook = getSampleZustandNotebook();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ notebook: sampleNotebook }),
      } as Response);

      const result = await ingestRepository({
        folderName: 'uploaded-folder',
        uploadedFiles: [
          { path: 'index.ts', content: 'console.log("hello");' },
        ],
      });

      expect(result.notebook).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/local/upload-folder',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle Case 2: Local directory on server', async () => {
      const sampleNotebook = getSampleZustandNotebook();
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ notebook: sampleNotebook }),
      } as Response);

      const result = await ingestRepository({
        isLocal: true,
        localPath: 'src/utils',
      });

      expect(result.notebook).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/local/ingest',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should handle Case 3: Remote GitHub repository', async () => {
      const sample = getSampleZustandNotebook();
      const mockIngestRes = {
        source: sample.source,
        files: sample.files,
        chunks: sample.chunks,
        suggestedQuestions: sample.suggestedQuestions,
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockIngestRes,
      } as Response);

      const result = await ingestRepository({
        repoUrl: 'https://github.com/pmndrs/zustand',
      });

      expect(result.notebook).toBeDefined();
      expect(result.notebook.name).toBe('pmndrs/zustand');
      expect(result.notebook.files.length).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/repo/ingest',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error when repository ingestion fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Repo not found' }),
      } as Response);

      await expect(
        ingestRepository({ repoUrl: 'https://github.com/invalid/repo' })
      ).rejects.toThrow('Repo not found');
    });
  });

  describe('askRepoQuestion', () => {
    it('should call /api/repo/query with question and context', async () => {
      const sample = getSampleZustandNotebook();
      const mockQueryRes = {
        content: 'zustand uses createStore for state management [src/vanilla.ts:L1-L5].',
        citations: [
          {
            id: 'cit-1',
            filePath: 'src/vanilla.ts',
            startLine: 1,
            endLine: 5,
            fileCategory: 'code',
          },
        ],
        suggestedFollowUps: ['How to use subscribeWithSelector?'],
        confidence: 'grounded',
        modelUsed: 'gemini-3.7-flash',
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockQueryRes,
      } as Response);

      const res = await askRepoQuestion({
        question: 'How does createStore work?',
        notebook: sample,
        answerMode: 'detailed',
        model: 'gemini-3.7-flash',
      });

      expect(res.content).toContain('createStore');
      expect(res.citations).toHaveLength(1);
      expect(res.confidence).toBe('grounded');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/repo/query',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error if query request fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'AI generation error' }),
      } as Response);

      const sample = getSampleZustandNotebook();
      await expect(
        askRepoQuestion({
          question: 'Test question',
          notebook: sample,
          answerMode: 'concise',
        })
      ).rejects.toThrow('AI generation error');
    });
  });

  describe('generateRepoArtifact', () => {
    it('should call /api/repo/artifact and return created artifact', async () => {
      const sample = getSampleZustandNotebook();
      const mockArtifactRes = {
        id: 'art-mindmap-123',
        type: 'mindmap',
        title: 'Repository Mindmap',
        content: '# Mindmap Content',
        citations: [],
        createdAt: new Date().toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockArtifactRes,
      } as Response);

      const artifact = await generateRepoArtifact({
        artifactType: 'mindmap',
        notebook: sample,
      });

      expect(artifact.id).toBe('art-mindmap-123');
      expect(artifact.notebookId).toBe(sample.id);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/repo/artifact',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw error if artifact generation fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid artifact type' }),
      } as Response);

      const sample = getSampleZustandNotebook();
      await expect(
        generateRepoArtifact({
          artifactType: 'overview',
          notebook: sample,
        })
      ).rejects.toThrow('Invalid artifact type');
    });
  });

  describe('mergeNotesToBriefing', () => {
    it('should call /api/notes/merge and return merged briefing document', async () => {
      const sample = getSampleZustandNotebook();
      const mockBriefing = {
        title: 'Executive Briefing Document',
        content: '# Briefing Content',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockBriefing,
      } as Response);

      const result = await mergeNotesToBriefing({
        notes: [],
        notebook: sample,
      });

      expect(result.title).toBe('Executive Briefing Document');
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/notes/merge',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
