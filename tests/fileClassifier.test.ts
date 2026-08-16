import { describe, it, expect } from 'vitest';
import {
  determineFileCategory,
  detectLanguage,
  extractCitationsFromText,
} from '../src/utils/fileClassifier';
import { SourceFile } from '../src/types';

describe('File Classifier & Citation Parsing (src/utils/fileClassifier.ts)', () => {
  describe('determineFileCategory', () => {
    it('should identify workflow files', () => {
      expect(determineFileCategory('.github/workflows/ci.yml')).toBe('workflow');
      expect(determineFileCategory('.github/workflows/deploy.yaml')).toBe('workflow');
      expect(determineFileCategory('sub/.github/workflows/release.yml')).toBe('workflow');
      expect(determineFileCategory('.gitlab-ci.yml')).toBe('workflow');
      expect(determineFileCategory('azure-pipelines.yml')).toBe('workflow');
    });

    it('should identify test files across different naming conventions', () => {
      expect(determineFileCategory('src/vanilla.test.ts')).toBe('test');
      expect(determineFileCategory('src/react.spec.tsx')).toBe('test');
      expect(determineFileCategory('tests/unit/storage.test.js')).toBe('test');
      expect(determineFileCategory('server/__tests__/db.spec.js')).toBe('test');
      expect(determineFileCategory('backend/main_test.py')).toBe('test');
      expect(determineFileCategory('pkg/server_test.go')).toBe('test');
      expect(determineFileCategory('src/lib_test.rs')).toBe('test');
    });

    it('should identify documentation files', () => {
      expect(determineFileCategory('README.md')).toBe('doc');
      expect(determineFileCategory('docs/architecture.mdx')).toBe('doc');
      expect(determineFileCategory('CHANGELOG.md')).toBe('doc');
      expect(determineFileCategory('docs/getting-started.rst')).toBe('doc');
      expect(determineFileCategory('LICENSE.txt')).toBe('doc');
    });

    it('should identify configuration and manifest files', () => {
      expect(determineFileCategory('package.json')).toBe('config');
      expect(determineFileCategory('tsconfig.json')).toBe('config');
      expect(determineFileCategory('vite.config.ts')).toBe('config');
      expect(determineFileCategory('.env.example')).toBe('config');
      expect(determineFileCategory('dockerfile')).toBe('config');
      expect(determineFileCategory('Cargo.toml')).toBe('config');
      expect(determineFileCategory('pyproject.toml')).toBe('config');
    });

    it('should categorize general source files as code', () => {
      expect(determineFileCategory('src/main.tsx')).toBe('code');
      expect(determineFileCategory('server/db.ts')).toBe('code');
      expect(determineFileCategory('internal/engine.go')).toBe('code');
      expect(determineFileCategory('core/app.py')).toBe('code');
      expect(determineFileCategory('lib/auth.rb')).toBe('code');
    });
  });

  describe('detectLanguage', () => {
    it('should accurately detect languages from file extensions', () => {
      expect(detectLanguage('src/app.tsx')).toBe('TypeScript');
      expect(detectLanguage('src/index.ts')).toBe('TypeScript');
      expect(detectLanguage('src/main.jsx')).toBe('JavaScript');
      expect(detectLanguage('server/server.mjs')).toBe('JavaScript');
      expect(detectLanguage('scripts/deploy.py')).toBe('Python');
      expect(detectLanguage('cmd/server.go')).toBe('Go');
      expect(detectLanguage('src/main.rs')).toBe('Rust');
      expect(detectLanguage('App.java')).toBe('Java');
      expect(detectLanguage('model.rb')).toBe('Ruby');
      expect(detectLanguage('index.php')).toBe('PHP');
      expect(detectLanguage('Program.cs')).toBe('C#');
      expect(detectLanguage('main.cpp')).toBe('C/C++');
      expect(detectLanguage('header.h')).toBe('C/C++');
      expect(detectLanguage('README.md')).toBe('Markdown');
      expect(detectLanguage('manifest.json')).toBe('JSON');
      expect(detectLanguage('workflow.yml')).toBe('YAML');
      expect(detectLanguage('config.toml')).toBe('TOML');
      expect(detectLanguage('index.html')).toBe('HTML');
      expect(detectLanguage('styles.css')).toBe('CSS');
      expect(detectLanguage('schema.sql')).toBe('SQL');
      expect(detectLanguage('build.sh')).toBe('Shell');
      expect(detectLanguage('UNKNOWN.xyz123')).toBe('Text');
    });
  });

  describe('extractCitationsFromText', () => {
    const mockFiles: SourceFile[] = [
      {
        id: 'f-1',
        path: 'src/vanilla.ts',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 500,
        lineCount: 10,
        content: [
          'export const createStore = () => {',
          '  let state = {};',
          '  const getState = () => state;',
          '  const setState = (partial) => { state = { ...state, ...partial }; };',
          '  return { getState, setState };',
          '};',
        ].join('\n'),
      },
      {
        id: 'f-2',
        path: 'src/components/my custom component.tsx',
        language: 'TypeScript',
        fileCategory: 'code',
        size: 300,
        lineCount: 5,
        content: [
          'export function CustomComponent() {',
          '  return <div>Custom Component</div>;',
          '}',
        ].join('\n'),
      },
    ];

    it('should extract single line citation tags [file:L10]', () => {
      const text = 'The store is initialized in [src/vanilla.ts:L1].';
      const citations = extractCitationsFromText(text, mockFiles);

      expect(citations).toHaveLength(1);
      expect(citations[0].filePath).toBe('src/vanilla.ts');
      expect(citations[0].startLine).toBe(1);
      expect(citations[0].endLine).toBe(1);
      expect(citations[0].snippet).toBe('export const createStore = () => {');
    });

    it('should extract line range citations [file:L1-L5]', () => {
      const text = 'The createStore function is defined in [src/vanilla.ts:L1-L5].';
      const citations = extractCitationsFromText(text, mockFiles);

      expect(citations).toHaveLength(1);
      expect(citations[0].filePath).toBe('src/vanilla.ts');
      expect(citations[0].startLine).toBe(1);
      expect(citations[0].endLine).toBe(5);
      expect(citations[0].snippet).toContain('export const createStore');
      expect(citations[0].snippet).toContain('return { getState, setState };');
    });

    it('should handle filenames with spaces and special characters', () => {
      const text = 'Rendered using [src/components/my custom component.tsx:L1-L3].';
      const citations = extractCitationsFromText(text, mockFiles);

      expect(citations).toHaveLength(1);
      expect(citations[0].filePath).toBe('src/components/my custom component.tsx');
      expect(citations[0].startLine).toBe(1);
      expect(citations[0].endLine).toBe(3);
      expect(citations[0].snippet).toContain('export function CustomComponent');
    });

    it('should deduplicate identical citations in the same response', () => {
      const text = 'Defined in [src/vanilla.ts:L1-L3] and also referenced here [src/vanilla.ts:L1-L3].';
      const citations = extractCitationsFromText(text, mockFiles);

      expect(citations).toHaveLength(1);
    });

    it('should extract multiple distinct citations from multiline responses', () => {
      const text = `
- Core Store: [src/vanilla.ts:L1-L3]
- UI Component: [src/components/my custom component.tsx:L1-L2]
      `;
      const citations = extractCitationsFromText(text, mockFiles);

      expect(citations).toHaveLength(2);
      expect(citations[0].filePath).toBe('src/vanilla.ts');
      expect(citations[1].filePath).toBe('src/components/my custom component.tsx');
    });
  });
});
