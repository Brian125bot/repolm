import { describe, it, expect } from 'vitest';
import {
  createChunksFromFile,
  getSampleZustandNotebook,
  POPULAR_REPOS,
} from '../src/sampleRepos';
import { SourceFile } from '../src/types';

describe('Sample Repositories & Demo Notebooks (src/sampleRepos.ts)', () => {
  describe('createChunksFromFile', () => {
    it('should split file content into overlapping chunks with line numbers', () => {
      const mockFile: SourceFile = {
        id: 'f-test-1',
        path: 'src/core.ts',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 800,
        lineCount: 50,
        content: Array.from({ length: 50 }, (_, i) => `export const fn${i} = () => ${i};`).join('\n'),
      };

      const chunks = createChunksFromFile(mockFile);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].filePath).toBe('src/core.ts');
      expect(chunks[0].language).toBe('TypeScript');
    });

    it('should extract heading symbols for documentation files', () => {
      const docFile: SourceFile = {
        id: 'f-doc-1',
        path: 'README.md',
        language: 'Markdown',
        fileCategory: 'doc',
        size: 300,
        lineCount: 12,
        content: '# Architecture\n\nThis is the system architecture documentation.',
      };

      const chunks = createChunksFromFile(docFile);
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkType).toBe('doc_section');
      expect(chunks[0].symbolName).toBe('Architecture');
    });
  });

  describe('getSampleZustandNotebook', () => {
    it('should construct a valid zustand demo notebook with all required fields', () => {
      const demo = getSampleZustandNotebook();

      expect(demo.id).toBeDefined();
      expect(demo.name).toBe('pmndrs/zustand');
      expect(demo.source.owner).toBe('pmndrs');
      expect(demo.source.name).toBe('zustand');
      expect(demo.source.primaryLanguage).toBe('TypeScript');
      expect(demo.files.length).toBeGreaterThanOrEqual(4);
      expect(demo.chunks.length).toBeGreaterThan(0);
      expect(demo.messages.length).toBeGreaterThan(0);
      expect(demo.notes.length).toBeGreaterThan(0);
      expect(demo.artifacts.length).toBeGreaterThan(0);
      expect(demo.suggestedQuestions.length).toBeGreaterThan(0);
    });

    it('should ensure all citations in sample messages map to existing files', () => {
      const demo = getSampleZustandNotebook();
      const filePaths = new Set(demo.files.map((f) => f.path));

      for (const msg of demo.messages) {
        if (msg.citations) {
          for (const cit of msg.citations) {
            expect(filePaths.has(cit.filePath)).toBe(true);
            expect(cit.startLine).toBeGreaterThan(0);
            expect(cit.endLine).toBeGreaterThanOrEqual(cit.startLine);
          }
        }
      }
    });
  });

  describe('POPULAR_REPOS catalog', () => {
    it('should contain valid popular repository metadata', () => {
      expect(POPULAR_REPOS.length).toBeGreaterThanOrEqual(4);
      for (const repo of POPULAR_REPOS) {
        expect(repo.name).toContain('/');
        expect(repo.url).toMatch(/^https:\/\/github\.com\//);
        expect(repo.description.length).toBeGreaterThan(5);
        expect(repo.primaryLanguage).toBeDefined();
        expect(repo.badge).toBeDefined();
      }
    });
  });
});
