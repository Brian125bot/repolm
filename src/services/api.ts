import { Notebook, IngestRepoParams, AnswerMode, ArtifactType, Artifact, Note, Citation, GeminiModelId } from '../types';
import { getSampleZustandNotebook } from '../sampleRepos';

const STORAGE_KEY_NOTEBOOKS = 'reponotebook_saved_notebooks_v1';
const STORAGE_KEY_ACTIVE_ID = 'reponotebook_active_notebook_id_v1';
const STORAGE_KEY_GITHUB_TOKEN = 'reponotebook_github_token_v1';

export function getSavedGitHubToken(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_GITHUB_TOKEN) || '';
  } catch {
    return '';
  }
}

export function saveGitHubToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY_GITHUB_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_GITHUB_TOKEN);
    }
  } catch (e) {
    console.error('Failed to save GitHub token', e);
  }
}

export function getSavedNotebooks(): Notebook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTEBOOKS);
    if (!raw) {
      const demo = getSampleZustandNotebook();
      saveNotebooks([demo]);
      return [demo];
    }
    return JSON.parse(raw);
  } catch {
    return [getSampleZustandNotebook()];
  }
}

export function saveNotebooks(notebooks: Notebook[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_NOTEBOOKS, JSON.stringify(notebooks));
  } catch (e) {
    console.error('Failed to save notebooks locally', e);
  }
}

export function getActiveNotebookId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || 'demo-zustand-notebook';
  } catch {
    return 'demo-zustand-notebook';
  }
}

export function setActiveNotebookId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch (e) {
    console.error('Failed to set active notebook id', e);
  }
}

export async function ingestRepository(params: IngestRepoParams): Promise<{
  notebook: Notebook;
  rateLimitNotice?: string;
  isSampleFallback?: boolean;
}> {
  const token = params.githubToken || getSavedGitHubToken();
  const response = await fetch('/api/repo/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      repoUrl: params.repoUrl,
      ref: params.ref,
      githubToken: token,
      pathFilter: params.pathFilter,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Failed to ingest repository' }));
    throw new Error(errData.error || `HTTP ${response.status}: Ingestion failed`);
  }

  const data = await response.json();
  const newNotebookId = `nb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const notebook: Notebook = {
    id: newNotebookId,
    name: data.source.fullName,
    repoUrl: data.source.repoUrl,
    ref: data.source.selectedRef,
    pathFilter: params.pathFilter,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    indexStatus: 'ready',
    source: data.source,
    files: data.files,
    chunks: data.chunks,
    messages: [
      {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `👋 Repository **${data.source.fullName}** (\`${data.source.selectedRef}\`) has been successfully ingested and indexed!

- **Files Indexed**: ${data.files.length} (${data.chunks.length} semantic chunks)
- **Primary Language**: ${data.source.primaryLanguage}
- **Categories**: ${data.source.categoryCounts.doc} Docs, ${data.source.categoryCounts.code} Source files, ${data.source.categoryCounts.config} Configs, ${data.source.categoryCounts.test} Tests, ${data.source.categoryCounts.workflow} Workflows

*Every response in this notebook is strictly grounded in this repository with exact file and line citations.*`,
        citations: data.files.length > 0 ? [
          {
            id: 'c-intro-1',
            filePath: data.files[0].path,
            startLine: 1,
            endLine: Math.min(25, data.files[0].lineCount),
            snippet: data.files[0].content.slice(0, 250),
            fileCategory: data.files[0].fileCategory,
          }
        ] : [],
        suggestedFollowUps: data.suggestedQuestions.slice(0, 3),
        createdAt: new Date().toISOString(),
        confidence: 'grounded',
      }
    ],
    notes: [],
    artifacts: [],
    pinnedCitations: [],
    suggestedQuestions: data.suggestedQuestions,
  };

  return {
    notebook,
    rateLimitNotice: data.rateLimitNotice,
    isSampleFallback: data.isSampleFallback,
  };
}

export async function askRepoQuestion(params: {
  question: string;
  notebook: Notebook;
  answerMode: AnswerMode;
  model?: GeminiModelId;
}): Promise<{
  content: string;
  citations: Citation[];
  suggestedFollowUps: string[];
  confidence: 'grounded' | 'inferred' | 'not_found';
  modelUsed?: GeminiModelId;
}> {
  const response = await fetch('/api/repo/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: params.question,
      messages: params.notebook.messages,
      repoSource: params.notebook.source,
      chunks: params.notebook.chunks,
      files: params.notebook.files,
      answerMode: params.answerMode,
      model: params.model || 'gemini-3.7-flash',
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Query failed' }));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function generateRepoArtifact(params: {
  artifactType: ArtifactType;
  notebook: Notebook;
}): Promise<Artifact> {
  const response = await fetch('/api/repo/artifact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artifactType: params.artifactType,
      repoSource: params.notebook.source,
      chunks: params.notebook.chunks,
      files: params.notebook.files,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Artifact generation failed' }));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return {
    ...data,
    notebookId: params.notebook.id,
  };
}

export async function mergeNotesToBriefing(params: {
  notes: Note[];
  notebook: Notebook;
}): Promise<{ title: string; content: string; createdAt: string }> {
  const response = await fetch('/api/notes/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: params.notes,
      repoSource: params.notebook.source,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Merge failed' }));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  return response.json();
}
