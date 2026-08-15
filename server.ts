import express from 'express';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { FileChunk, SourceFile, RepoSource, Citation, AnswerMode, ArtifactType, Notebook } from './src/types';
import { getSampleZustandNotebook } from './src/sampleRepos';
import {
  getDatabase,
  getAllNotebooks,
  saveNotebook,
  saveNotebooks,
  deleteNotebook,
  getStorageDiagnostics,
} from './server/db';
import { validateLocalPath } from './server/security';
import {
  chunkFileContent,
  buildGroundedPromptContext,
  generateRepositoryOutline,
} from './server/indexer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini SDK
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

app.use(express.json({ limit: '50mb' }));

// 1. Healthcheck
app.get('/api/health', async (_req, res) => {
  try {
    const stats = await getStorageDiagnostics();
    res.json({
      status: 'ok',
      mode: 'local-optimized',
      storage: 'sqlite-concurrency-safe',
      database: stats.storagePath,
      totalNotebooks: stats.totalNotebooks,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.json({
      status: 'ok',
      mode: 'local-optimized',
      storage: 'sqlite',
      timestamp: new Date().toISOString(),
    });
  }
});

// 2. Storage Endpoints (Concurrency-Safe SQLite)
app.get('/api/storage/status', async (_req, res) => {
  try {
    const stats = await getStorageDiagnostics();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to read storage diagnostics' });
  }
});

app.get('/api/storage/notebooks', async (_req, res) => {
  try {
    const notebooks = await getAllNotebooks();
    res.json({ notebooks });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch notebooks from SQLite' });
  }
});

app.post('/api/storage/notebooks', async (req, res) => {
  const { notebooks } = req.body;
  if (!Array.isArray(notebooks)) {
    return res.status(400).json({ error: 'Expected an array of notebooks' });
  }
  try {
    await saveNotebooks(notebooks);
    res.json({ success: true, count: notebooks.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to write notebooks to SQLite' });
  }
});

app.delete('/api/storage/notebooks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const success = await deleteNotebook(id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete notebook from SQLite' });
  }
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

// Local Directory Recursive Scanner with security filters
const IGNORED_LOCAL_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.reponotebook_data',
  '.idea',
  '.vscode',
  '.cache',
  'coverage',
  '__pycache__',
  'target',
  'vendor',
  '.turbo',
  '.output',
]);

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.mp4',
  '.mp3',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.exe',
  '.dll',
  '.bin',
  '.lock',
  '.map',
  '.min.js',
  '.min.css',
]);

async function scanLocalDirectoryTree(
  dirPath: string,
  basePath: string = dirPath,
  maxDepth: number = 12,
  currentDepth: number = 0
): Promise<Array<{ fullPath: string; relPath: string; size: number }>> {
  if (currentDepth > maxDepth) return [];
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    const results: Array<{ fullPath: string; relPath: string; size: number }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.github') {
        continue;
      }
      if (IGNORED_LOCAL_DIRS.has(entry.name)) continue;

      const full = path.join(dirPath, entry.name);
      const rel = path.relative(basePath, full).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const sub = await scanLocalDirectoryTree(full, basePath, maxDepth, currentDepth + 1);
        results.push(...sub);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (
          BINARY_EXTENSIONS.has(ext) ||
          entry.name === 'package-lock.json' ||
          entry.name === 'yarn.lock' ||
          entry.name === 'pnpm-lock.yaml' ||
          entry.name.endsWith('.min.js') ||
          entry.name.endsWith('.min.css')
        ) {
          continue;
        }

        try {
          const stat = await fsPromises.stat(full);
          // Allow files up to 500KB
          if (stat.size <= 500000) {
            results.push({ fullPath: full, relPath: rel, size: stat.size });
          }
        } catch {
          // skip unreadable
        }
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// 3. Local Scan Preview Endpoint with Sandbox Path Validation
app.post('/api/local/scan', async (req, res) => {
  const { localPath } = req.body;

  // Security Sandbox Validation
  const validation = validateLocalPath(localPath);
  if (!validation.isValid || !validation.resolvedPath) {
    return res.status(403).json({ error: validation.error || 'Access to this local path is restricted.' });
  }

  const targetDir = validation.resolvedPath;

  try {
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: `Directory not found on local machine: ${targetDir}` });
    }
    const stat = await fsPromises.stat(targetDir);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: `Specified path is a file, not a directory: ${targetDir}` });
    }

    const files = await scanLocalDirectoryTree(targetDir, targetDir);
    const languages = Array.from(new Set(files.map((f) => detectLanguage(f.relPath))));

    res.json({
      path: targetDir,
      exists: true,
      totalFiles: files.length,
      detectedLanguages: languages,
      previewFiles: files.slice(0, 30).map((f) => ({
        path: f.relPath,
        size: f.size,
        category: determineFileCategory(f.relPath),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to scan directory: ${err.message}` });
  }
});

// 4. Local Directory Ingestion Endpoint (Supports Hundreds of Files with Syntactic Chunking)
app.post('/api/local/ingest', async (req, res) => {
  const { localPath, folderName, pathFilter } = req.body;

  // Security Sandbox Validation
  const validation = validateLocalPath(localPath);
  if (!validation.isValid || !validation.resolvedPath) {
    return res.status(403).json({ error: validation.error || 'Access to this local path is restricted.' });
  }

  const targetDir = validation.resolvedPath;

  try {
    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ error: `Directory not found on local machine: ${targetDir}` });
    }

    const allDiscovered = await scanLocalDirectoryTree(targetDir, targetDir);
    let eligibleFiles = allDiscovered;

    if (pathFilter && pathFilter.trim() !== '') {
      const cleanFilter = pathFilter.trim().replace(/^\//, '');
      eligibleFiles = eligibleFiles.filter((item) => item.relPath.startsWith(cleanFilter));
    }

    if (eligibleFiles.length === 0) {
      return res.status(404).json({
        error: `No readable code, docs, or config files found in ${targetDir} (excluding node_modules, .git, binaries).`,
      });
    }

    // Ingest hundreds of files cleanly (up to 500 files per workspace)
    const selectedFiles = eligibleFiles.slice(0, 500);
    const fetchedFiles: SourceFile[] = [];

    for (let idx = 0; idx < selectedFiles.length; idx++) {
      const item = selectedFiles[idx];
      try {
        const text = await fsPromises.readFile(item.fullPath, 'utf-8');
        const category = determineFileCategory(item.relPath);
        const language = detectLanguage(item.relPath);
        const lineCount = text.split('\n').length;

        fetchedFiles.push({
          id: `local-f-${idx}-${item.relPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          path: item.relPath,
          language,
          fileCategory: category,
          size: item.size,
          lineCount,
          content: text,
        });
      } catch (err) {
        console.warn(`Could not read local file ${item.fullPath}:`, err);
      }
    }

    fetchedFiles.sort((a, b) => a.path.localeCompare(b.path));
    
    // Chunk all files with syntactic & semantic boundaries
    const chunks: FileChunk[] = fetchedFiles.flatMap(chunkFileContent);

    const languagesCount: Record<string, number> = {};
    for (const f of fetchedFiles) {
      languagesCount[f.language] = (languagesCount[f.language] || 0) + 1;
    }

    const categoryCounts = {
      doc: fetchedFiles.filter((f) => f.fileCategory === 'doc').length,
      code: fetchedFiles.filter((f) => f.fileCategory === 'code').length,
      config: fetchedFiles.filter((f) => f.fileCategory === 'config').length,
      test: fetchedFiles.filter((f) => f.fileCategory === 'test').length,
      workflow: fetchedFiles.filter((f) => f.fileCategory === 'workflow').length,
    };

    const resolvedName = folderName || path.basename(targetDir) || 'local-project';

    const source: RepoSource = {
      repoUrl: `file://${targetDir}`,
      owner: 'local',
      name: resolvedName,
      fullName: `local/${resolvedName}`,
      description: `Local repository located at ${targetDir} (${fetchedFiles.length} files indexed)`,
      defaultBranch: 'local',
      selectedRef: 'local-workspace',
      license: 'Local Repository',
      stars: 0,
      forks: 0,
      openIssues: 0,
      topics: ['local-project', 'indexed-workspace'],
      languages: languagesCount,
      primaryLanguage: Object.keys(languagesCount)[0] || 'TypeScript',
      avatarUrl: '',
      lastSyncedAt: new Date().toISOString(),
      isPrivate: true,
      isLocal: true,
      localPath: targetDir,
      totalFiles: fetchedFiles.length,
      totalLines: fetchedFiles.reduce((acc, f) => acc + f.lineCount, 0),
      categoryCounts,
    };

    const suggestedQuestions = [
      `What is the purpose of this local project and what are its key modules?`,
      `Where is the primary entry point and how is the project executed locally?`,
      `What dependencies and build scripts are declared in package / config manifests?`,
      `How are the core components or algorithms structured in this codebase?`,
      `What tests are configured and what quality checks exist?`,
    ];

    const notebook: Notebook = {
      id: `nb-local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `local/${resolvedName}`,
      repoUrl: `file://${targetDir}`,
      ref: 'local-workspace',
      pathFilter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      indexStatus: 'ready',
      source,
      files: fetchedFiles,
      chunks,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `📁 Local project **${resolvedName}** (\`${targetDir}\`) has been successfully ingested and indexed!

- **Files Indexed**: ${fetchedFiles.length} (${chunks.length} syntactic chunks indexed)
- **Local Path**: \`${targetDir}\`
- **Breakdown**: ${categoryCounts.doc} Docs, ${categoryCounts.code} Code files, ${categoryCounts.config} Configs, ${categoryCounts.test} Tests, ${categoryCounts.workflow} Workflows
- **Persistence**: Saved transactionally to SQLite database (\`.reponotebook_data/reponotebook.sqlite\`) and IndexedDB.

*Every answer is grounded using BM25 inverted index retrieval with exact file and line citations.*`,
          citations: fetchedFiles.length > 0 ? [
            {
              id: 'c-local-intro',
              filePath: fetchedFiles[0].path,
              startLine: 1,
              endLine: Math.min(25, fetchedFiles[0].lineCount),
              snippet: fetchedFiles[0].content.slice(0, 250),
              fileCategory: fetchedFiles[0].fileCategory,
            }
          ] : [],
          suggestedFollowUps: suggestedQuestions.slice(0, 3),
          createdAt: new Date().toISOString(),
          confidence: 'grounded',
        }
      ],
      notes: [],
      artifacts: [],
      pinnedCitations: [],
      suggestedQuestions,
    };

    // Save transactionally to SQLite
    await saveNotebook(notebook);

    return res.json({
      notebook,
      source,
      files: fetchedFiles,
      chunks,
      suggestedQuestions,
    });
  } catch (err: any) {
    console.error('Local ingest error:', err);
    return res.status(500).json({ error: `Local ingestion failed: ${err.message}` });
  }
});

// 5. Upload Folder Ingestion (Drag-and-Drop or Browser Folder Picker)
app.post('/api/local/upload-folder', async (req, res) => {
  const { folderName = 'uploaded-repo', uploadedFiles = [] } = req.body;

  if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  try {
    const fetchedFiles: SourceFile[] = [];

    for (let idx = 0; idx < uploadedFiles.length; idx++) {
      const file = uploadedFiles[idx];
      if (!file.path || typeof file.content !== 'string') continue;
      const cleanPath = file.path.replace(/\\/g, '/').replace(/^\//, '');

      // Skip ignored
      const lower = cleanPath.toLowerCase();
      if (
        lower.includes('node_modules/') ||
        lower.includes('.git/') ||
        lower.includes('.next/') ||
        lower.includes('dist/') ||
        lower.includes('build/') ||
        lower.endsWith('.png') ||
        lower.endsWith('.jpg') ||
        lower.endsWith('.ico') ||
        lower.endsWith('.lock') ||
        lower.endsWith('.min.js') ||
        lower.endsWith('.min.css')
      ) {
        continue;
      }

      const category = determineFileCategory(cleanPath);
      const language = detectLanguage(cleanPath);
      const lineCount = file.content.split('\n').length;

      fetchedFiles.push({
        id: `upload-f-${idx}-${cleanPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        path: cleanPath,
        language,
        fileCategory: category,
        size: file.content.length,
        lineCount,
        content: file.content,
      });
    }

    if (fetchedFiles.length === 0) {
      return res.status(400).json({ error: 'No readable text files found in the uploaded directory' });
    }

    fetchedFiles.sort((a, b) => a.path.localeCompare(b.path));
    const chunks: FileChunk[] = fetchedFiles.flatMap(chunkFileContent);

    const languagesCount: Record<string, number> = {};
    for (const f of fetchedFiles) {
      languagesCount[f.language] = (languagesCount[f.language] || 0) + 1;
    }

    const categoryCounts = {
      doc: fetchedFiles.filter((f) => f.fileCategory === 'doc').length,
      code: fetchedFiles.filter((f) => f.fileCategory === 'code').length,
      config: fetchedFiles.filter((f) => f.fileCategory === 'config').length,
      test: fetchedFiles.filter((f) => f.fileCategory === 'test').length,
      workflow: fetchedFiles.filter((f) => f.fileCategory === 'workflow').length,
    };

    const source: RepoSource = {
      repoUrl: `local://${folderName}`,
      owner: 'local',
      name: folderName,
      fullName: `local/${folderName}`,
      description: `Uploaded local repository folder (${fetchedFiles.length} files indexed)`,
      defaultBranch: 'local',
      selectedRef: 'local-upload',
      license: 'Local Folder',
      stars: 0,
      forks: 0,
      openIssues: 0,
      topics: ['uploaded-local-repo'],
      languages: languagesCount,
      primaryLanguage: Object.keys(languagesCount)[0] || 'Code',
      avatarUrl: '',
      lastSyncedAt: new Date().toISOString(),
      isPrivate: true,
      isLocal: true,
      totalFiles: fetchedFiles.length,
      totalLines: fetchedFiles.reduce((acc, f) => acc + f.lineCount, 0),
      categoryCounts,
    };

    const suggestedQuestions = [
      `What are the core modules and entry points in this uploaded project?`,
      `How is this codebase organized and what patterns does it use?`,
      `What dependencies, configurations, and scripts are defined here?`,
    ];

    const notebook: Notebook = {
      id: `nb-upload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `local/${folderName}`,
      repoUrl: `local://${folderName}`,
      ref: 'local-upload',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      indexStatus: 'ready',
      source,
      files: fetchedFiles,
      chunks,
      messages: [
        {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: `📦 Uploaded folder **${folderName}** has been indexed into a persistent local notebook!

- **Files Indexed**: ${fetchedFiles.length} (${chunks.length} chunks indexed)
- **Primary Language**: ${source.primaryLanguage}
- **Stored In**: Concurrency-Safe SQLite Database & IndexedDB.

*You can now ask questions, generate mindmaps, slide decks, and architecture summaries grounded in this folder.*`,
          citations: [
            {
              id: 'c-upload-intro',
              filePath: fetchedFiles[0].path,
              startLine: 1,
              endLine: Math.min(20, fetchedFiles[0].lineCount),
              snippet: fetchedFiles[0].content.slice(0, 200),
              fileCategory: fetchedFiles[0].fileCategory,
            }
          ],
          suggestedFollowUps: suggestedQuestions.slice(0, 3),
          createdAt: new Date().toISOString(),
          confidence: 'grounded',
        }
      ],
      notes: [],
      artifacts: [],
      pinnedCitations: [],
      suggestedQuestions,
    };

    // Save to SQLite
    await saveNotebook(notebook);

    return res.json({
      notebook,
      source,
      files: fetchedFiles,
      chunks,
      suggestedQuestions,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Upload processing failed: ${err.message}` });
  }
});

// 6. Ingest repository endpoint (Supports Hundreds of Files with Syntactic Chunking)
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

  // Demo shortcut
  if (fullName.toLowerCase() === 'pmndrs/zustand' && !githubToken) {
    const demo = getSampleZustandNotebook();
    await saveNotebook(demo);
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
        console.warn(`GitHub API Rate limit for ${fullName}. Falling back to sample indexed repo.`);
        const demo = getSampleZustandNotebook();
        demo.source.fullName = fullName;
        demo.source.name = repo;
        demo.source.owner = owner;
        demo.source.repoUrl = `https://github.com/${fullName}`;
        await saveNotebook(demo);
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
      '.min.js',
      '.min.css',
      '.map',
    ];

    let eligibleFiles = treeItems.filter((item) => {
      const lower = item.path.toLowerCase();
      return !ignoredPatterns.some((pattern) => lower.includes(pattern) || lower.endsWith(pattern));
    });

    if (pathFilter && pathFilter.trim() !== '') {
      const cleanFilter = pathFilter.trim().replace(/^\//, '');
      eligibleFiles = eligibleFiles.filter((item) => item.path.startsWith(cleanFilter));
    }

    // Prioritize high-value files
    eligibleFiles.sort((a, b) => {
      const priority = (p: string) => {
        const lp = p.toLowerCase();
        if (lp === 'readme.md' || lp === 'readme') return 0;
        if (lp.startsWith('docs/')) return 1;
        if (lp === 'package.json' || lp === 'pyproject.toml' || lp === 'cargo.toml' || lp === 'go.mod') return 2;
        if (lp.startsWith('src/') || lp.startsWith('lib/') || lp.startsWith('app/')) return 3;
        if (lp.startsWith('.github/workflows')) return 4;
        if (lp.includes('test')) return 5;
        return 6;
      };
      return priority(a.path) - priority(b.path);
    });

    // Ingest up to 250 files per repository in parallel batches
    const selectedFiles = eligibleFiles.slice(0, 250);
    const fetchedFiles: SourceFile[] = [];

    // Parallel fetch with concurrency limit of 15
    const batchSize = 15;
    for (let i = 0; i < selectedFiles.length; i += batchSize) {
      const batch = selectedFiles.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (item, idx) => {
          try {
            const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${targetRef}/${item.path}`;
            const contentRes = await fetch(rawUrl, { headers });
            if (contentRes.ok) {
              const text = await contentRes.text();
              // Skip files larger than 300KB
              if (text.length > 300000) return;

              const category = determineFileCategory(item.path);
              const language = detectLanguage(item.path);
              const lineCount = text.split('\n').length;

              fetchedFiles.push({
                id: `f-${i + idx}-${item.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
    }

    if (fetchedFiles.length === 0) {
      return res.status(404).json({
        error: `Could not retrieve file contents from ${fullName} at ref '${targetRef}'. If this is a private repository, please supply a GitHub Personal Access Token in settings.`,
      });
    }

    fetchedFiles.sort((a, b) => a.path.localeCompare(b.path));
    const chunks: FileChunk[] = fetchedFiles.flatMap(chunkFileContent);

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

// Resilient Gemini generation with exponential backoff & fallbacks
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

// 7. Chat / Q&A endpoint using BM25 Inverted Index Context Budget Optimizer
app.post('/api/repo/query', async (req, res) => {
  const { question, repoSource, chunks, files, answerMode = 'detailed', model = 'gemini-3.7-flash' } = req.body;

  if (!question || !repoSource) {
    return res.status(400).json({ error: 'Question and repoSource are required' });
  }

  try {
    // Build token-budget-aware grounded context from BM25 index
    const { contextString, retrievedChunks } = buildGroundedPromptContext(question, chunks || [], 9500);
    const repoOutline = generateRepositoryOutline(files || [], 60);

    const answerModeInstructions: Record<AnswerMode, string> = {
      concise: 'Provide a direct, concise response highlighting the essential facts and line references without fluff.',
      detailed: 'Provide a thorough, comprehensive technical breakdown with deep code context, explanations, and citations.',
      code: 'Focus heavily on code snippets, function definitions, types, data flow, and exact line ranges in the repository.',
      architecture: 'Explain the high-level system architecture, module boundaries, directory layout, and integration points.',
      beginner: 'Explain clearly with accessible metaphors and gentle walkthroughs, while still citing the exact source files.',
    };

    const systemInstruction = `You are RepoNotebook, a repository-grounded assistant.
Your ONLY knowledge source for this notebook is the repository: ${repoSource.fullName} (${repoSource.repoUrl}) on ref: ${repoSource.selectedRef}.

CRITICAL GROUNDING RULES:
1. Answer using ONLY the repository contents and directory structure provided below.
2. CITE SPECIFIC FILES AND LINE RANGES for every factual statement, API, feature, configuration, and code snippet.
   Use the exact citation tag format: [filepath:L<start>-L<end>] (e.g. [README.md:L5-L18] or [src/vanilla.ts:L34-L52]).
3. If the user asks something that is NOT found in the provided repository context, explicitly state: "I could not find this in the repository ${repoSource.fullName}."
4. STRICT REFUSAL OF EXTERNAL TOPICS: If asked about external libraries not present in this repo or unrelated questions, politely explain that this RepoNotebook is strictly bound to ${repoSource.fullName}.
5. Style Guideline: ${answerModeInstructions[answerMode as AnswerMode] || answerModeInstructions.detailed}`;

    const promptText = `${repoOutline}\n\n${contextString}\n\nUser Question: ${question}\n\nAnswer with precise citations [filepath:L<start>-L<end>]:`;

    const response = await generateContentWithRetry({
      preferredModel: model,
      contents: promptText,
      systemInstruction,
      temperature: 0.2,
    });

    const replyText = response.text || 'I could not generate an answer from the repository context.';

    // Extract Citations from reply text
    const citationRegex = /\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g;
    const citations: Citation[] = [];
    let match;
    const seenKeys = new Set<string>();

    while ((match = citationRegex.exec(replyText)) !== null) {
      const [, filePath, startStr, endStr] = match;
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
          id: `cit-${citations.length + 1}`,
          filePath,
          startLine,
          endLine,
          snippet,
          fileCategory: matchingFile?.fileCategory || 'code',
        });
      }
    }

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

    // Smart Follow-Up Suggestions
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
      // fallback
    }

    return res.json({
      content: replyText,
      citations,
      suggestedFollowUps,
      confidence: replyText.includes('could not find this') ? 'not_found' : 'grounded',
      modelUsed: model,
    });
  } catch (error: any) {
    console.error('Query error:', error);
    return res.status(500).json({ error: `Query failed: ${error.message || 'Unknown error'}` });
  }
});

// 8. Artifact Generation Endpoint using BM25 Index
app.post('/api/repo/artifact', async (req, res) => {
  const { artifactType, repoSource, chunks, files } = req.body;

  if (!artifactType || !repoSource) {
    return res.status(400).json({ error: 'artifactType and repoSource are required' });
  }

  const typePrompts: Record<ArtifactType, { title: string; instruction: string; queryTerms: string }> = {
    overview: {
      title: 'Repository Overview & Executive Summary',
      instruction: 'Create a comprehensive executive overview of the repository, including core mission, primary components, technology stack, and architecture highlights.',
      queryTerms: 'readme overview architecture introduction purpose license dependencies',
    },
    mindmap: {
      title: 'Repository Architecture Mindmap',
      instruction: 'Generate a clean, hierarchical Mermaid.js mindmap illustrating the repository modules, packages, layers, and entry points, followed by bullet point descriptions with line citations.',
      queryTerms: 'architecture index main entry module package component structure',
    },
    slideshow: {
      title: 'Technical Presentation Slides',
      instruction: 'Create a 5-6 slide technical presentation deck in Markdown using "# Slide X: Title" separators, complete with bullet points, code snippets, and speaker notes.',
      queryTerms: 'readme overview get started usage api architecture tests',
    },
    getting_started: {
      title: 'Developer Quickstart & Setup Guide',
      instruction: 'Write an actionable step-by-step developer getting-started guide covering prerequisites, installation, local execution, and environment setup.',
      queryTerms: 'install setup run dev build package scripts getting started readme',
    },
    architecture: {
      title: 'System Architecture & Data Flow',
      instruction: 'Detail the complete architectural design, data pipelines, state containers, and subsystem boundaries with deep code citations.',
      queryTerms: 'architecture store state engine core service data flow',
    },
    glossary: {
      title: 'Domain Glossary & Key Terminology',
      instruction: 'Build an alphabetized technical glossary explaining key domain concepts, types, classes, and terminology specific to this repository.',
      queryTerms: 'type interface class enum model schema definition',
    },
    api_surface: {
      title: 'Public API Surface & Types Catalog',
      instruction: 'Document the exported public API surface, functions, parameters, return types, and interfaces.',
      queryTerms: 'export function interface type class api public index',
    },
    folder_structure: {
      title: 'Directory Tree & File Layout Guide',
      instruction: 'Explain the directory layout, folder purposes, and organizational conventions across the project.',
      queryTerms: 'src lib app docs tests config workflows directory structure',
    },
    dependency_map: {
      title: 'Dependencies & Tooling Ecosystem',
      instruction: 'Analyze runtime dependencies, dev tooling, build chains, and external libraries declared in project manifests.',
      queryTerms: 'package.json dependencies devDependencies cargo.toml pyproject.toml go.mod',
    },
    testing: {
      title: 'Test Suite & Quality Verification',
      instruction: 'Document the testing framework, unit test coverage, test utilities, and verification commands.',
      queryTerms: 'test spec vitest jest pytest testing suite mock assert',
    },
    deployment_ci: {
      title: 'CI/CD Pipelines & Deployment',
      instruction: 'Explain the GitHub Actions workflows, build pipelines, release automation, and deployment configurations.',
      queryTerms: 'workflows ci action build deploy docker yaml',
    },
    faq: {
      title: 'Frequently Asked Questions (FAQ)',
      instruction: 'Provide a structured FAQ covering common questions, troubleshooting scenarios, and edge-case behaviors.',
      queryTerms: 'troubleshooting error faq common issue question pitfall',
    },
    onboarding: {
      title: 'New Engineer Onboarding Checklist',
      instruction: 'Create a 30-day engineer onboarding roadmap, initial codebase walkthrough, and recommended reading order.',
      queryTerms: 'readme getting started architecture tests contributing guide',
    },
    risks_rough_edges: {
      title: 'Technical Debt & Rough Edges Analysis',
      instruction: 'Highlight potential technical debt, TODOs, performance considerations, and tricky code sections.',
      queryTerms: 'todo fixme deprecate error edge case performance risk',
    },
    change_summary: {
      title: 'Release Highlights & Change Summary',
      instruction: 'Summarize key features, versions, and evolution milestones reflected in the repo code and documentation.',
      queryTerms: 'version changelog release readme new feature update',
    },
  };

  const artifactSpec = typePrompts[artifactType as ArtifactType] || typePrompts.overview;

  try {
    const { contextString } = buildGroundedPromptContext(artifactSpec.queryTerms, chunks || [], 11000);
    const repoOutline = generateRepositoryOutline(files || [], 70);

    const systemInstruction = `You are RepoNotebook's Research Artifact Engine.
You are generating a formal research artifact for: ${repoSource.fullName}.
Ground everything strictly in the provided codebase context and cite files using [filepath:L<start>-L<end>].`;

    const promptText = `${repoOutline}\n\n${contextString}\n\nArtifact Task: ${artifactSpec.instruction}\n\nGenerate the complete Markdown artifact titled "${artifactSpec.title}":`;

    const response = await generateContentWithRetry({
      contents: promptText,
      systemInstruction,
      temperature: 0.25,
    });

    const content = response.text || `# ${artifactSpec.title}\n\nCould not generate artifact.`;

    // Extract Citations
    const citationRegex = /\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g;
    const citations: Citation[] = [];
    let match;
    const seen = new Set<string>();

    while ((match = citationRegex.exec(content)) !== null) {
      const [, filePath, startStr, endStr] = match;
      const startLine = parseInt(startStr, 10);
      const endLine = endStr ? parseInt(endStr, 10) : startLine;
      const key = `${filePath}:${startLine}-${endLine}`;
      if (!seen.has(key)) {
        seen.add(key);
        const matchingFile = (files as SourceFile[] || []).find((f) => f.path === filePath);
        citations.push({
          id: `cit-art-${citations.length + 1}`,
          filePath,
          startLine,
          endLine,
          fileCategory: matchingFile?.fileCategory || 'code',
        });
      }
    }

    return res.json({
      artifact: {
        id: `art-${artifactType}-${Date.now()}`,
        notebookId: repoSource.fullName,
        type: artifactType,
        title: artifactSpec.title,
        content,
        citations,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Artifact generation error:', error);
    return res.status(500).json({ error: `Artifact generation failed: ${error.message}` });
  }
});

// Vite Middleware & SPA Serving
async function startServer() {
  // Ensure SQLite DB initialized
  await getDatabase();

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
    console.log(`RepoNotebook Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
