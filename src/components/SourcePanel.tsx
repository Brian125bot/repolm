import React, { useState } from 'react';
import { RepoSource, SourceFile, FileCategory } from '../types';
import {
  FileCode,
  FileText,
  Settings,
  ShieldCheck,
  GitBranch,
  Star,
  GitFork,
  Scale,
  RefreshCw,
  Search,
  Lock,
  FolderTree,
  ExternalLink,
  Layers,
  PanelLeftClose,
} from 'lucide-react';

interface SourcePanelProps {
  source: RepoSource;
  files: SourceFile[];
  onSelectFile: (file: SourceFile) => void;
  onReindex: () => void;
  isReindexing: boolean;
  onToggleCollapse?: () => void;
}

export const SourcePanel: React.FC<SourcePanelProps> = ({
  source,
  files,
  onSelectFile,
  onReindex,
  isReindexing,
  onToggleCollapse,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: Array<{ id: FileCategory; label: string; icon: React.ReactNode; count: number }> = [
    { id: 'all', label: 'All Files', icon: <Layers className="w-3.5 h-3.5" />, count: files.length },
    { id: 'doc', label: 'Docs', icon: <FileText className="w-3.5 h-3.5" />, count: source.categoryCounts.doc },
    { id: 'code', label: 'Code', icon: <FileCode className="w-3.5 h-3.5" />, count: source.categoryCounts.code },
    { id: 'config', label: 'Config', icon: <Settings className="w-3.5 h-3.5" />, count: source.categoryCounts.config },
    { id: 'test', label: 'Tests', icon: <ShieldCheck className="w-3.5 h-3.5" />, count: source.categoryCounts.test },
    { id: 'workflow', label: 'Workflows', icon: <GitBranch className="w-3.5 h-3.5" />, count: source.categoryCounts.workflow },
  ];

  const filteredFiles = files.filter((f) => {
    const matchesCategory = selectedCategory === 'all' || f.fileCategory === selectedCategory;
    const matchesSearch = searchQuery === '' || f.path.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getFileCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case 'doc':
        return <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case 'config':
        return <Settings className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'test':
        return <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
      case 'workflow':
        return <GitBranch className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0D1117] text-[#C9D1D9] select-none">
      {/* 1. Repository Source Card */}
      <div className="p-3.5 border-b border-[#30363D] bg-[#161B22]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={source.avatarUrl}
              alt={source.owner}
              className="w-9 h-9 rounded-md border border-[#30363D] bg-[#21262D] object-cover shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-semibold text-sm text-[#F0F6FC] truncate">
                  {source.name}
                </h2>
                <a
                  href={source.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#8B949E] hover:text-[#58A6FF] transition"
                  title="View repo on GitHub"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-[#8B949E] truncate">
                {source.owner} &bull; <span className="font-mono text-[#58A6FF]">{source.selectedRef}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              id="reindex-source-btn"
              onClick={onReindex}
              disabled={isReindexing}
              className="p-1.5 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition disabled:opacity-50 cursor-pointer shrink-0"
              title="Re-fetch and re-index repository"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin text-[#58A6FF]' : ''}`} />
            </button>
            {onToggleCollapse && (
              <button
                id="collapse-left-panel-btn"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer shrink-0"
                title="Collapse Sources sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-[#8B949E] mt-2 line-clamp-2 leading-relaxed">
          {source.description}
        </p>

        {/* Metadata Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[10px] text-[#8B949E]">
          <div className="flex items-center gap-1 bg-[#21262D] border border-[#30363D] px-2 py-0.5 rounded-md">
            <Star className="w-3 h-3 text-[#E3B341] fill-[#E3B341]" />
            <span className="text-[#C9D1D9]">{source.stars.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#21262D] border border-[#30363D] px-2 py-0.5 rounded-md">
            <GitFork className="w-3 h-3 text-[#8B949E]" />
            <span className="text-[#C9D1D9]">{source.forks.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#21262D] border border-[#30363D] px-2 py-0.5 rounded-md">
            <Scale className="w-3 h-3 text-[#8B949E]" />
            <span className="text-[#C9D1D9]">{source.license}</span>
          </div>
        </div>

        {/* Strict 1-Repo Guard Note */}
        <div className="mt-2.5 p-2 rounded-md bg-[#0D1117] border border-[#30363D] flex items-center gap-2 text-[11px] text-[#58A6FF]">
          <Lock className="w-3 h-3 text-[#3FB950] shrink-0" />
          <span className="leading-tight text-[#8B949E]">
            <strong className="text-[#F0F6FC]">Single Source:</strong> All Q&A & notes strictly verified against this repo.
          </span>
        </div>
      </div>

      {/* 2. Category Filter Tabs */}
      <div className="p-2 border-b border-[#30363D] bg-[#161B22]">
        <div className="grid grid-cols-3 gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              id={`cat-filter-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#21262D] text-[#58A6FF] border border-[#30363D] font-semibold'
                  : 'text-[#8B949E] hover:bg-[#21262D]/60 hover:text-[#C9D1D9]'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </div>
              <span className="text-[10px] opacity-70 ml-1 font-mono">{cat.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Search & File Count */}
      <div className="p-2 border-b border-[#30363D] bg-[#161B22]/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#8B949E]" />
          <input
            id="source-file-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${filteredFiles.length} files...`}
            className="w-full pl-8 pr-3 py-1 text-xs rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] focus:outline-none focus:border-[#58A6FF] placeholder:text-[#484F58]"
          />
        </div>
      </div>

      {/* 4. File List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 bg-[#0D1117]">
        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <FolderTree className="w-3 h-3" />
            <span>Indexed Files ({filteredFiles.length})</span>
          </span>
          <span>Lines</span>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8B949E]">
            No files match this filter.
          </div>
        ) : (
          filteredFiles.map((file) => (
            <button
              key={file.id}
              id={`file-item-${file.id}`}
              onClick={() => onSelectFile(file)}
              className="w-full text-left px-2 py-1 rounded-md hover:bg-[#161B22] border border-transparent hover:border-[#30363D] flex items-center justify-between text-xs text-[#C9D1D9] transition group cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                {getFileCategoryIcon(file.fileCategory)}
                <span className="font-mono text-[11px] truncate group-hover:text-[#58A6FF]">
                  {file.path}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-[#8B949E]">
                <span className="font-mono">{file.lineCount}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* 5. Footer Stats */}
      <div className="p-2.5 border-t border-[#30363D] bg-[#161B22] text-xs text-[#8B949E]">
        <div className="flex justify-between items-center text-[11px]">
          <span>Total Code Volume</span>
          <span className="font-semibold text-[#F0F6FC] font-mono">
            {source.totalLines.toLocaleString()} lines &bull; {source.totalFiles} files
          </span>
        </div>
        {/* Language Pill Bar */}
        <div className="w-full bg-[#21262D] h-1.5 rounded-full mt-2 overflow-hidden flex">
          {Object.entries(source.languages).slice(0, 3).map(([lang, val], idx) => {
            const colors = ['bg-[#58A6FF]', 'bg-[#3FB950]', 'bg-[#D29922]'];
            return (
              <div
                key={lang}
                className={`${colors[idx % colors.length]} h-full`}
                style={{ width: `${Math.max(val, 10)}%` }}
                title={`${lang}: ${val}%`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
