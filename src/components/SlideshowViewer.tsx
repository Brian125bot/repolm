import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Artifact, Citation, RepoSource } from '../types';
import { CitationChip } from './CitationChip';
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  FileCode,
  Sparkles,
  Layers,
  LayoutGrid,
  Volume2,
  ExternalLink,
  GitBranch,
} from 'lucide-react';

interface SlideshowViewerProps {
  artifact: Artifact;
  repoSource: RepoSource;
  onSelectCitation: (citation: Citation) => void;
}

interface Slide {
  id: number;
  title: string;
  subtitle?: string;
  rawContent: string;
  bullets: string[];
  codeBlock?: { language: string; code: string };
  speakerNotes?: string;
  citations: Citation[];
}

export const SlideshowViewer: React.FC<SlideshowViewerProps> = ({
  artifact,
  repoSource,
  onSelectCitation,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'slide' | 'grid'>('slide');
  const [copied, setCopied] = useState<boolean>(false);

  // Parse markdown into slides array
  const slides = useMemo((): Slide[] => {
    let rawChunks = artifact.content.split(/\n---\n/);
    if (rawChunks.length <= 1) {
      // Try splitting by # Slide or # headers
      rawChunks = artifact.content.split(/\n(?=# )/);
    }

    const parsedSlides: Slide[] = [];

    rawChunks.forEach((chunk, index) => {
      const trimmed = chunk.trim();
      if (!trimmed) return;

      const lines = trimmed.split('\n');
      let title = `Slide ${index + 1}`;
      let subtitle = '';
      const bullets: string[] = [];
      let speakerNotes = '';
      let codeLang = '';
      let codeText = '';
      let inCode = false;
      let inSpeakerNotes = false;

      const slideCitations: Citation[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Extract citations on this line
        const citMatches = line.matchAll(/\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g);
        for (const m of citMatches) {
          const filePath = m[1];
          const startLine = parseInt(m[2], 10);
          const endLine = m[3] ? parseInt(m[3], 10) : startLine;
          slideCitations.push({
            id: `cit-slide-${index}-${filePath}-${startLine}`,
            filePath,
            startLine,
            endLine,
            fileCategory: 'code',
          });
        }

        if (line.startsWith('```')) {
          if (!inCode) {
            inCode = true;
            codeLang = line.replace('```', '').trim() || 'typescript';
            codeText = '';
          } else {
            inCode = false;
          }
          continue;
        }

        if (inCode) {
          codeText += (codeText ? '\n' : '') + line;
          continue;
        }

        if (
          line.toLowerCase().startsWith('speaker notes:') ||
          line.toLowerCase().startsWith('**speaker notes**:') ||
          line.toLowerCase().startsWith('notes:')
        ) {
          inSpeakerNotes = true;
          speakerNotes = line.replace(/speaker notes:?/i, '').replace(/\*\*/g, '').trim();
          continue;
        }

        if (inSpeakerNotes) {
          speakerNotes += ' ' + line.trim();
          continue;
        }

        if (line.startsWith('# ') || (line.startsWith('## ') && !title.startsWith('Slide '))) {
          title = line.replace(/^#+\s*/, '').replace(/\[.*?\]/g, '').trim();
        } else if (line.startsWith('### ') || line.startsWith('## ')) {
          if (!subtitle) {
            subtitle = line.replace(/^#+\s*/, '').replace(/\[.*?\]/g, '').trim();
          } else {
            bullets.push(line.replace(/^#+\s*/, '').trim());
          }
        } else if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
          bullets.push(line.replace(/^[-*0-9.]+\s*/, '').trim());
        } else if (line.trim().length > 0 && !line.startsWith('---')) {
          bullets.push(line.trim());
        }
      }

      parsedSlides.push({
        id: index + 1,
        title,
        subtitle,
        rawContent: trimmed,
        bullets,
        codeBlock: codeText ? { language: codeLang, code: codeText } : undefined,
        speakerNotes: speakerNotes.trim() || undefined,
        citations: slideCitations.length > 0 ? slideCitations : artifact.citations.slice(index, index + 2),
      });
    });

    if (parsedSlides.length === 0) {
      parsedSlides.push({
        id: 1,
        title: repoSource.fullName || 'Repository Overview',
        subtitle: repoSource.description,
        rawContent: artifact.content,
        bullets: ['Overview of repository architecture and features', 'Explore slide deck below'],
        citations: artifact.citations,
      });
    }

    return parsedSlides;
  }, [artifact.content, artifact.citations, repoSource.fullName, repoSource.description]);

  const currentSlide = slides[currentSlideIndex] || slides[0];

  const handleNext = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev < slides.length - 1 ? prev + 1 : prev));
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, isFullscreen]);

  const handleCopyDeck = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex flex-col bg-[#0D1117] text-[#C9D1D9] border border-[#30363D] rounded-xl overflow-hidden shadow-xl ${
        isFullscreen ? 'fixed inset-4 z-50' : 'h-full min-h-[520px]'
      }`}
    >
      {/* Presentation Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161B22] border-b border-[#30363D] flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
            <Presentation className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#F0F6FC]">
                {artifact.title || 'Repository Technical Slide Deck'}
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#21262D] border border-[#30363D] text-[#58A6FF] font-mono">
                {repoSource.name}
              </span>
            </div>
            <p className="text-[10px] text-[#8B949E] font-mono">
              Slide {currentSlideIndex + 1} of {slides.length} &bull; Use Arrow keys to navigate
            </p>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0D1117] p-1 rounded-lg border border-[#30363D]">
            <button
              onClick={() => setViewMode('slide')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'slide'
                  ? 'bg-[#21262D] text-[#58A6FF] shadow-xs'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <Presentation className="w-3.5 h-3.5" />
              <span>Slide View</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-[#21262D] text-[#58A6FF] shadow-xs'
                  : 'text-[#8B949E] hover:text-[#F0F6FC]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All Slides ({slides.length})</span>
            </button>
          </div>

          <button
            onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
            className={`px-2.5 py-1 text-xs font-mono rounded-md border transition flex items-center gap-1.5 cursor-pointer ${
              showSpeakerNotes
                ? 'bg-[#58A6FF]/20 border-[#58A6FF] text-[#58A6FF]'
                : 'bg-[#21262D] border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
            title="Toggle speaker talking notes"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">Notes</span>
          </button>

          <button
            onClick={handleCopyDeck}
            className="px-2.5 py-1 text-xs font-mono rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] transition flex items-center gap-1.5 cursor-pointer"
            title="Copy Marp / Markdown slides"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy Slides'}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Slide Canvas */}
      {viewMode === 'slide' ? (
        <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 bg-[#0D1117] overflow-y-auto relative">
          <div className="max-w-3xl w-full mx-auto space-y-6">
            {/* Slide Header */}
            <div className="space-y-2 border-b border-[#30363D] pb-4">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#58A6FF]">
                <span>SLIDE {currentSlide.id} OF {slides.length}</span>
                <span className="text-[#8B949E]">{repoSource.fullName}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F0F6FC]">
                {currentSlide.title}
              </h2>
              {currentSlide.subtitle && (
                <p className="text-sm font-mono text-[#58A6FF]/90">
                  {currentSlide.subtitle}
                </p>
              )}
            </div>

            {/* Slide Bullets */}
            {currentSlide.bullets.length > 0 && (
              <ul className="space-y-3">
                {currentSlide.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-[#C9D1D9] leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#58A6FF] shrink-0 mt-2" />
                    <div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {bullet}
                      </ReactMarkdown>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Code Snippet Box */}
            {currentSlide.codeBlock && (
              <div className="space-y-1 pt-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#8B949E] px-1">
                  <span className="flex items-center gap-1">
                    <FileCode className="w-3 h-3 text-[#58A6FF]" />
                    <span>{currentSlide.codeBlock.language}</span>
                  </span>
                </div>
                <pre className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] text-[#58A6FF] font-mono text-xs overflow-x-auto leading-relaxed">
                  <code>{currentSlide.codeBlock.code}</code>
                </pre>
              </div>
            )}

            {/* Speaker Notes Drawer */}
            {showSpeakerNotes && currentSlide.speakerNotes && (
              <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#58A6FF]/40 space-y-1 animate-in fade-in">
                <div className="text-[11px] font-semibold text-[#58A6FF] flex items-center gap-1.5 font-mono">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Presenter Speaker Notes:</span>
                </div>
                <p className="text-xs text-[#8B949E] leading-relaxed font-mono">
                  {currentSlide.speakerNotes}
                </p>
              </div>
            )}

            {/* Slide Grounded Citations */}
            {currentSlide.citations && currentSlide.citations.length > 0 && (
              <div className="pt-4 border-t border-[#30363D]/70 flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-[#8B949E] flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-[#58A6FF]" />
                  <span>Cited Source Files:</span>
                </span>
                {currentSlide.citations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCitation(c)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-[#388BFD]/15 hover:bg-[#388BFD]/30 text-[#58A6FF] border border-[#388BFD]/30 transition cursor-pointer"
                    title={`View ${c.filePath}:${c.startLine}`}
                  >
                    <span>{c.filePath.split('/').pop()}:L{c.startLine}-{c.endLine}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Controls Bar */}
          <div className="max-w-3xl w-full mx-auto pt-6 border-t border-[#30363D] flex items-center justify-between gap-4">
            <button
              onClick={handlePrev}
              disabled={currentSlideIndex === 0}
              className="px-3.5 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 text-xs font-mono text-[#C9D1D9] transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {/* Slide Progress Dots / Selector */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`w-2.5 h-2.5 rounded-full transition cursor-pointer ${
                    idx === currentSlideIndex
                      ? 'bg-[#58A6FF] scale-125'
                      : 'bg-[#30363D] hover:bg-[#8B949E]'
                  }`}
                  title={`Jump to slide ${idx + 1}`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={currentSlideIndex === slides.length - 1}
              className="px-3.5 py-1.5 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] disabled:opacity-30 text-xs font-mono text-[#C9D1D9] transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Grid Overview Mode */
        <div className="flex-1 p-6 bg-[#0D1117] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                onClick={() => {
                  setCurrentSlideIndex(idx);
                  setViewMode('slide');
                }}
                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between aspect-video ${
                  idx === currentSlideIndex
                    ? 'bg-[#161B22] border-[#58A6FF] shadow-lg ring-1 ring-[#58A6FF]/40'
                    : 'bg-[#161B22]/60 border-[#30363D] hover:border-[#58A6FF]/50 hover:bg-[#161B22]'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#8B949E]">
                    <span>SLIDE {slide.id}</span>
                    {idx === currentSlideIndex && (
                      <span className="text-[#58A6FF]">Active</span>
                    )}
                  </div>
                  <h4 className="font-semibold text-xs text-[#F0F6FC] line-clamp-2">
                    {slide.title}
                  </h4>
                  {slide.subtitle && (
                    <p className="text-[10px] font-mono text-[#58A6FF] line-clamp-1">
                      {slide.subtitle}
                    </p>
                  )}
                  <p className="text-[11px] text-[#8B949E] line-clamp-3">
                    {slide.bullets[0] || 'Slide content overview...'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#30363D] text-[10px] font-mono text-[#8B949E]">
                  <span>{slide.citations.length} citations</span>
                  <span className="text-[#58A6FF] hover:underline">Open Slide &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="h-1 bg-[#21262D] w-full">
        <div
          className="h-full bg-[#58A6FF] transition-all duration-300"
          style={{ width: `${((currentSlideIndex + 1) / slides.length) * 100}%` }}
        />
      </div>
    </div>
  );
};
