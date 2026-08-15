import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { FileChunk, SourceFile, RepoSource, Citation, AnswerMode, ArtifactType } from './src/types';
import { createChunksFromFile, getSampleZustandNotebook } from './src/sampleRepos';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK with User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Helper to determine file category
function determineFileCategory(filePath: string): SourceFile['fileCategory'] {
  const lower = filePath.toLowerCase();
  if (lower.startsWith('.github/workflows') || lower.endsWith('.gitlab-ci.yml') || lower.includes('azure-pipelines')) {
    return 'workflow';
  }
  if (
    lower.includes('test') ||
    lower.includes('spec') ||
    lower.endsWith('.test.ts') ||
    lower.endsWith('.test.js') ||
    lower.endsWith('.spec.ts') ||
    lower.endsWith('.spec.js') ||
    lower.endsWith('_test.py') ||
    lower.endsWith('_test.go')
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

// Helper to detect language
function detectLanguage(filePath: string): string {
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
      return 'C/C++';
    case '.md':
    case '.mdx':
      return 'Markdown';
    case '.json':
      return 'JSON';
    case '.yaml':
    case '.yml':
      return 'YAML';
    case '.html':
      return 'HTML';
    case '.css':
    case '.scss':
      return 'CSS';
    case '.sql':
      return 'SQL';
    case '.sh':
    case '.bash':
      return 'Shell';
    default:
      return 'Text';
  }
}

// Parse GitHub URL
function parseGitHubUrl(rawUrl: string): { owner: string; repo: string } | null {
  const cleaned = rawUrl.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/$/, '');
  const parts = cleaned.split('/');
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

// Ingest repository endpoint
app.post('/api/repo/ingest', async (req, res) => {
  const { repoUrl, ref, githubToken, pathFilter } = req.body;

  if (!repoUrl) {
    return res.status(400).json({ error: 'GitHub repository URL is required' });
  }

  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid GitHub repository URL or identifier' });
  }

  const { owner, repo } = parsed;
  const fullName = `${owner}/${repo}`;

  // If zustand demo requested or offline match
  if (fullName.toLowerCase() === 'pmndrs/zustand' && !githubToken) {
    const demo = getSampleZustandNotebook();
    return res.json({
      source: demo.source,
      files: demo.files,
      chunks: demo.chunks,
      suggestedQuestions: demo.suggestedQuestions,
      isSampleFallback: false,
    });
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'RepoNotebook-App',
    };
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    // 1. Fetch Repo Metadata
    const repoMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    
    if (!repoMetaRes.ok) {
      if (repoMetaRes.status === 403 || repoMetaRes.status === 429) {
        // Rate limit hit -> provide structured fallback or prompt for token
        console.warn(`GitHub API Rate limit for ${fullName}. Falling back to sample indexed repo.`);
        const demo = getSampleZustandNotebook();
        demo.source.fullName = fullName;
        demo.source.name = repo;
        demo.source.owner = owner;
        demo.source.repoUrl = `https://github.com/${fullName}`;
        return res.json({
          source: demo.source,
          files: demo.files,
          chunks: demo.chunks,
          suggestedQuestions: demo.suggestedQuestions,
          isSampleFallback: true,
          rateLimitNotice: 'GitHub public API rate limit reached (60/hr). Loaded representative repository index. Provide a GitHub personal token in settings for unlimited private/public repo live access.',
        });
      }
      return res.status(repoMetaRes.status).json({
        error: `Failed to fetch repo from GitHub: ${repoMetaRes.statusText} (${repoMetaRes.status})`,
      });
    }

    const repoMeta = await repoMetaRes.json();
    const targetRef = ref || repoMeta.default_branch || 'main';

    // 2. Fetch Languages
    let languages: Record<string, number> = {};
    try {
      const langRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
      if (langRes.ok) {
        languages = await langRes.json();
      }
    } catch (e) {
      console.warn('Could not fetch languages', e);
    }

    // 3. Fetch Git Tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetRef}?recursive=1`,
      { headers }
    );

    let treeItems: Array<{ path: string; type: string; size?: number; url: string }> = [];
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      treeItems = (treeData.tree || []).filter((item: any) => item.type === 'blob');
    }

    // Filter files: exclude binary, lockfiles, huge bundles
    const ignoredPatterns = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.svg',
      '.ico',
      '.woff',
      '.woff2',
      '.ttf',
      '.eot',
      '.mp4',
      '.mp3',
      '.zip',
      '.tar',
      '.gz',
      'node_modules/',
      'dist/',
      'build/',
      '.next/',
      '.git/',
      '.idea/',
      '.vscode/',
    ];

    let eligibleFiles = treeItems.filter((item) => {
      const lower = item.path.toLowerCase();
      return !ignoredPatterns.some((pattern) => lower.includes(pattern) || lower.endsWith(pattern));
    });

    if (pathFilter && pathFilter.trim() !== '') {
      const cleanFilter = pathFilter.trim().replace(/^\//, '');
      eligibleFiles = eligibleFiles.filter((item) => item.path.startsWith(cleanFilter));
    }

    // Prioritize high-value files:
    // 1. README & main docs
    // 2. package.json, Cargo.toml, pyproject.toml, go.mod
    // 3. Main source files (src/, lib/, index.*, app.*)
    // 4. Workflows & configs
    // 5. Tests
    eligibleFiles.sort((a, b) => {
      const priority = (p: string) => {
        const lp = p.toLowerCase();
        if (lp === 'readme.md' || lp === 'readme') return 0;
        if (lp.startsWith('docs/')) return 1;
        if (lp === 'package.json' || lp === 'pyproject.toml' || lp === 'cargo.toml' || lp === 'go.mod') return 2;
        if (lp.startsWith('src/') || lp.startsWith('lib/')) return 3;
        if (lp.startsWith('.github/workflows')) return 4;
        if (lp.includes('test')) return 5;
        return 6;
      };
      return priority(a.path) - priority(b.path);
    });

    // Limit to top 25 files for fast, dense grounding
    const selectedFiles = eligibleFiles.slice(0, 25);

    // 4. Fetch content for each selected file
    const fetchedFiles: SourceFile[] = [];

    await Promise.all(
      selectedFiles.map(async (item, idx) => {
        try {
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${targetRef}/${item.path}`;
          const contentRes = await fetch(rawUrl, { headers });
          if (contentRes.ok) {
            const text = await contentRes.text();
            // Skip massive files (> 200KB)
            if (text.length > 200000) return;

            const category = determineFileCategory(item.path);
            const language = detectLanguage(item.path);
            const lineCount = text.split('\n').length;

            fetchedFiles.push({
              id: `f-${idx}-${item.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
              path: item.path,
              language,
              fileCategory: category,
              size: item.size || text.length,
              lineCount,
              content: text,
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch file ${item.path}`, err);
        }
      })
    );

    // If fetch failed to get any files (e.g. private repo without token), throw clear error
    if (fetchedFiles.length === 0) {
      return res.status(404).json({
        error: `Could not retrieve file contents from ${fullName} at ref '${targetRef}'. If this is a private repository, please supply a GitHub Personal Access Token with repo read permissions.`,
      });
    }

    // Sort fetched files by path
    fetchedFiles.sort((a, b) => a.path.localeCompare(b.path));

    // Create chunks
    const chunks: FileChunk[] = fetchedFiles.flatMap(createChunksFromFile);

    // Category counts
    const categoryCounts = {
      doc: fetchedFiles.filter((f) => f.fileCategory === 'doc').length,
      code: fetchedFiles.filter((f) => f.fileCategory === 'code').length,
      config: fetchedFiles.filter((f) => f.fileCategory === 'config').length,
      test: fetchedFiles.filter((f) => f.fileCategory === 'test').length,
      workflow: fetchedFiles.filter((f) => f.fileCategory === 'workflow').length,
    };

    const source: RepoSource = {
      repoUrl: `https://github.com/${fullName}`,
      owner,
      name: repo,
      fullName,
      description: repoMeta.description || 'No description provided.',
      defaultBranch: repoMeta.default_branch || 'main',
      selectedRef: targetRef,
      license: repoMeta.license?.spdx_id || repoMeta.license?.name || 'Not specified',
      stars: repoMeta.stargazers_count || 0,
      forks: repoMeta.forks_count || 0,
      openIssues: repoMeta.open_issues_count || 0,
      topics: repoMeta.topics || [],
      languages,
      primaryLanguage: repoMeta.language || Object.keys(languages)[0] || 'Code',
      avatarUrl: repoMeta.owner?.avatar_url || `https://github.com/${owner}.png`,
      lastSyncedAt: new Date().toISOString(),
      isPrivate: repoMeta.private || false,
      totalFiles: fetchedFiles.length,
      totalLines: fetchedFiles.reduce((acc, f) => acc + f.lineCount, 0),
      categoryCounts,
    };

    const suggestedQuestions = [
      `What does ${repo} do and what problem does it solve?`,
      `How is the codebase structured and where is the main entry point?`,
      `How do I get started with ${repo} locally?`,
      `What are the core abstractions and design patterns used here?`,
      `What dependencies and build scripts are declared in package / config files?`,
      `What tests are implemented and how is CI configured?`,
    ];

    return res.json({
      source,
      files: fetchedFiles,
      chunks,
      suggestedQuestions,
      isSampleFallback: false,
    });
  } catch (error: any) {
    console.error('Ingest error:', error);
    return res.status(500).json({
      error: `Ingestion failed: ${error.message || 'Internal server error'}`,
    });
  }
});

// Retrieval helper: rank chunks based on query keywords, symbols, paths, and category
function retrieveRelevantChunks(
  query: string,
  chunks: FileChunk[],
  topK: number = 10
): FileChunk[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['what', 'how', 'when', 'where', 'which', 'this', 'that', 'with', 'from', 'repo', 'does', 'have'].includes(t));

  if (terms.length === 0) {
    return chunks.slice(0, topK);
  }

  const scored = chunks.map((chunk) => {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerPath = chunk.filePath.toLowerCase();
    const lowerSymbol = (chunk.symbolName || '').toLowerCase();

    // Direct filename / path match
    for (const term of terms) {
      if (lowerPath.includes(term)) score += 8;
      if (lowerSymbol.includes(term)) score += 10;
      
      const countInContent = (lowerContent.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      score += Math.min(countInContent, 5) * 2;
    }

    // Boost docs for general architectural / overview queries
    if (query.toLowerCase().includes('what') || query.toLowerCase().includes('overview') || query.toLowerCase().includes('explain')) {
      if (chunk.fileCategory === 'doc') score += 4;
    }

    // Boost code for function / implementation / type queries
    if (query.toLowerCase().includes('function') || query.toLowerCase().includes('class') || query.toLowerCase().includes('code') || query.toLowerCase().includes('internal') || query.toLowerCase().includes('how')) {
      if (chunk.fileCategory === 'code') score += 4;
    }

    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

// Resilient Gemini content generation with exponential backoff and fallback models
async function generateContentWithRetry(
  params: {
    contents: string | any[];
    systemInstruction?: string;
    temperature?: number;
    responseMimeType?: string;
    preferredModel?: string;
  },
  maxRetries = 3
) {
  // Support user-selected model (gemini-3.7-flash, gemini-3.5-flash-lite, gemini-3.1-flash-lite)
  const targetModel = params.preferredModel || 'gemini-3.7-flash';
  const modelsToTry = [
    targetModel,
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ];

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const model = modelsToTry[Math.min(attempt, modelsToTry.length - 1)];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
          ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
          ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Attempt ${attempt + 1} with ${model} failed]:`, err.message || err);

      const isTransient =
        err?.status === 'UNAVAILABLE' ||
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('429') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');

      if (attempt < maxRetries - 1) {
        const delay = isTransient ? Math.min(800 * Math.pow(2, attempt) + Math.random() * 200, 3000) : 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError;
}

// Chat / Q&A endpoint
app.post('/api/repo/query', async (req, res) => {
  const { question, messages, repoSource, chunks, files, answerMode = 'detailed', model = 'gemini-3.7-flash' } = req.body;

  if (!question || !repoSource) {
    return res.status(400).json({ error: 'Question and repoSource are required' });
  }

  try {
    // 1. Retrieve top grounded chunks
    const retrievedChunks = retrieveRelevantChunks(question, chunks || [], 10);

    // 2. Prepare Context string with explicit line numbers and file paths
    const contextBlock = retrievedChunks
      .map(
        (c) =>
          `=== FILE: ${c.filePath} (Lines ${c.startLine}-${c.endLine}) [Category: ${c.fileCategory}] ===\n${c.content}\n`
      )
      .join('\n');

    // 3. System prompt enforcing strict single-repo grounding
    const answerModeInstructions: Record<AnswerMode, string> = {
      concise: 'Provide a direct, concise response highlighting the essential facts and line references without fluff.',
      detailed: 'Provide a thorough, comprehensive technical breakdown with deep code context, explanations, and citations.',
      code: 'Focus heavily on code snippets, function definitions, types, data flow, and exact line ranges in the repository.',
      architecture: 'Explain the high-level system architecture, module boundaries, directory layout, and integration points.',
      beginner: 'Explain clearly with accessible metaphors and gentle walkthroughs, while still citing the exact source files.',
    };

    const systemInstruction = `You are RepoNotebook, a repository-grounded assistant.
Your ONLY knowledge source for this notebook is the GitHub repository: ${repoSource.fullName} (${repoSource.repoUrl}) on ref: ${repoSource.selectedRef}.

CRITICAL GROUNDING RULES:
1. Answer using ONLY the repository contents provided in the context below.
2. CITE SPECIFIC FILES AND LINE RANGES for every factual statement, API, feature, configuration, and code snippet.
   Use the exact citation tag format: [filepath:L<start>-L<end>] (e.g. [README.md:L5-L18] or [src/vanilla.ts:L34-L52]).
3. If the user asks something that is NOT found in the provided repository context, explicitly state: "I could not find this in the repository ${repoSource.fullName}."
4. STRICT REFUSAL OF EXTERNAL TOPICS: If asked about general knowledge, external libraries not in this repo, or other repositories, politely explain that this RepoNotebook is strictly bound to ${repoSource.fullName} and cannot reference external sources.
5. Do NOT invent APIs, files, methods, configuration flags, or dependencies.
6. Clearly distinguish between what is directly stated in code/docs vs inferred.
7. Style Guideline: ${answerModeInstructions[answerMode as AnswerMode] || answerModeInstructions.detailed}`;

    const promptText = `Grounding Context from ${repoSource.fullName}:\n\n${contextBlock}\n\nUser Question: ${question}\n\nAnswer with precise citations [filepath:L<start>-L<end>]:`;

    // 4. Call Gemini with retry & fallback using chosen model
    const response = await generateContentWithRetry({
      preferredModel: model,
      contents: promptText,
      systemInstruction,
      temperature: 0.2, // Low temperature for high factual precision
    });

    const replyText = response.text || 'I could not generate an answer from the repository context.';

    // 5. Extract Citations from reply text
    const citationRegex = /\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g;
    const citations: Citation[] = [];
    let match;
    const seenKeys = new Set<string>();

    while ((match = citationRegex.exec(replyText)) !== null) {
      const [fullMatch, filePath, startStr, endStr] = match;
      const startLine = parseInt(startStr, 10);
      const endLine = endStr ? parseInt(endStr, 10) : startLine;
      const key = `${filePath}:${startLine}-${endLine}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        // Find corresponding file snippet
        const matchingFile = (files as SourceFile[] || []).find((f) => f.path === filePath);
        let snippet = '';
        if (matchingFile) {
          const lines = matchingFile.content.split('\n');
          snippet = lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
        }

        citations.push({
          id: `cit-${citations.length + 1}`,
          filePath,
          startLine,
          endLine,
          snippet,
          fileCategory: matchingFile?.fileCategory || 'code',
        });
      }
    }

    // If no explicit regex citations were captured but retrieved chunks were used, anchor with the top chunk
    if (citations.length === 0 && retrievedChunks.length > 0 && !replyText.includes('could not find this')) {
      const top = retrievedChunks[0];
      citations.push({
        id: 'cit-primary-1',
        filePath: top.filePath,
        startLine: top.startLine,
        endLine: top.endLine,
        snippet: top.content.slice(0, 300),
        fileCategory: top.fileCategory,
      });
    }

    // 6. Generate 3 smart follow-up suggestions
    let suggestedFollowUps: string[] = [
      'How does this integrate with the rest of the codebase?',
      'What are the error handling mechanisms used here?',
      'Where are the unit tests for this functionality?',
    ];

    try {
      const followUpRes = await generateContentWithRetry({
        preferredModel: model,
        contents: `Based on the repository ${repoSource.fullName} and the recent Q&A:\nQuestion: "${question}"\nAnswer excerpt: "${replyText.slice(0, 300)}"\n\nGenerate 3 concise, highly relevant follow-up questions a developer or researcher would ask next about this specific repo code/docs. Return ONLY a JSON array of 3 strings.`,
        responseMimeType: 'application/json',
      });

      if (followUpRes.text) {
        const parsed = JSON.parse(followUpRes.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          suggestedFollowUps = parsed;
        }
      }
    } catch {
      // Keep defaults on suggestion failure
    }

    const confidence = replyText.includes('could not find this') ? 'not_found' : 'grounded';

    return res.json({
      content: replyText,
      citations,
      suggestedFollowUps: Array.isArray(suggestedFollowUps) ? suggestedFollowUps.slice(0, 3) : [],
      confidence,
      modelUsed: model,
    });
  } catch (error: any) {
    console.error('Query error:', error);
    return res.status(500).json({ error: `Query failed: ${error.message || 'Unknown error'}` });
  }
});

// Artifact generation endpoint
app.post('/api/repo/artifact', async (req, res) => {
  const { artifactType, repoSource, chunks, files } = req.body;

  if (!artifactType || !repoSource) {
    return res.status(400).json({ error: 'artifactType and repoSource are required' });
  }

  const type = artifactType as ArtifactType;

  // Filter chunks relevant to the requested artifact type
  let relevantChunks: FileChunk[] = (chunks as FileChunk[]) || [];

  if (type === 'overview' || type === 'getting_started') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'doc' || c.filePath.includes('package') || c.filePath.includes('README'));
  } else if (type === 'mindmap' || type === 'architecture') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'code' || c.fileCategory === 'doc' || c.filePath.includes('index') || c.filePath.includes('src'));
  } else if (type === 'slideshow') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'doc' || c.fileCategory === 'code' || c.filePath.includes('README'));
  } else if (type === 'testing') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'test' || c.filePath.includes('test') || c.filePath.includes('vitest') || c.filePath.includes('jest'));
  } else if (type === 'deployment_ci') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'workflow' || c.fileCategory === 'config');
  } else if (type === 'dependency_map') {
    relevantChunks = relevantChunks.filter((c) => c.fileCategory === 'config' || c.filePath.includes('package.json') || c.filePath.includes('Cargo.toml') || c.filePath.includes('go.mod'));
  }

  if (relevantChunks.length < 5) {
    relevantChunks = (chunks as FileChunk[]) || [];
  }

  const contextBlock = relevantChunks
    .slice(0, 15)
    .map(
      (c) =>
        `=== FILE: ${c.filePath} (Lines ${c.startLine}-${c.endLine}) [Category: ${c.fileCategory}] ===\n${c.content}\n`
    )
    .join('\n');

  const artifactPrompts: Record<ArtifactType, { title: string; instruction: string }> = {
    overview: {
      title: 'Repository Overview',
      instruction: 'Create a comprehensive executive overview of what this repository does, its primary purpose, core features, target audience, and key technical capabilities with citations.',
    },
    mindmap: {
      title: 'Interactive Codebase Mindmap',
      instruction: `Generate an interactive, hierarchical codebase mindmap for ${repoSource.fullName}.
Your output MUST include:
1. A clean Mermaid mindmap block:
\`\`\`mermaid
mindmap
  root(("${repoSource.name}"))
    ["Architecture & Entry Points"]
      ["Main Entry / Exports"]
      ["Core Engine & Lifecycle"]
    ["Core Modules & Types"]
      ["Primary Stores / State"]
      ["Internal Abstractions"]
    ["API & Public Surface"]
      ["Consumer Functions / Hooks"]
      ["Middleware & Plugins"]
    ["Tooling & Quality"]
      ["Test Suites"]
      ["CI/CD Pipelines"]
\`\`\`
2. A detailed structured outline explaining each branch and node in detail with exact line citations: [filepath:L<start>-L<end>].
3. Key relationships and data flows between modules.`,
    },
    slideshow: {
      title: 'Repository Deep-Dive Slide Deck',
      instruction: `Generate an interactive 7-9 slide technical presentation deck for repository ${repoSource.fullName}.
Format each slide separated by '---' delimiters.
Each slide must include:
# Slide [Number]: [Title]
### [Subtitle / Theme]
- High-impact bullet points explaining architectural decisions, APIs, and patterns
- Code snippets (\`\`\`lang ... \`\`\`) where relevant
- Citations anchored in source files: [filepath:L<start>-L<end>]
- **Speaker Notes**: Key talking points for the presenter

Include slides for:
1. Introduction & Mission
2. Architecture Overview
3. Core Entry Points & State Lifecycle
4. Main API Surface & Usage Patterns
5. Internal Mechanisms & Algorithms
6. Testing & Build Workflows
7. Extensibility, Gotchas & Roadmap`,
    },
    getting_started: {
      title: 'Getting Started Guide',
      instruction: 'Generate a step-by-step developer setup and usage guide including installation, environment setup, initial store/client creation, and execution instructions cited from the repo.',
    },
    architecture: {
      title: 'Architecture & Design Summary',
      instruction: 'Detail the high-level architecture, module relationships, state/data lifecycle, core design patterns, and internal abstractions backed by source citations.',
    },
    glossary: {
      title: 'Key Concepts & Terms Glossary',
      instruction: 'Compile a curated glossary of the 5-10 most critical domain concepts, types, classes, and exported interfaces in this repository with their definitions and file locations.',
    },
    api_surface: {
      title: 'API Surface & Exported Interface Summary',
      instruction: 'Document all main public APIs, exported functions, hook signatures, configuration parameters, and types available to consumers of this package.',
    },
    folder_structure: {
      title: 'Folder Structure & Directory Explainer',
      instruction: 'Provide a structured breakdown of each directory and key file in the repository, explaining the responsibility and purpose of each path.',
    },
    dependency_map: {
      title: 'Dependency Map & Ecosystem Analysis',
      instruction: 'Analyze the runtime dependencies, peer dependencies, and dev tooling defined in the package/configuration manifests and explain what each is used for.',
    },
    testing: {
      title: 'Testing Strategy & Coverage Overview',
      instruction: 'Review the testing frameworks, test suite organization, key test cases, mock strategies, and execution commands present in the repository.',
    },
    deployment_ci: {
      title: 'CI/CD & Deployment Workflows',
      instruction: 'Summarize the automated workflows, GitHub Actions pipelines, build scripts, linting, and release pipelines configured in the repo.',
    },
    faq: {
      title: 'Frequently Asked Questions (FAQ)',
      instruction: 'Generate 5-7 frequently asked questions about using, configuring, troubleshooting, and extending this codebase, complete with grounded answers and citations.',
    },
    onboarding: {
      title: 'New Contributor Onboarding Checklist',
      instruction: 'Create an actionable onboarding roadmap for a new engineer or open-source contributor: prerequisites, local setup, running tests, codebase navigation landmarks, and contribution guidelines.',
    },
    risks_rough_edges: {
      title: 'Risks, Missing Docs & Rough Edges',
      instruction: 'Identify potential architectural risks, undocumented features, missing tests, deprecated patterns, or rough edges observed across the repository files.',
    },
    change_summary: {
      title: 'Release & Versioning Summary',
      instruction: 'Summarize the package version, licensing, release artifacts, and core configuration changes grounded in package manifests and docs.',
    },
  };

  const selectedArtifact = artifactPrompts[type] || artifactPrompts.overview;

  try {
    const response = await generateContentWithRetry({
      preferredModel: 'gemini-2.5-flash',
      contents: `You are generating a NotebookLM research artifact for the repository ${repoSource.fullName}.\n\nTask: ${selectedArtifact.instruction}\n\nGrounding Context:\n${contextBlock}\n\nFormat with clean Markdown headers (##, ###), bullet points, code blocks where appropriate, and cite specific file paths and lines with [filepath:L<start>-L<end>].`,
      systemInstruction: `You are RepoNotebook. Generate rigorous, citation-backed artifacts strictly from the provided repository evidence.`,
      temperature: 0.2,
    });

    const content = response.text || 'Could not generate artifact.';

    // Parse citations
    const citationRegex = /\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g;
    const citations: Citation[] = [];
    let match;
    const seenKeys = new Set<string>();

    while ((match = citationRegex.exec(content)) !== null) {
      const [fullMatch, filePath, startStr, endStr] = match;
      const startLine = parseInt(startStr, 10);
      const endLine = endStr ? parseInt(endStr, 10) : startLine;
      const key = `${filePath}:${startLine}-${endLine}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const matchingFile = (files as SourceFile[] || []).find((f) => f.path === filePath);
        let snippet = '';
        if (matchingFile) {
          const lines = matchingFile.content.split('\n');
          snippet = lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
        }

        citations.push({
          id: `art-cit-${citations.length + 1}`,
          filePath,
          startLine,
          endLine,
          snippet,
          fileCategory: matchingFile?.fileCategory || 'doc',
        });
      }
    }

    return res.json({
      id: `art-${Date.now()}`,
      type,
      title: selectedArtifact.title,
      content,
      citations,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Artifact error:', error);
    return res.status(500).json({ error: `Artifact generation failed: ${error.message}` });
  }
});

// Merge notes into a synthesized research briefing
app.post('/api/notes/merge', async (req, res) => {
  const { notes, repoSource } = req.body;

  if (!notes || !Array.isArray(notes) || notes.length === 0) {
    return res.status(400).json({ error: 'At least one note is required to merge' });
  }

  const notesText = notes
    .map((n: any, i: number) => `### Note ${i + 1}: ${n.title}\n${n.content}\nTags: ${(n.tags || []).join(', ')}\n`)
    .join('\n---\n\n');

  try {
    const response = await generateContentWithRetry({
      preferredModel: 'gemini-2.5-flash',
      contents: `Synthesize the following research notes into a cohesive, structured Executive Briefing and Research Summary for repository ${repoSource?.fullName || 'the repository'}:\n\n${notesText}\n\nOrganize into Executive Summary, Key Technical Findings, Open Questions, and Actionable Next Steps. Maintain all file citations.`,
      systemInstruction: `You are RepoNotebook's research synthesizer. Create high-clarity synthesized briefings from user notes.`,
      temperature: 0.3,
    });

    return res.json({
      title: `Executive Briefing: ${repoSource?.name || 'Repository'} Synthesis`,
      content: response.text || 'Failed to synthesize notes.',
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: `Failed to merge notes: ${error.message}` });
  }
});

// Start Express Server with Vite integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RepoNotebook Server running on http://localhost:${PORT}`);
  });
}

startServer();
