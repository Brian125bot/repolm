import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, Notebook } from '../types';
import { mergeNotesToBriefing } from '../services/api';
import { Sparkles, X, Check, Copy, FileText, Share2, RefreshCw } from 'lucide-react';

interface MergeNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  notebook: Notebook;
  onSaveMergedNote: (title: string, content: string) => void;
}

export const MergeNotesModal: React.FC<MergeNotesModalProps> = ({
  isOpen,
  onClose,
  notebook,
  onSaveMergedNote,
}) => {
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>(
    notebook.notes.map((n) => n.id)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [briefing, setBriefing] = useState<{ title: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const toggleNote = (id: string) => {
    if (selectedNoteIds.includes(id)) {
      setSelectedNoteIds(selectedNoteIds.filter((x) => x !== id));
    } else {
      setSelectedNoteIds([...selectedNoteIds, id]);
    }
  };

  const handleMerge = async () => {
    const notesToMerge = notebook.notes.filter((n) => selectedNoteIds.includes(n.id));
    if (notesToMerge.length === 0) return;

    setIsLoading(true);
    try {
      const res = await mergeNotesToBriefing({
        notes: notesToMerge,
        notebook,
      });
      setBriefing(res);
    } catch (err: any) {
      alert(`Merge failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!briefing) return;
    navigator.clipboard.writeText(`# ${briefing.title}\n\n${briefing.content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAsMasterNote = () => {
    if (!briefing) return;
    onSaveMergedNote(briefing.title, briefing.content);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div
      id="merge-notes-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="merge-notes-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden text-[#C9D1D9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F0F6FC]">
                Merge Notes into Executive Briefing
              </h3>
              <p className="text-xs text-[#8B949E] font-mono">
                Synthesize selected research notes into a cohesive summary report for {notebook.source.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0D1117]">
          {!briefing ? (
            <>
              <div className="text-xs text-[#8B949E]">
                Select the notes you want to synthesize:
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {notebook.notes.map((note) => {
                  const isChecked = selectedNoteIds.includes(note.id);
                  return (
                    <div
                      key={note.id}
                      onClick={() => toggleNote(note.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-[#161B22] border-[#58A6FF]/60'
                          : 'bg-[#161B22]/50 border-[#30363D] opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-[#30363D] bg-[#0D1117] text-[#58A6FF] focus:ring-0"
                        />
                        <div className="truncate">
                          <h4 className="text-xs font-semibold text-[#F0F6FC] truncate">
                            {note.title}
                          </h4>
                          <p className="text-[11px] text-[#8B949E] truncate mt-0.5 font-mono">
                            {note.content.slice(0, 100)}...
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[#58A6FF] shrink-0">
                        {note.tags.join(', ')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#161B22] border border-[#30363D]">
                <h2 className="text-sm font-bold text-[#F0F6FC] mb-2">
                  {briefing.title}
                </h2>
                <div className="prose prose-sm max-w-none text-[#C9D1D9] leading-relaxed text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {briefing.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#30363D] bg-[#161B22]">
          {!briefing ? (
            <>
              <span className="text-xs text-[#8B949E] font-mono">
                {selectedNoteIds.length} of {notebook.notes.length} notes selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs text-[#8B949E] hover:bg-[#21262D] hover:text-[#C9D1D9] rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMerge}
                  disabled={selectedNoteIds.length === 0 || isLoading}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] text-white disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isLoading ? 'Synthesizing...' : 'Synthesize Briefing'}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setBriefing(null)}
                className="px-2.5 py-1 text-xs text-[#8B949E] hover:bg-[#21262D] hover:text-[#C9D1D9] rounded-md cursor-pointer"
              >
                Back to Selection
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
                  <span>{copied ? 'Copied' : 'Copy Briefing'}</span>
                </button>
                <button
                  onClick={handleSaveAsMasterNote}
                  className="px-3 py-1 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] text-white flex items-center gap-1.5 cursor-pointer"
                >
                  {saved ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  <span>{saved ? 'Saved to Notes!' : 'Save as Master Note'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
