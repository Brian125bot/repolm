import React from 'react';
import { Citation } from '../types';
import { FileCode, FileText, Settings, ShieldCheck, GitBranch } from 'lucide-react';

interface CitationChipProps {
  citation: Citation;
  onClick?: (citation: Citation) => void;
  size?: 'sm' | 'md';
}

export const CitationChip: React.FC<CitationChipProps> = ({
  citation,
  onClick,
  size = 'md',
}) => {
  const getIcon = () => {
    switch (citation.fileCategory) {
      case 'doc':
        return <FileText className="w-3 h-3 text-[#3FB950]" />;
      case 'config':
        return <Settings className="w-3 h-3 text-[#D29922]" />;
      case 'test':
        return <ShieldCheck className="w-3 h-3 text-[#58A6FF]" />;
      case 'workflow':
        return <GitBranch className="w-3 h-3 text-[#BC8CFF]" />;
      default:
        return <FileCode className="w-3 h-3 text-[#58A6FF]" />;
    }
  };

  const lineRangeText =
    citation.startLine === citation.endLine
      ? `L${citation.startLine}`
      : `L${citation.startLine}-L${citation.endLine}`;

  return (
    <button
      id={`citation-chip-${citation.id}`}
      type="button"
      onClick={() => onClick && onClick(citation)}
      className={`inline-flex items-center gap-1.5 font-mono text-xs rounded-md border transition-all duration-150 cursor-pointer ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      } bg-[#161B22] hover:bg-[#21262D] border-[#30363D] hover:border-[#58A6FF] text-[#C9D1D9] shadow-xs`}
      title={`View ${citation.filePath} at lines ${citation.startLine}-${citation.endLine}`}
    >
      {getIcon()}
      <span className="font-medium truncate max-w-[170px] text-[#F0F6FC]">
        {citation.filePath}
      </span>
      <span className="text-[#8B949E] font-semibold text-[10px]">
        {lineRangeText}
      </span>
    </button>
  );
};
