import React, { useState } from 'react';
import { POPULAR_REPOS } from '../sampleRepos';
import { IngestRepoParams } from '../types';
import {
  BookOpen,
  GitBranch,
  Key,
  Filter,
  Sparkles,
  X,
  AlertCircle,
  RefreshCw,
  Lock,
} from 'lucide-react';

interface NewNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (params: IngestRepoParams) => Promise<void>;
  isLoading: boolean;
  savedToken: string;
}

export const NewNotebookModal: React.FC<NewNotebookModalProps> = ({
  isOpen,
  onClose,
  onIngest,
  isLoading,
  savedToken,
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [ref, setRef] = useState('');
  const [githubToken, setGithubToken] = useState(savedToken);
  const [pathFilter, setPathFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || isLoading) return;

    setError(null);
    setStepStatus('Fetching repository tree from GitHub...');
    try {
      await onIngest({
        repoUrl: repoUrl.trim(),
        ref: ref.trim() || undefined,
        githubToken: githubToken.trim() || undefined,
        pathFilter: pathFilter.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to ingest repository. Please check the URL or provide a GitHub token.');
    } finally {
      setStepStatus('');
    }
  };

  const handleSelectPopular = (url: string) => {
    setRepoUrl(url);
    setRef('');
    setPathFilter('');
  };

  return (
    <div
      id="new-notebook-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in"
      onClick={() => !isLoading && onClose()}
    >
      <div
        id="new-notebook-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden text-[#C9D1D9]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F0F6FC]">
                Create Single-Repo Notebook
              </h3>
              <p className="text-xs text-[#8B949E] font-mono">
                Ground an entire NotebookLM research workspace in 1 GitHub repository
              </p>
            </div>
          </div>

          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#0D1117]">
          {error && (
            <div className="p-3 rounded-md bg-[#F85149]/15 border border-[#F85149]/30 text-xs text-[#FF7B72] flex items-start gap-2.5 font-mono">
              <AlertCircle className="w-4 h-4 text-[#F85149] shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* Repo URL Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#F0F6FC]">
              GitHub Repository URL <span className="text-[#F85149]">*</span>
            </label>
            <input
              id="repo-url-input"
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/pmndrs/zustand or owner/repo"
              required
              disabled={isLoading}
              className="w-full px-3.5 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
            />
          </div>

          {/* 1-Click Popular Demo Repos */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider flex items-center gap-1 font-mono">
              <Sparkles className="w-3 h-3 text-[#D29922]" />
              <span>Or pick a demo repository</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_REPOS.map((pop) => (
                <button
                  key={pop.name}
                  type="button"
                  onClick={() => handleSelectPopular(pop.url)}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs rounded-md border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] hover:border-[#58A6FF] text-[#C9D1D9] transition cursor-pointer flex items-center gap-1.5"
                >
                  <span className="font-mono text-[11px] font-medium">{pop.name}</span>
                  <span className="text-[10px] text-[#58A6FF] font-mono">({pop.badge})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Advanced Settings: Branch, Path Filter, Token */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#30363D]">
            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                <GitBranch className="w-3 h-3" />
                <span>Branch / Tag / Commit (Optional)</span>
              </label>
              <input
                id="repo-ref-input"
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="e.g. main, v2.0, feature-branch"
                disabled={isLoading}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                <Filter className="w-3 h-3" />
                <span>Path Filter (Optional)</span>
              </label>
              <input
                id="repo-path-filter-input"
                type="text"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="e.g. /src or /docs"
                disabled={isLoading}
                className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              />
            </div>
          </div>

          {/* GitHub Token (Optional for private repos or rate limit) */}
          <div className="space-y-1 pt-1">
            <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
              <Key className="w-3 h-3 text-[#D29922]" />
              <span>GitHub Personal Token (Optional for private repos or 5,000 reqs/hr)</span>
            </label>
            <input
              id="repo-token-input"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (optional)"
              disabled={isLoading}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
            />
          </div>

          {/* Strict 1-Repo Constraint Reminder */}
          <div className="p-2.5 rounded-md bg-[#161B22] border border-[#30363D] flex items-center gap-2 text-[11px] text-[#8B949E] font-mono">
            <Lock className="w-3.5 h-3.5 text-[#58A6FF] shrink-0" />
            <span>
              This notebook will be locked strictly to this single repository as its sole grounded truth source.
            </span>
          </div>

          {/* Loading status */}
          {isLoading && (
            <div className="p-3 rounded-md bg-[#388BFD]/15 border border-[#388BFD]/30 flex items-center gap-3 text-xs text-[#58A6FF] font-mono">
              <RefreshCw className="w-4 h-4 animate-spin text-[#58A6FF] shrink-0" />
              <span>{stepStatus || 'Ingesting repository files and building semantic index...'}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#30363D]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-[#8B949E] hover:bg-[#21262D] hover:text-[#C9D1D9] rounded-md transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="start-ingest-btn"
              type="submit"
              disabled={!repoUrl.trim() || isLoading}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Indexing Repo...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ingest & Create Notebook</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
