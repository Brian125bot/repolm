import React, { useState } from 'react';
import { Notebook, IngestRepoParams } from '../types';
import { POPULAR_REPOS } from '../sampleRepos';
import {
  BookOpen,
  Sparkles,
  GitBranch,
  ArrowRight,
  ShieldCheck,
  FileCode,
  Layers,
  Lock,
  Plus,
  Trash2,
  FolderCode,
  HardDrive,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';

interface HomeScreenProps {
  notebooks: Notebook[];
  onSelectNotebook: (id: string) => void;
  onOpenNewNotebookModal: () => void;
  onIngestRepo: (params: IngestRepoParams) => Promise<void>;
  onDeleteNotebook: (id: string) => void;
  isLoading: boolean;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  notebooks,
  onSelectNotebook,
  onOpenNewNotebookModal,
  onIngestRepo,
  onDeleteNotebook,
  isLoading,
}) => {
  const [quickInput, setQuickInput] = useState('');
  const [ingestMode, setIngestMode] = useState<'local' | 'github'>('local');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim() || isLoading) return;
    if (ingestMode === 'local') {
      onIngestRepo({ isLocal: true, localPath: quickInput.trim() });
    } else {
      onIngestRepo({ repoUrl: quickInput.trim() });
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0D1117] text-[#C9D1D9] flex flex-col items-center justify-start p-6 sm:p-10">
      <div className="w-full max-w-4xl space-y-8 animate-in fade-in">
        {/* Header Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-semibold text-[#58A6FF] font-mono">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Single-Repository Grounding &bull; Disk & IndexedDB Persisted</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F0F6FC]">
            RepoNotebook
          </h1>
          <p className="text-sm sm:text-base text-[#8B949E] max-w-2xl mx-auto leading-relaxed">
            A NotebookLM-style research workspace for local codebase folders and GitHub repositories. Every answer, summary, and artifact is strictly verified with exact file and line-range citations.
          </p>
        </div>

        {/* Quick Ingest Input Card */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#58A6FF]" />
              <span>Start a New Repository Research Workspace</span>
            </h2>

            {/* Ingest Mode Toggle */}
            <div className="flex items-center bg-[#0D1117] border border-[#30363D] rounded-lg p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setIngestMode('local');
                  setQuickInput('./');
                }}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  ingestMode === 'local'
                    ? 'bg-[#21262D] text-[#58A6FF] font-semibold'
                    : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <FolderCode className="w-3.5 h-3.5" />
                <span>Local Folder</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIngestMode('github');
                  setQuickInput('');
                }}
                className={`px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  ingestMode === 'github'
                    ? 'bg-[#21262D] text-[#58A6FF] font-semibold'
                    : 'text-[#8B949E] hover:text-[#C9D1D9]'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>GitHub URL</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="home-quick-url-input"
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder={
                ingestMode === 'local'
                  ? 'Local directory path (e.g. ./ or ./src or /workspace)...'
                  : 'Paste GitHub repo URL (e.g. https://github.com/pmndrs/zustand or owner/repo)...'
              }
              className="flex-1 px-4 py-2 text-xs sm:text-sm font-mono rounded-lg border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              disabled={isLoading}
            />
            <button
              id="home-quick-submit-btn"
              type="submit"
              disabled={!quickInput.trim() || isLoading}
              className="px-5 py-2 rounded-lg bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white text-xs sm:text-sm font-medium shadow-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>{ingestMode === 'local' ? 'Index Local Path' : 'Ingest & Open'}</span>
            </button>
          </form>

          {/* Quick presets */}
          <div className="pt-2 border-t border-[#30363D]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider font-mono">
                {ingestMode === 'local' ? 'Quick local directories:' : 'Or explore open-source presets:'}
              </div>
              <button
                type="button"
                onClick={onOpenNewNotebookModal}
                className="text-[11px] text-[#58A6FF] hover:underline font-mono cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>More Ingestion Options (Upload folder, path filter, etc.)</span>
              </button>
            </div>

            {ingestMode === 'local' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onIngestRepo({ isLocal: true, localPath: './' })}
                  disabled={isLoading}
                  className="p-2.5 text-left rounded-lg border border-[#30363D] hover:border-[#58A6FF] bg-[#0D1117] hover:bg-[#21262D] transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#F0F6FC] group-hover:text-[#58A6FF]">
                      Current Project Root
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262D] border border-[#30363D] text-[#3FB950] font-mono">
                      ./
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] line-clamp-1 mt-1 font-mono">
                    Index entire workspace codebase, manifests & docs
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => onIngestRepo({ isLocal: true, localPath: './src' })}
                  disabled={isLoading}
                  className="p-2.5 text-left rounded-lg border border-[#30363D] hover:border-[#58A6FF] bg-[#0D1117] hover:bg-[#21262D] transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#F0F6FC] group-hover:text-[#58A6FF]">
                      Source Directory
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262D] border border-[#30363D] text-[#58A6FF] font-mono">
                      ./src
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] line-clamp-1 mt-1 font-mono">
                    Index components, services, types & utilities
                  </p>
                </button>

                <button
                  type="button"
                  onClick={onOpenNewNotebookModal}
                  disabled={isLoading}
                  className="p-2.5 text-left rounded-lg border border-[#30363D] hover:border-[#58A6FF] bg-[#0D1117] hover:bg-[#21262D] transition cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-[#F0F6FC] group-hover:text-[#58A6FF]">
                      Upload Folder Picker
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262D] border border-[#30363D] text-[#D29922] font-mono">
                      Browser
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8B949E] line-clamp-1 mt-1 font-mono">
                    Select a local project folder from your computer
                  </p>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {POPULAR_REPOS.map((pop) => (
                  <button
                    key={pop.name}
                    onClick={() => onIngestRepo({ repoUrl: pop.url })}
                    disabled={isLoading}
                    className="p-2.5 text-left rounded-lg border border-[#30363D] hover:border-[#58A6FF] bg-[#0D1117] hover:bg-[#21262D] transition cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#F0F6FC] group-hover:text-[#58A6FF]">
                        {pop.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E] font-mono">
                        {pop.primaryLanguage}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8B949E] line-clamp-1 mt-1 font-mono">
                      {pop.description}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Saved Notebooks Grid */}
        {notebooks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#58A6FF]" />
                <span>Your Single-Repo Workspaces ({notebooks.length})</span>
              </h2>
              <button
                onClick={onOpenNewNotebookModal}
                className="text-xs text-[#58A6FF] hover:underline flex items-center gap-1 cursor-pointer font-mono"
              >
                <Plus className="w-3 h-3" />
                <span>New Notebook</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notebooks.map((nb) => {
                const isLocal = nb.source.isLocal;
                return (
                  <div
                    key={nb.id}
                    id={`home-notebook-card-${nb.id}`}
                    onClick={() => onSelectNotebook(nb.id)}
                    className="p-4 bg-[#161B22] border border-[#30363D] rounded-xl shadow-xs hover:border-[#58A6FF] transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {isLocal ? (
                          <div className="w-10 h-10 rounded-lg bg-[#21262D] border border-[#30363D] flex items-center justify-center text-[#58A6FF] shrink-0">
                            <FolderCode className="w-5 h-5" />
                          </div>
                        ) : (
                          <img
                            src={nb.source.avatarUrl}
                            alt={nb.source.owner}
                            className="w-10 h-10 rounded-lg border border-[#30363D] object-cover shrink-0"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-[#F0F6FC] truncate group-hover:text-[#58A6FF]">
                              {nb.source.fullName}
                            </h3>
                            {isLocal && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#58A6FF]/15 text-[#58A6FF] font-mono shrink-0">
                                Local
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[#8B949E] font-mono mt-0.5">
                            <GitBranch className="w-3 h-3" />
                            <span>{nb.source.selectedRef || 'local'}</span>
                            <span>&bull;</span>
                            <span>{nb.files.length} files</span>
                          </div>
                        </div>
                      </div>

                      {notebooks.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNotebook(nb.id);
                          }}
                          className="p-1.5 text-[#8B949E] hover:text-[#F85149] rounded-md hover:bg-[#21262D] transition cursor-pointer"
                          title="Delete notebook"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-[#8B949E] line-clamp-2 mt-3 leading-relaxed">
                      {nb.source.description || (isLocal ? `Local repository path: ${nb.source.localPath || './'}` : 'Repository research workspace')}
                    </p>

                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#30363D] text-[11px] text-[#8B949E] font-mono">
                      <span>
                        {nb.notes.length} notes &bull; {nb.artifacts.length} artifacts
                      </span>
                      <span className="text-[#58A6FF] font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-[#30363D]">
          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] space-y-1.5">
            <div className="p-1.5 w-fit rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <HardDrive className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#F0F6FC]">
              Local Optimization & Persistence
            </h3>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Index local filesystem directories or GitHub repos. Persistent multi-tier storage keeps all notes, artifacts, and chunks safely saved to disk and IndexedDB.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] space-y-1.5">
            <div className="p-1.5 w-fit rounded-md bg-[#21262D] border border-[#30363D] text-[#3FB950]">
              <FileCode className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#F0F6FC]">
              Line-Anchored Citations
            </h3>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Every factual assertion links to exact file paths and highlighted line ranges in the interactive source viewer.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] space-y-1.5">
            <div className="p-1.5 w-fit rounded-md bg-[#21262D] border border-[#30363D] text-[#D29922]">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#F0F6FC]">
              13 Research Artifacts & Notes
            </h3>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Generate architecture summaries, API surfaces, contributor checklists, and merge notes into executive briefings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
