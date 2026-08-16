import path from 'path';
import { SourceFile, FileCategory, Citation } from '../types';

/**
 * Determine logical category of a repository file based on path conventions
 */
export function determineFileCategory(filePath: string): FileCategory {
  const lower = filePath.toLowerCase();
  if (
    lower.startsWith('.github/workflows') ||
    lower.includes('/.github/workflows/') ||
    lower.endsWith('.gitlab-ci.yml') ||
    lower.includes('azure-pipelines')
  ) {
    return 'workflow';
  }
  if (
    lower.includes('test') ||
    lower.includes('spec') ||
    lower.includes('__tests__') ||
    lower.endsWith('.test.ts') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.test.tsx') ||
    lower.endsWith('.test.jsx') ||
    lower.endsWith('.spec.ts') ||
    lower.endsWith('.spec.js') ||
    lower.endsWith('.spec.tsx') ||
    lower.endsWith('.spec.jsx') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('_test.go') ||
    lower.endsWith('_test.rs')
  ) {
    return 'test';
  }
  if (
    lower.endsWith('.md') ||
    lower.endsWith('.mdx') ||
    lower.endsWith('.rst') ||
    lower.endsWith('.txt') ||
    lower.startsWith('docs/') ||
    lower.includes('/docs/')
  ) {
    return 'doc';
  }
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml') ||
    lower.endsWith('.ini') ||
    lower.endsWith('.env.example') ||
    lower.endsWith('dockerfile') ||
    lower.endsWith('tsconfig.json') ||
    lower.endsWith('vite.config.ts')
  ) {
    return 'config';
  }
  return 'code';
}

/**
 * Detect human-readable programming language or format from file extension
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'TypeScript';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'JavaScript';
    case '.py':
      return 'Python';
    case '.go':
      return 'Go';
    case '.rs':
      return 'Rust';
    case '.java':
      return 'Java';
    case '.rb':
      return 'Ruby';
    case '.php':
      return 'PHP';
    case '.cs':
      return 'C#';
    case '.cpp':
    case '.cc':
    case '.cxx':
    case '.c':
    case '.h':
    case '.hpp':
      return 'C/C++';
    case '.md':
    case '.mdx':
      return 'Markdown';
    case '.json':
      return 'JSON';
    case '.yaml':
    case '.yml':
      return 'YAML';
    case '.toml':
      return 'TOML';
    case '.html':
      return 'HTML';
    case '.css':
    case '.scss':
    case '.sass':
    case '.less':
      return 'CSS';
    case '.sql':
      return 'SQL';
    case '.sh':
    case '.bash':
    case '.zsh':
      return 'Shell';
    default:
      return 'Text';
  }
}

/**
 * Enhanced Citation extractor supporting spaces, special characters, and line spans
 */
export function extractCitationsFromText(text: string, files: SourceFile[] = []): Citation[] {
  // Matches [path/to/file.tsx:L12-L24] or [my component.ts:L10] or [README.md:12-24]
  const citationRegex = /\[([^\]:]+):L?(\d+)(?:-L?(\d+))?\]/g;
  const citations: Citation[] = [];
  let match;
  const seenKeys = new Set<string>();

  while ((match = citationRegex.exec(text)) !== null) {
    const [, filePathRaw, startStr, endStr] = match;
    const filePath = filePathRaw.trim();
    const startLine = parseInt(startStr, 10);
    const endLine = endStr ? parseInt(endStr, 10) : startLine;
    const key = `${filePath}:${startLine}-${endLine}`;

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const matchingFile = (files || []).find(
        (f) => f.path.toLowerCase() === filePath.toLowerCase() || f.path.endsWith(filePath)
      );
      let snippet = '';
      if (matchingFile) {
        const lines = matchingFile.content.split('\n');
        snippet = lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
      }

      citations.push({
        id: `cit-${citations.length + 1}`,
        filePath: matchingFile ? matchingFile.path : filePath,
        startLine,
        endLine,
        snippet,
        fileCategory: matchingFile?.fileCategory || determineFileCategory(filePath),
      });
    }
  }

  return citations;
}
