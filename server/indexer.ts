import { SourceFile, FileChunk, FileCategory } from '../src/types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'this', 'then', 'there', 'what', 'how', 'when', 'where',
  'which', 'who', 'why', 'can', 'could', 'should', 'would', 'does', 'have',
  'repo', 'code', 'file', 'files', 'please', 'tell', 'show', 'explain',
]);

/**
 * Enhanced semantic & syntactic chunker that creates clean, bounded chunks
 * with exact line numbering and symbol identification.
 */
export function chunkFileContent(file: SourceFile): FileChunk[] {
  const lines = file.content.split('\n');
  const totalLines = lines.length;
  if (totalLines === 0) return [];

  const chunks: FileChunk[] = [];
  const maxChunkLines = file.fileCategory === 'doc' ? 45 : 35;
  const minOverlap = 6;

  // Check if file is small enough to be a single chunk
  if (totalLines <= maxChunkLines + 5) {
    const symbol = detectPrimarySymbol(file.content, file.fileCategory);
    chunks.push({
      id: `${file.id}-chunk-1-${totalLines}`,
      fileId: file.id,
      filePath: file.path,
      startLine: 1,
      endLine: totalLines,
      chunkType: determineChunkType(file.content, file.fileCategory),
      content: file.content,
      language: file.language,
      fileCategory: file.fileCategory,
      symbolName: symbol,
    });
    return chunks;
  }

  let start = 1;
  while (start <= totalLines) {
    let end = Math.min(start + maxChunkLines - 1, totalLines);

    // Try to snap to natural boundary (empty line, function close, class end)
    if (end < totalLines) {
      for (let i = end; i >= Math.max(start + 15, end - 10); i--) {
        const line = lines[i - 1]?.trim() || '';
        if (line === '' || line === '}' || line.startsWith('export ') || line.startsWith('#') || line.startsWith('func ') || line.startsWith('def ')) {
          end = i;
          break;
        }
      }
    }

    const chunkLines = lines.slice(start - 1, end);
    const chunkText = chunkLines.join('\n');
    const symbol = detectPrimarySymbol(chunkText, file.fileCategory);
    const chunkType = determineChunkType(chunkText, file.fileCategory);

    chunks.push({
      id: `${file.id}-chunk-${start}-${end}`,
      fileId: file.id,
      filePath: file.path,
      startLine: start,
      endLine: end,
      chunkType,
      content: chunkText,
      language: file.language,
      fileCategory: file.fileCategory,
      symbolName: symbol,
    });

    if (end >= totalLines) break;
    start = Math.max(start + 1, end - minOverlap + 1);
  }

  return chunks;
}

function detectPrimarySymbol(content: string, category: FileCategory): string | undefined {
  if (category === 'doc') {
    const heading = content.match(/^#+\s+(.+)$/m);
    if (heading) return heading[1].trim();
  } else if (category === 'code') {
    // TypeScript / JS
    const tsFunc = content.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/);
    if (tsFunc) return `function ${tsFunc[1]}`;

    const tsClass = content.match(/(?:export\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (tsClass) return `class ${tsClass[1]}`;

    const tsInterface = content.match(/(?:export\s+)?(?:interface|type)\s+([A-Za-z0-9_$]+)/);
    if (tsInterface) return `type ${tsInterface[1]}`;

    const arrowFunc = content.match(/(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?\(/);
    if (arrowFunc) return `const ${arrowFunc[1]}`;

    // Python
    const pyDef = content.match(/def\s+([A-Za-z0-9_]+)\s*\(/);
    if (pyDef) return `def ${pyDef[1]}`;

    const pyClass = content.match(/class\s+([A-Za-z0-9_]+)/);
    if (pyClass) return `class ${pyClass[1]}`;

    // Go
    const goFunc = content.match(/func\s+(?:\([^)]+\)\s*)?([A-Za-z0-9_]+)\s*\(/);
    if (goFunc) return `func ${goFunc[1]}`;

    // Rust
    const rustFn = content.match(/(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/);
    if (rustFn) return `fn ${rustFn[1]}`;
  } else if (category === 'config') {
    const yamlKey = content.match(/^([a-zA-Z0-9_-]+):/m);
    if (yamlKey) return `config:${yamlKey[1]}`;
  }
  return undefined;
}

function determineChunkType(content: string, category: FileCategory): FileChunk['chunkType'] {
  if (category === 'doc') return 'doc_section';
  if (category === 'config' || category === 'workflow') return 'config';
  if (content.includes('class ') || content.includes('interface ')) return 'class';
  if (content.includes('function ') || content.includes('const ') || content.includes('def ') || content.includes('fn ')) return 'function';
  return 'general';
}

/**
 * Tokenize string into normalized terms
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_$-]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !STOP_WORDS.has(term));
}

/**
 * In-Memory Inverted Index & BM25 Scoring Retrieval Engine
 * Supports repositories with hundreds of files and thousands of chunks.
 */
export class InvertedIndex {
  private docFrequencies: Map<string, number> = new Map();
  private chunkIndex: Map<string, { termFreqs: Map<string, number>; length: number; chunk: FileChunk }> = new Map();
  private avgChunkLength: number = 0;
  private totalChunks: number = 0;

  constructor(chunks: FileChunk[]) {
    this.totalChunks = chunks.length;
    let totalTerms = 0;

    for (const chunk of chunks) {
      const tokens = tokenize(`${chunk.filePath} ${chunk.symbolName || ''} ${chunk.content}`);
      const termFreqs = new Map<string, number>();
      const seenTerms = new Set<string>();

      for (const token of tokens) {
        termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
        seenTerms.add(token);
      }

      for (const token of seenTerms) {
        this.docFrequencies.set(token, (this.docFrequencies.get(token) || 0) + 1);
      }

      this.chunkIndex.set(chunk.id, {
        termFreqs,
        length: tokens.length,
        chunk,
      });

      totalTerms += tokens.length;
    }

    this.avgChunkLength = this.totalChunks > 0 ? totalTerms / this.totalChunks : 1;
  }

  /**
   * Search chunks using BM25 ranking algorithm with symbol and path boosts
   */
  public search(query: string, topK: number = 20): FileChunk[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return Array.from(this.chunkIndex.values()).slice(0, topK).map((item) => item.chunk);
    }

    const k1 = 1.5;
    const b = 0.75;
    const queryLower = query.toLowerCase();

    const isDocIntent = queryLower.includes('what') || queryLower.includes('how to') || queryLower.includes('readme') || queryLower.includes('overview') || queryLower.includes('guide');
    const isCodeIntent = queryLower.includes('function') || queryLower.includes('class') || queryLower.includes('type') || queryLower.includes('implement') || queryLower.includes('call');
    const isConfigIntent = queryLower.includes('config') || queryLower.includes('dependency') || queryLower.includes('package') || queryLower.includes('script') || queryLower.includes('ci');

    const scores: Array<{ chunk: FileChunk; score: number }> = [];

    for (const [, entry] of this.chunkIndex.entries()) {
      const { termFreqs, length, chunk } = entry;
      let score = 0;

      const pathLower = chunk.filePath.toLowerCase();
      const symbolLower = (chunk.symbolName || '').toLowerCase();
      const contentLower = chunk.content.toLowerCase();

      for (const token of queryTokens) {
        const tf = termFreqs.get(token) || 0;
        const df = this.docFrequencies.get(token) || 1;
        const idf = Math.log(1 + (this.totalChunks - df + 0.5) / (df + 0.5));

        // BM25 Core Score
        const termScore = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (length / (this.avgChunkLength || 1)))));
        score += termScore;

        // Path exact token match boost
        if (pathLower.includes(token)) {
          score += 8.0;
        }

        // Symbol name exact token match boost
        if (symbolLower.includes(token)) {
          score += 15.0;
        }
      }

      // Exact substring match boost
      if (queryTokens.length >= 2) {
        const fullPhrase = queryTokens.join(' ');
        if (contentLower.includes(fullPhrase)) {
          score += 12.0;
        }
      }

      // Category relevance intent weighting
      if (isDocIntent && chunk.fileCategory === 'doc') score += 3.5;
      if (isCodeIntent && chunk.fileCategory === 'code') score += 3.5;
      if (isConfigIntent && (chunk.fileCategory === 'config' || chunk.fileCategory === 'workflow')) score += 4.0;

      // Prioritize entry points and readmes for general queries
      if (pathLower === 'readme.md' || pathLower === 'index.ts' || pathLower === 'index.js' || pathLower === 'main.ts' || pathLower === 'app.tsx') {
        score += 2.0;
      }

      if (score > 0) {
        scores.push({ chunk, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);

    if (scores.length === 0) {
      return Array.from(this.chunkIndex.values()).slice(0, topK).map((item) => item.chunk);
    }

    return scores.slice(0, topK).map((item) => item.chunk);
  }
}

/**
 * Context Budget Optimizer:
 * Packs the most relevant chunks into a token-safe window without exceeding model capacity.
 */
export function buildGroundedPromptContext(
  query: string,
  allChunks: FileChunk[],
  maxTokenBudget: number = 9000
): { contextString: string; retrievedChunks: FileChunk[] } {
  const index = new InvertedIndex(allChunks);
  const candidateChunks = index.search(query, 25);

  let currentTokenEst = 0;
  const selectedChunks: FileChunk[] = [];
  const contextParts: string[] = [];

  for (const chunk of candidateChunks) {
    // 1 token ~ 3.8 chars
    const chunkTokens = Math.ceil(chunk.content.length / 3.8) + 40;
    if (currentTokenEst + chunkTokens > maxTokenBudget && selectedChunks.length >= 5) {
      break;
    }

    selectedChunks.push(chunk);
    currentTokenEst += chunkTokens;

    const symbolHeader = chunk.symbolName ? ` [Symbol: ${chunk.symbolName}]` : '';
    contextParts.push(
      `=== FILE: ${chunk.filePath} (Lines ${chunk.startLine}-${chunk.endLine}) [Category: ${chunk.fileCategory}]${symbolHeader} ===\n${chunk.content}\n`
    );
  }

  return {
    contextString: contextParts.join('\n'),
    retrievedChunks: selectedChunks,
  };
}

/**
 * Generate high-level directory outline for whole-repo architectural awareness
 */
export function generateRepositoryOutline(files: SourceFile[], maxLines: number = 80): string {
  const lines: string[] = [];
  lines.push('REPOSITORY FILE STRUCTURE OVERVIEW:');

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (let i = 0; i < Math.min(sorted.length, maxLines); i++) {
    const f = sorted[i];
    lines.push(`- ${f.path} (${f.language}, ${f.lineCount} lines, [${f.fileCategory}])`);
  }

  if (sorted.length > maxLines) {
    lines.push(`... and ${sorted.length - maxLines} additional files indexed in repository.`);
  }

  return lines.join('\n');
}
