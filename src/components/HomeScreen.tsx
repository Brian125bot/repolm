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
  const [quickUrl, setQuickUrl] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim() || isLoading) return;
    onIngestRepo({ repoUrl: quickUrl.trim() });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#0D1117] text-[#C9D1D9] flex flex-col items-center justify-start p-6 sm:p-10">
      <div className="w-full max-w-4xl space-y-8 animate-in fade-in">
        {/* Header Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161B22] border border-[#30363D] text-xs font-semibold text-[#58A6FF] font-mono">
            <Lock className="w-3.5 h-3.5" />
            <span>Strict Single-Repository Grounding</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F0F6FC]">
            RepoNotebook
          </h1>
          <p className="text-sm sm:text-base text-[#8B949E] max-w-2xl mx-auto leading-relaxed">
            A NotebookLM-style research workspace for single GitHub repositories. Every answer, summary, and artifact is strictly verified with exact file and line-range citations.
          </p>
        </div>

        {/* Quick Ingest Input Card */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#58A6FF]" />
            <span>Start a New Repository Notebook</span>
          </h2>

          <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <input
              id="home-quick-url-input"
              type="text"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Paste GitHub repo URL (e.g. https://github.com/pmndrs/zustand or owner/repo)..."
              className="flex-1 px-4 py-2 text-xs sm:text-sm font-mono rounded-lg border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              disabled={isLoading}
            />
            <button
              id="home-quick-submit-btn"
              type="submit"
              disabled={!quickUrl.trim() || isLoading}
              className="px-5 py-2 rounded-lg bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white text-xs sm:text-sm font-medium shadow-xs transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Ingest & Open</span>
            </button>
          </form>

          {/* Popular Demo Buttons */}
          <div className="pt-2 border-t border-[#30363D]">
            <div className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider mb-2 font-mono">
              Or explore popular open-source repositories:
            </div>
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
          </div>
        </div>

        {/* Saved Notebooks Grid */}
        {notebooks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#58A6FF]" />
                <span>Your Single-Repo Notebooks ({notebooks.length})</span>
              </h2>
              <button
                onClick={onOpenNewNotebookModal}
                className="text-xs text-[#58A6FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>New Notebook</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {notebooks.map((nb) => (
                <div
                  key={nb.id}
                  id={`home-notebook-card-${nb.id}`}
                  onClick={() => onSelectNotebook(nb.id)}
                  className="p-4 bg-[#161B22] border border-[#30363D] rounded-xl shadow-xs hover:border-[#58A6FF] transition cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={nb.source.avatarUrl}
                        alt={nb.source.owner}
                        className="w-10 h-10 rounded-lg border border-[#30363D] object-cover shrink-0"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm text-[#F0F6FC] truncate group-hover:text-[#58A6FF]">
                          {nb.source.fullName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-[#8B949E] font-mono mt-0.5">
                          <GitBranch className="w-3 h-3" />
                          <span>{nb.source.selectedRef}</span>
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
                    {nb.source.description}
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
              ))}
            </div>
          </div>
        )}

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-[#30363D]">
          <div className="p-4 rounded-xl bg-[#161B22] border border-[#30363D] space-y-1.5">
            <div className="p-1.5 w-fit rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-semibold text-[#F0F6FC]">
              Zero External Hallucinations
            </h3>
            <p className="text-xs text-[#8B949E] leading-relaxed">
              Strictly confined to 1 repository. Questions outside the repo code or docs are clearly flagged and refused.
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
              Every factual assertion links to exact file paths and highlighted line ranges in the interactive viewer.
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
