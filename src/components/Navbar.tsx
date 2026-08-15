import React, { useState } from 'react';
import { Notebook } from '../types';
import {
  BookOpen,
  Plus,
  ChevronDown,
  Lock,
  GitBranch,
  Download,
  Key,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

interface NavbarProps {
  notebooks: Notebook[];
  activeNotebook: Notebook | null;
  onSelectNotebook: (id: string) => void;
  onNewNotebook: () => void;
  onOpenSettings: () => void;
  onOpenDocs?: () => void;
  hasCustomToken: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  notebooks,
  activeNotebook,
  onSelectNotebook,
  onNewNotebook,
  onOpenSettings,
  onOpenDocs,
  hasCustomToken,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExportJSON = () => {
    if (!activeNotebook) return;
    const blob = new Blob([JSON.stringify(activeNotebook, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNotebook.source.name}-reponotebook.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportMarkdown = () => {
    if (!activeNotebook) return;
    let md = `# RepoNotebook: ${activeNotebook.source.fullName}\n\n`;
    md += `> Source: ${activeNotebook.source.repoUrl} (${activeNotebook.source.selectedRef})\n`;
    md += `> Description: ${activeNotebook.source.description}\n`;
    md += `> Synced At: ${activeNotebook.source.lastSyncedAt}\n\n`;

    md += `## Notes (${activeNotebook.notes.length})\n\n`;
    activeNotebook.notes.forEach((note) => {
      md += `### ${note.title}\n${note.content}\n\nTags: ${note.tags.join(', ')}\n\n`;
      if (note.citations.length > 0) {
        md += `*Citations:*\n`;
        note.citations.forEach((c) => {
          md += `- \`${c.filePath}:L${c.startLine}-L${c.endLine}\`\n`;
        });
        md += '\n';
      }
    });

    if (activeNotebook.artifacts.length > 0) {
      md += `## Generated Artifacts (${activeNotebook.artifacts.length})\n\n`;
      activeNotebook.artifacts.forEach((art) => {
        md += `### ${art.title}\n${art.content}\n\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNotebook.source.name}-research-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleCopySummary = () => {
    if (!activeNotebook) return;
    const summary = `RepoNotebook: ${activeNotebook.source.fullName} (${activeNotebook.source.selectedRef})\nFiles Indexed: ${activeNotebook.files.length} (${activeNotebook.chunks.length} chunks)\nNotes: ${activeNotebook.notes.length}\nArtifacts: ${activeNotebook.artifacts.length}`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setExportOpen(false);
    }, 1500);
  };

  return (
    <header className="h-13 border-b border-[#30363D] bg-[#161B22] px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Active Notebook Switcher */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#1F6FEB] flex items-center justify-center text-white shadow-xs">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-[#F0F6FC] tracking-tight hidden sm:inline">
            RepoNotebook
          </span>
        </div>

        <div className="h-4 w-px bg-[#30363D] hidden sm:block" />

        {/* Notebook Switcher Button */}
        <div className="relative">
          <button
            id="notebook-switcher-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-xs font-medium text-[#C9D1D9] hover:text-[#F0F6FC] transition min-w-[140px] max-w-[240px] justify-between cursor-pointer"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="truncate">{activeNotebook?.source.fullName || 'Select Notebook'}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#8B949E] shrink-0" />
          </button>

          {/* Notebook Dropdown */}
          {dropdownOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 w-72 bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in"
              onClick={() => setDropdownOpen(false)}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B949E] border-b border-[#30363D]">
                Single-Repo Notebooks ({notebooks.length})
              </div>
              <div className="max-h-60 overflow-y-auto py-1">
                {notebooks.map((nb) => (
                  <button
                    key={nb.id}
                    onClick={() => onSelectNotebook(nb.id)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#21262D] transition cursor-pointer ${
                      activeNotebook?.id === nb.id ? 'bg-[#21262D] text-[#58A6FF] font-semibold' : 'text-[#C9D1D9]'
                    }`}
                  >
                    <div className="truncate">
                      <div className="truncate font-medium">{nb.source.fullName}</div>
                      <div className="text-[10px] text-[#8B949E] flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5" />
                        <span>{nb.source.selectedRef}</span>
                        <span>&bull;</span>
                        <span>{nb.files.length} files</span>
                      </div>
                    </div>
                    {activeNotebook?.id === nb.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-[#30363D] p-1.5">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onNewNotebook();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-[#238636] hover:bg-[#2EA043] text-white font-medium transition cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Notebook</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Strict 1-Source Boundary Indicator */}
        {activeNotebook && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0D1117] border border-[#30363D] text-[11px] font-medium text-[#58A6FF]">
            <Lock className="w-3 h-3 text-[#3FB950]" />
            <span className="text-[#8B949E]">Locked Source:</span>
            <span className="font-mono text-[#F0F6FC]">{activeNotebook.source.name}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          id="nav-new-notebook-btn"
          onClick={onNewNotebook}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#238636] hover:bg-[#2EA043] text-white text-xs font-medium shadow-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Notebook</span>
        </button>

        {/* Export Menu */}
        <div className="relative">
          <button
            id="nav-export-btn"
            onClick={() => setExportOpen(!exportOpen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-xs font-medium text-[#C9D1D9] hover:text-[#F0F6FC] transition cursor-pointer"
            title="Export notebook content"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export</span>
          </button>

          {exportOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in"
              onClick={() => setExportOpen(false)}
            >
              <button
                onClick={handleExportMarkdown}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#58A6FF]" />
                <span>Export Notes (Markdown)</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#3FB950]" />
                <span>Export Notebook (.JSON)</span>
              </button>
              <button
                onClick={handleCopySummary}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
                <span>{copied ? 'Copied Summary' : 'Copy Summary'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Docs / Reference */}
        {onOpenDocs && (
          <button
            id="nav-docs-btn"
            onClick={onOpenDocs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-xs font-medium text-[#C9D1D9] hover:text-[#58A6FF] transition cursor-pointer"
            title="Open complete repo documentation and architecture guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#58A6FF]" />
            <span className="hidden md:inline">Docs</span>
          </button>
        )}

        {/* GitHub Token / Settings */}
        <button
          id="nav-settings-btn"
          onClick={onOpenSettings}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition cursor-pointer ${
            hasCustomToken
              ? 'border-[#238636] bg-[#238636]/20 text-[#3FB950]'
              : 'border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC]'
          }`}
          title={hasCustomToken ? 'GitHub Token Active' : 'Add GitHub Personal Token for private repos / rate limits'}
        >
          <Key className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{hasCustomToken ? 'Token Active' : 'GitHub Token'}</span>
        </button>
      </div>
    </header>
  );
};
