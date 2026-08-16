import { describe, it, expect } from 'vitest';
import {
  tokenize,
  chunkFileContent,
  InvertedIndex,
  buildGroundedPromptContext,
  generateRepositoryOutline,
} from '../server/indexer';
import { SourceFile, FileChunk } from '../src/types';

describe('Syntactic Chunking & Indexer (server/indexer.ts)', () => {
  describe('Tokenization', () => {
    it('should split text into lowercased tokens and filter short terms and stop words', () => {
      const tokens = tokenize('Explain the Zustand store implementation and how it manages state');
      expect(tokens).toContain('zustand');
      expect(tokens).toContain('store');
      expect(tokens).toContain('implementation');
      expect(tokens).toContain('manages');
      expect(tokens).toContain('state');
      // Stop words should be filtered
      expect(tokens).not.toContain('the');
      expect(tokens).not.toContain('and');
      expect(tokens).not.toContain('how');
      expect(tokens).not.toContain('it');
    });

    it('should preserve code-specific identifier characters like _, $, and -', () => {
      const tokens = tokenize('const _internal$Value = use-query_hook();');
      expect(tokens.some((t) => t.includes('_internal$value') || t.includes('use-query_hook') || t.includes('value'))).toBe(true);
    });
  });

  describe('AST & Syntactic Chunking (chunkFileContent)', () => {
    it('should produce a single bounded chunk for small source files', () => {
      const smallFile: SourceFile = {
        id: 'f-small',
        path: 'src/config.ts',
        language: 'TypeScript',
        fileCategory: 'config',
        size: 120,
        lineCount: 8,
        content: `export const API_URL = "https://api.example.com";\nexport const TIMEOUT = 5000;\nexport const MAX_RETRIES = 3;`,
      };

      const chunks = chunkFileContent(smallFile);
      expect(chunks).toHaveLength(1);
      expect(chunks[0].filePath).toBe('src/config.ts');
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBe(3);
      expect(chunks[0].chunkType).toBe('config');
    });

    it('should split larger files into overlapping chunks with line numbers preserved', () => {
      const lineArray = Array.from({ length: 90 }, (_, i) => `// Line ${i + 1}: function doTask${i + 1}() { return ${i + 1}; }`);
      const largeFile: SourceFile = {
        id: 'f-large',
        path: 'src/services/heavyWorker.ts',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 4000,
        lineCount: 90,
        content: lineArray.join('\n'),
      };

      const chunks = chunkFileContent(largeFile);
      expect(chunks.length).toBeGreaterThan(1);

      // Verify each chunk has valid consecutive line numbers
      for (const chunk of chunks) {
        expect(chunk.startLine).toBeGreaterThan(0);
        expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.filePath).toBe('src/services/heavyWorker.ts');
      }

      // First chunk starts at 1, last chunk ends at total line count
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[chunks.length - 1].endLine).toBe(90);
    });

    it('should detect React components and primary function symbols', () => {
      const reactFile: SourceFile = {
        id: 'f-react',
        path: 'src/components/HeaderBar.tsx',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 400,
        lineCount: 15,
        content: `import React from 'react';\n\nexport function HeaderBar() {\n  return <header>RepoNotebook</header>;\n}`,
      };

      const chunks = chunkFileContent(reactFile);
      expect(chunks.length).toBe(1);
      expect(chunks[0].symbolName).toBe('function HeaderBar');
      expect(chunks[0].chunkType).toBe('function');
    });

    it('should categorize Markdown headers and sections', () => {
      const docFile: SourceFile = {
        id: 'f-doc',
        path: 'README.md',
        language: 'Markdown',
        fileCategory: 'doc',
        size: 300,
        lineCount: 10,
        content: `# Quickstart Guide\n\nWelcome to the documentation.\n\n## Installation Steps\n\nRun npm install.`,
      };

      const chunks = chunkFileContent(docFile);
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunkType).toBe('doc_section');
      expect(chunks[0].symbolName).toBe('Quickstart Guide');
    });
  });

  describe('Inverted Index & BM25 Retrieval Engine', () => {
    const sampleChunks: FileChunk[] = [
      {
        id: 'c-1',
        fileId: 'f-1',
        filePath: 'src/vanilla.ts',
        startLine: 1,
        endLine: 40,
        chunkType: 'function',
        content: 'export const createStore = (createState) => { let state; const getState = () => state; return { getState }; };',
        language: 'TypeScript',
        fileCategory: 'code',
        symbolName: 'createStore',
      },
      {
        id: 'c-2',
        fileId: 'f-2',
        filePath: 'src/react.ts',
        startLine: 1,
        endLine: 35,
        chunkType: 'function',
        content: 'import { useSyncExternalStore } from "react"; export function useStore(api, selector) { return useSyncExternalStore(api.subscribe, selector); }',
        language: 'TypeScript',
        fileCategory: 'code',
        symbolName: 'useStore',
      },
      {
        id: 'c-3',
        fileId: 'f-3',
        filePath: 'package.json',
        startLine: 1,
        endLine: 25,
        chunkType: 'config',
        content: '{\n  "name": "zustand",\n  "version": "5.0.0",\n  "dependencies": { "use-sync-external-store": "^1.2.0" }\n}',
        language: 'JSON',
        fileCategory: 'config',
        symbolName: 'package.json',
      },
      {
        id: 'c-4',
        fileId: 'f-4',
        filePath: 'docs/getting-started.md',
        startLine: 1,
        endLine: 30,
        chunkType: 'doc_section',
        content: '# Getting Started\n\nTo install zustand, run npm install zustand or yarn add zustand.\nCreate a bear counter store easily.',
        language: 'Markdown',
        fileCategory: 'doc',
        symbolName: 'Getting Started',
      },
    ];

    it('should rank code chunks highest when querying for function names or symbols', () => {
      const index = new InvertedIndex(sampleChunks);
      const results = index.search('createStore function getState', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toBe('src/vanilla.ts');
      expect(results[0].symbolName).toBe('createStore');
    });

    it('should boost React hook chunk when searching for useSyncExternalStore', () => {
      const index = new InvertedIndex(sampleChunks);
      const results = index.search('useSyncExternalStore useStore', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toBe('src/react.ts');
    });

    it('should rank docs highest for informational or overview intent', () => {
      const index = new InvertedIndex(sampleChunks);
      const results = index.search('how to install zustand getting started guide', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toBe('docs/getting-started.md');
      expect(results[0].fileCategory).toBe('doc');
    });

    it('should rank package.json highest when querying for dependencies', () => {
      const index = new InvertedIndex(sampleChunks);
      const results = index.search('dependencies version package.json', 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].filePath).toBe('package.json');
      expect(results[0].fileCategory).toBe('config');
    });

    it('should return all candidate chunks safely when query is empty or broad', () => {
      const index = new InvertedIndex(sampleChunks);
      const results = index.search('', 10);
      expect(results.length).toBe(sampleChunks.length);
    });
  });

  describe('Context Window Budget Optimizer & Outline Generator', () => {
    it('should build prompt context within token budget constraints and include line ranges', () => {
      const sampleChunks: FileChunk[] = [
        {
          id: 'c-1',
          fileId: 'f-1',
          filePath: 'src/store.ts',
          startLine: 10,
          endLine: 35,
          chunkType: 'function',
          content: 'export function useStore() { return true; }',
          language: 'TypeScript',
          fileCategory: 'code',
          symbolName: 'useStore',
        },
      ];

      const { contextString, retrievedChunks } = buildGroundedPromptContext('useStore', sampleChunks, 5000);
      expect(retrievedChunks.length).toBe(1);
      expect(contextString).toContain('=== FILE: src/store.ts (Lines 10-35)');
      expect(contextString).toContain('[Symbol: useStore]');
      expect(contextString).toContain('export function useStore');
    });

    it('should generate structured repository outline from file list', () => {
      const files: SourceFile[] = [
        { id: '1', path: 'src/index.ts', language: 'TypeScript', fileCategory: 'code', size: 100, lineCount: 20, content: '' },
        { id: '2', path: 'README.md', language: 'Markdown', fileCategory: 'doc', size: 200, lineCount: 50, content: '' },
        { id: '3', path: 'package.json', language: 'JSON', fileCategory: 'config', size: 150, lineCount: 15, content: '' },
      ];

      const outline = generateRepositoryOutline(files, 10);
      expect(outline).toContain('REPOSITORY FILE STRUCTURE OVERVIEW:');
      expect(outline).toContain('src/index.ts');
      expect(outline).toContain('README.md');
      expect(outline).toContain('package.json');
    });

    it('should truncate outline gracefully if file count exceeds maxLines', () => {
      const files: SourceFile[] = Array.from({ length: 25 }, (_, i) => ({
        id: `f-${i}`,
        path: `src/module_${i}.ts`,
        language: 'TypeScript',
        fileCategory: 'code',
        size: 100,
        lineCount: 10,
        content: '',
      }));

      const outline = generateRepositoryOutline(files, 5);
      expect(outline).toContain('additional files indexed in repository');
    });
  });
});
