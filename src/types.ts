export type AnswerMode = 'concise' | 'detailed' | 'code' | 'architecture' | 'beginner';

export type GeminiModelId = 'gemini-3.7-flash' | 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite';

export interface ModelOption {
  id: GeminiModelId;
  name: string;
  badge: string;
  description: string;
  speed: string;
  tag: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.7-flash',
    name: '3.7 Flash',
    badge: 'Reasoning',
    description: 'High-capability flagship model with deep repository reasoning, nuanced code synthesis, and precise citations.',
    speed: 'Standard Fast',
    tag: 'Flagship',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: '3.5 Flash Lite',
    badge: 'Balanced',
    description: 'High-efficiency low-latency model optimized for responsive conversational flow and live exploration.',
    speed: 'Ultra Fast',
    tag: 'Low Latency',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: '3.1 Flash Lite',
    badge: 'Fastest',
    description: 'Ultra-compact high-throughput model for instantaneous code syntax queries, API lookups, and summaries.',
    speed: 'Lightning Fast',
    tag: 'Lightweight',
  },
];

export type FileCategory = 'all' | 'doc' | 'code' | 'config' | 'test' | 'workflow';

export interface Citation {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  snippet?: string;
  fileCategory?: FileCategory;
}

export interface SourceFile {
  id: string;
  path: string;
  language: string;
  fileCategory: FileCategory;
  size: number;
  lineCount: number;
  content: string;
  sha?: string;
}

export interface FileChunk {
  id: string;
  fileId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: 'function' | 'class' | 'module' | 'doc_section' | 'config' | 'general';
  content: string;
  language: string;
  fileCategory: FileCategory;
  symbolName?: string;
}

export interface RepoSource {
  repoUrl: string;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  selectedRef: string;
  license: string;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  languages: Record<string, number>;
  primaryLanguage: string;
  avatarUrl: string;
  lastSyncedAt: string;
  isPrivate: boolean;
  totalFiles: number;
  totalLines: number;
  categoryCounts: {
    doc: number;
    code: number;
    config: number;
    test: number;
    workflow: number;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: Citation[];
  suggestedFollowUps?: string[];
  createdAt: string;
  answerMode?: AnswerMode;
  modelUsed?: GeminiModelId;
  confidence?: 'grounded' | 'inferred' | 'not_found';
}

export type ArtifactType =
  | 'overview'
  | 'mindmap'
  | 'slideshow'
  | 'getting_started'
  | 'architecture'
  | 'glossary'
  | 'api_surface'
  | 'folder_structure'
  | 'dependency_map'
  | 'testing'
  | 'deployment_ci'
  | 'faq'
  | 'onboarding'
  | 'risks_rough_edges'
  | 'change_summary';

export interface ArtifactInfo {
  type: ArtifactType;
  title: string;
  description: string;
  iconName: string;
  category: 'core' | 'technical' | 'guide' | 'quality';
}

export interface Artifact {
  id: string;
  notebookId: string;
  type: ArtifactType;
  title: string;
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface Note {
  id: string;
  notebookId: string;
  title: string;
  content: string;
  tags: string[];
  citations: Citation[];
  createdAt: string;
  updatedAt: string;
  sourceMessageId?: string;
}

export interface Notebook {
  id: string;
  name: string;
  repoUrl: string;
  ref: string;
  pathFilter?: string;
  createdAt: string;
  updatedAt: string;
  indexStatus: 'idle' | 'fetching' | 'indexing' | 'ready' | 'error';
  indexError?: string;
  source: RepoSource;
  files: SourceFile[];
  chunks: FileChunk[];
  messages: ChatMessage[];
  notes: Note[];
  artifacts: Artifact[];
  pinnedCitations: Citation[];
  suggestedQuestions: string[];
}

export interface IngestRepoParams {
  repoUrl: string;
  ref?: string;
  githubToken?: string;
  pathFilter?: string;
}
