import React, { useEffect, useRef, useState } from 'react';
import { SourceFile, Citation, RepoSource } from '../types';
import { X, ExternalLink, Copy, Check, FileCode, Search } from 'lucide-react';

interface FileViewerModalProps {
  file: SourceFile | null;
  citation?: Citation | null;
  repoSource: RepoSource;
  onClose: () => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  file,
  citation,
  repoSource,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const lineContainerRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to citation highlight line if present
    if (citation && targetLineRef.current) {
      setTimeout(() => {
        targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [file, citation]);

  if (!file) return null;

  const lines = file.content.split('\n');
  const startHighlight = citation?.startLine || -1;
  const endHighlight = citation?.endLine || citation?.startLine || -1;

  const handleCopy = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const githubFileUrl = `${repoSource.repoUrl}/blob/${repoSource.selectedRef}/${file.path}${
    citation ? `#L${citation.startLine}-L${citation.endLine}` : ''
  }`;

  return (
    <div
      id="file-viewer-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        id="file-viewer-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-semibold text-[#F0F6FC] truncate">
                  {file.path}
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-medium bg-[#21262D] border border-[#30363D] text-[#8B949E]">
                  {file.language}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded font-mono capitalize bg-[#388BFD]/15 border border-[#388BFD]/30 text-[#58A6FF]">
                  {file.fileCategory}
                </span>
              </div>
              <p className="text-xs text-[#8B949E] mt-0.5 font-mono">
                {lines.length} lines &bull; {(file.size / 1024).toFixed(1)} KB &bull; Grounded in {repoSource.fullName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#8B949E]" />
              <input
                id="file-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Find in file..."
                className="pl-8 pr-3 py-1 text-xs rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF] w-36 sm:w-48"
              />
            </div>

            <button
              id="file-copy-btn"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] transition cursor-pointer"
              title="Copy entire file content"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <a
              id="file-github-link"
              href={githubFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] text-white transition cursor-pointer"
              title="Open source file on GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>

            <button
              id="file-viewer-close-btn"
              onClick={onClose}
              className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Citation Banner if citing specific lines */}
        {citation && (
          <div className="px-5 py-2 bg-[#D29922]/15 border-b border-[#D29922]/30 flex items-center justify-between text-xs text-[#E3B341]">
            <div className="flex items-center gap-2">
              <span className="font-semibold bg-[#D29922]/30 border border-[#D29922]/50 px-2 py-0.5 rounded text-[11px] font-mono">
                Cited Lines {citation.startLine} - {citation.endLine}
              </span>
              <span>Showing highlighted verification snippet grounded in this repository.</span>
            </div>
            <button
              onClick={() => targetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="underline font-medium hover:text-[#F0F6FC] cursor-pointer"
            >
              Jump to lines
            </button>
          </div>
        )}

        {/* Code Content */}
        <div
          ref={lineContainerRef}
          className="flex-1 overflow-auto bg-[#0D1117] text-[#C9D1D9] font-mono text-xs p-4 leading-relaxed select-text"
        >
          <div className="min-w-full inline-block">
            {lines.map((lineContent, index) => {
              const lineNum = index + 1;
              const isHighlighted = lineNum >= startHighlight && lineNum <= endHighlight;
              const isSearchMatch = searchTerm && lineContent.toLowerCase().includes(searchTerm.toLowerCase());

              return (
                <div
                  key={lineNum}
                  ref={lineNum === startHighlight ? targetLineRef : undefined}
                  className={`flex items-stretch group transition-colors ${
                    isHighlighted
                      ? 'bg-[#D29922]/20 border-l-2 border-[#D29922] pl-2 -ml-2.5'
                      : isSearchMatch
                      ? 'bg-[#388BFD]/20'
                      : 'hover:bg-[#161B22]'
                  }`}
                >
                  <span
                    className={`w-12 shrink-0 select-none text-right pr-4 ${
                      isHighlighted
                        ? 'text-[#E3B341] font-bold'
                        : 'text-[#484F58] group-hover:text-[#8B949E]'
                    }`}
                  >
                    {lineNum}
                  </span>
                  <span className="flex-1 whitespace-pre pr-4 text-[#C9D1D9]">
                    {lineContent || ' '}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
