import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArtifactType,
  Artifact,
  Note,
  Citation,
  RepoSource,
  ArtifactInfo,
} from '../types';
import { CitationChip } from './CitationChip';
import { MindmapViewer } from './MindmapViewer';
import { SlideshowViewer } from './SlideshowViewer';
import {
  Sparkles,
  BookOpen,
  FileText,
  Pin,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Download,
  Layers,
  Code,
  ShieldCheck,
  GitBranch,
  HelpCircle,
  AlertTriangle,
  FolderTree,
  Package,
  Compass,
  History,
  X,
  Share2,
  Network,
  Presentation,
  PanelRightClose,
} from 'lucide-react';

interface StudioPanelProps {
  notebookId: string;
  repoSource: RepoSource;
  artifacts: Artifact[];
  notes: Note[];
  pinnedCitations: Citation[];
  onGenerateArtifact: (type: ArtifactType) => void;
  isGeneratingArtifact: boolean;
  generatingType: ArtifactType | null;
  onSaveNote: (note: Partial<Note>) => void;
  onDeleteNote: (id: string) => void;
  onSelectCitation: (citation: Citation) => void;
  onUnpinCitation: (citationId: string) => void;
  onOpenMergeModal: () => void;
  onToggleCollapse?: () => void;
}

export const ARTIFACT_DEFINITIONS: ArtifactInfo[] = [
  {
    type: 'overview',
    title: 'Repo Overview',
    description: 'Executive summary of repository purpose, core capabilities, and scope',
    iconName: 'BookOpen',
    category: 'core',
  },
  {
    type: 'mindmap',
    title: 'Interactive Codebase Mindmap',
    description: 'Hierarchical visual map of architecture, state lifecycle, and modules',
    iconName: 'Network',
    category: 'technical',
  },
  {
    type: 'slideshow',
    title: 'Technical Slide Deck',
    description: 'Interactive presentation slides summarizing key design patterns & APIs',
    iconName: 'Presentation',
    category: 'core',
  },
  {
    type: 'getting_started',
    title: 'Getting Started Guide',
    description: 'Step-by-step setup, dependencies installation, and first-run instructions',
    iconName: 'Compass',
    category: 'guide',
  },
  {
    type: 'architecture',
    title: 'Architecture & Design',
    description: 'System design, state lifecycle, module boundaries, and internal mechanics',
    iconName: 'Layers',
    category: 'technical',
  },
  {
    type: 'glossary',
    title: 'Key Concepts Glossary',
    description: 'Dictionary of critical types, abstractions, interfaces, and domains',
    iconName: 'FileText',
    category: 'core',
  },
  {
    type: 'api_surface',
    title: 'API Surface Summary',
    description: 'Exported methods, interfaces, hooks, and configuration signatures',
    iconName: 'Code',
    category: 'technical',
  },
  {
    type: 'folder_structure',
    title: 'Folder Structure Explainer',
    description: 'Breakdown of repository paths and directory responsibilities',
    iconName: 'FolderTree',
    category: 'technical',
  },
  {
    type: 'dependency_map',
    title: 'Dependency Map',
    description: 'Manifest analysis, runtime libraries, peer dependencies, and tooling',
    iconName: 'Package',
    category: 'technical',
  },
  {
    type: 'testing',
    title: 'Testing Overview',
    description: 'Test runner setups, coverage domains, unit test conventions, and suites',
    iconName: 'ShieldCheck',
    category: 'quality',
  },
  {
    type: 'deployment_ci',
    title: 'CI & Workflows',
    description: 'GitHub Actions, automated test suites, build and release pipelines',
    iconName: 'GitBranch',
    category: 'quality',
  },
  {
    type: 'faq',
    title: 'Repository FAQ',
    description: 'Answers to common questions and edge cases grounded in code',
    iconName: 'HelpCircle',
    category: 'guide',
  },
  {
    type: 'onboarding',
    title: 'Contributor Onboarding',
    description: 'Checklist and orientation landmarks for new codebase contributors',
    iconName: 'Compass',
    category: 'guide',
  },
  {
    type: 'risks_rough_edges',
    title: 'Risks & Rough Edges',
    description: 'Undocumented APIs, missing test coverage, and technical debt hotspots',
    iconName: 'AlertTriangle',
    category: 'quality',
  },
  {
    type: 'change_summary',
    title: 'Versioning & Releases',
    description: 'Package versioning, licensing notes, and artifact distributions',
    iconName: 'History',
    category: 'core',
  },
];

export const StudioPanel: React.FC<StudioPanelProps> = ({
  notebookId,
  repoSource,
  artifacts,
  notes,
  pinnedCitations,
  onGenerateArtifact,
  isGeneratingArtifact,
  generatingType,
  onSaveNote,
  onDeleteNote,
  onSelectCitation,
  onUnpinCitation,
  onOpenMergeModal,
  onToggleCollapse,
}) => {
  const [activeTab, setActiveTab] = useState<'artifacts' | 'notes' | 'pins'>('artifacts');
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);

  // Note editor state
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [copiedArtifact, setCopiedArtifact] = useState(false);
  const [searchNotes, setSearchNotes] = useState('');

  const getArtifactIcon = (iconName: string) => {
    switch (iconName) {
      case 'Network':
        return <Network className="w-4 h-4 text-[#58A6FF]" />;
      case 'Presentation':
        return <Presentation className="w-4 h-4 text-[#3FB950]" />;
      case 'Layers':
        return <Layers className="w-4 h-4 text-indigo-500" />;
      case 'Code':
        return <Code className="w-4 h-4 text-blue-500" />;
      case 'FolderTree':
        return <FolderTree className="w-4 h-4 text-amber-500" />;
      case 'Package':
        return <Package className="w-4 h-4 text-emerald-500" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-4 h-4 text-teal-500" />;
      case 'GitBranch':
        return <GitBranch className="w-4 h-4 text-purple-500" />;
      case 'HelpCircle':
        return <HelpCircle className="w-4 h-4 text-sky-500" />;
      case 'Compass':
        return <Compass className="w-4 h-4 text-orange-500" />;
      case 'AlertTriangle':
        return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      case 'History':
        return <History className="w-4 h-4 text-violet-500" />;
      default:
        return <BookOpen className="w-4 h-4 text-indigo-500" />;
    }
  };

  const handleStartNewNote = () => {
    setEditingNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setNoteTags('');
    setIsEditingNote(true);
  };

  const handleStartEditNote = (n: Note) => {
    setEditingNoteId(n.id);
    setNoteTitle(n.title);
    setNoteContent(n.content);
    setNoteTags(n.tags.join(', '));
    setIsEditingNote(true);
  };

  const handleSaveNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() && !noteContent.trim()) return;

    const tagsArray = noteTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    onSaveNote({
      id: editingNoteId || `note-${Date.now()}`,
      notebookId,
      title: noteTitle.trim() || 'Untitled Note',
      content: noteContent,
      tags: tagsArray,
      citations: [],
    });

    setIsEditingNote(false);
    setEditingNoteId(null);
  };

  const handleCopyArtifactContent = () => {
    if (!selectedArtifact) return;
    navigator.clipboard.writeText(selectedArtifact.content);
    setCopiedArtifact(true);
    setTimeout(() => setCopiedArtifact(false), 2000);
  };

  const handleSaveArtifactAsNote = (art: Artifact) => {
    onSaveNote({
      id: `note-from-art-${Date.now()}`,
      notebookId,
      title: art.title,
      content: art.content,
      tags: ['artifact', art.type],
      citations: art.citations,
    });
    setActiveTab('notes');
    setSelectedArtifact(null);
  };

  const filteredNotes = notes.filter((n) => {
    const q = searchNotes.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full h-full flex flex-col bg-[#0D1117] text-[#C9D1D9] border-l border-[#30363D] select-none">
      {/* 1. Header with Tab Navigation */}
      <div className="p-3 border-b border-[#30363D] bg-[#161B22]">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#F0F6FC]">
            <Sparkles className="w-4 h-4 text-[#58A6FF]" />
            <span>Research Studio</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8B949E] font-mono">
              {notes.length} notes &bull; {artifacts.length} arts
            </span>
            {onToggleCollapse && (
              <button
                id="collapse-right-panel-btn"
                onClick={onToggleCollapse}
                className="p-1 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
                title="Collapse Studio sidebar"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 gap-1 bg-[#0D1117] p-0.5 rounded-md text-xs border border-[#30363D]">
          <button
            id="studio-tab-artifacts"
            onClick={() => setActiveTab('artifacts')}
            className={`py-1 px-2 rounded font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'artifacts'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs font-semibold border border-[#30363D]'
                : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Artifacts</span>
          </button>

          <button
            id="studio-tab-notes"
            onClick={() => setActiveTab('notes')}
            className={`py-1 px-2 rounded font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'notes'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs font-semibold border border-[#30363D]'
                : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes ({notes.length})</span>
          </button>

          <button
            id="studio-tab-pins"
            onClick={() => setActiveTab('pins')}
            className={`py-1 px-2 rounded font-medium transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pins'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs font-semibold border border-[#30363D]'
                : 'text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#161B22]'
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Pins ({pinnedCitations.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Content Body by Tab */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0D1117]">
        {/* ================= TAB 1: ARTIFACTS ================= */}
        {activeTab === 'artifacts' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8B949E] leading-tight">
              Generate structured, citation-backed deep-dive artifacts grounded exclusively in <strong className="text-[#F0F6FC]">{repoSource.name}</strong>.
            </div>

            <div className="grid grid-cols-1 gap-2">
              {ARTIFACT_DEFINITIONS.map((def) => {
                const existing = artifacts.find((a) => a.type === def.type);
                const isGeneratingThis = isGeneratingArtifact && generatingType === def.type;

                return (
                  <div
                    key={def.type}
                    id={`artifact-card-${def.type}`}
                    className={`p-3 rounded-lg border transition-all text-left flex flex-col justify-between ${
                      existing
                        ? 'bg-[#161B22] border-[#58A6FF]/40'
                        : 'bg-[#161B22] border-[#30363D] hover:border-[#484F58]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] shrink-0 text-[#58A6FF]">
                          {getArtifactIcon(def.iconName)}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-[#F0F6FC]">
                            {def.title}
                          </h4>
                          <p className="text-[11px] text-[#8B949E] mt-0.5 line-clamp-1">
                            {def.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#30363D]">
                      {existing ? (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span className="text-[10px] font-medium text-[#3FB950] flex items-center gap-1 font-mono">
                            <Check className="w-3 h-3" />
                            <span>Generated & Grounded</span>
                          </span>
                          <button
                            id={`view-artifact-${def.type}`}
                            onClick={() => setSelectedArtifact(existing)}
                            className="px-2.5 py-1 rounded-md bg-[#238636] hover:bg-[#2EA043] text-white text-[11px] font-medium transition cursor-pointer"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`generate-artifact-${def.type}`}
                          onClick={() => onGenerateArtifact(def.type)}
                          disabled={isGeneratingArtifact}
                          className="w-full py-1.5 px-3 rounded-md bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC] text-xs font-medium transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isGeneratingThis ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 animate-spin text-[#58A6FF]" />
                              <span>Grounding Artifact...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-[#58A6FF]" />
                              <span>Generate Artifact</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 2: NOTES ================= */}
        {activeTab === 'notes' && (
          <div className="space-y-3">
            {/* Note Actions Bar */}
            <div className="flex items-center justify-between gap-2">
              <button
                id="create-note-btn"
                onClick={handleStartNewNote}
                className="flex-1 py-1.5 px-3 rounded-md bg-[#238636] hover:bg-[#2EA043] text-white text-xs font-medium shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Note</span>
              </button>

              {notes.length >= 2 && (
                <button
                  id="merge-notes-btn"
                  onClick={onOpenMergeModal}
                  className="py-1.5 px-3 rounded-md bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  title="Synthesize multiple notes into an Executive Briefing"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#58A6FF]" />
                  <span>Merge into Briefing</span>
                </button>
              )}
            </div>

            {/* Note Editor Modal / Inline Drawer */}
            {isEditingNote && (
              <form
                onSubmit={handleSaveNoteSubmit}
                className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg shadow-md space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F0F6FC]">
                    {editingNoteId ? 'Edit Note' : 'Create Research Note'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(false)}
                    className="text-[#8B949E] hover:text-[#C9D1D9]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <input
                  id="note-title-input"
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title (e.g. Architecture Takeaways)..."
                  className="w-full px-2.5 py-1.5 text-xs font-medium rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  required
                />

                <textarea
                  id="note-content-textarea"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Write note in markdown..."
                  rows={5}
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF] font-mono resize-none"
                  required
                />

                <input
                  id="note-tags-input"
                  type="text"
                  value={noteTags}
                  onChange={(e) => setNoteTags(e.target.value)}
                  placeholder="Tags (comma-separated, e.g. architecture, core, todo)"
                  className="w-full px-2.5 py-1 text-[11px] rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                />

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingNote(false)}
                    className="px-2.5 py-1 text-xs text-[#8B949E] hover:bg-[#21262D] hover:text-[#C9D1D9] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-note-submit-btn"
                    type="submit"
                    className="px-3 py-1 text-xs font-medium bg-[#238636] hover:bg-[#2EA043] text-white rounded-md transition"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            )}

            {/* Search Notes */}
            {notes.length > 0 && (
              <input
                id="search-notes-input"
                type="text"
                value={searchNotes}
                onChange={(e) => setSearchNotes(e.target.value)}
                placeholder="Search notes and tags..."
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              />
            )}

            {/* Notes List */}
            {filteredNotes.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8B949E] border border-dashed border-[#30363D] rounded-lg">
                {notes.length === 0
                  ? 'No notes yet. Save answers from chat or create manual research notes!'
                  : 'No notes match your search.'}
              </div>
            ) : (
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  id={`note-card-${note.id}`}
                  className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg shadow-xs space-y-2 hover:border-[#484F58] transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold text-[#F0F6FC] line-clamp-1">
                      {note.title}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleStartEditNote(note)}
                        className="p-1 text-[#8B949E] hover:text-[#58A6FF] rounded"
                        title="Edit note"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 text-[#8B949E] hover:text-[#F85149] rounded"
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Note Markdown Content Preview */}
                  <div className="prose prose-xs max-w-none text-[#C9D1D9] text-[11px] line-clamp-4 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {note.content}
                    </ReactMarkdown>
                  </div>

                  {/* Citations Attached to Note */}
                  {note.citations && note.citations.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-1">
                      {note.citations.map((c) => (
                        <CitationChip
                          key={c.id}
                          citation={c}
                          onClick={onSelectCitation}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}

                  {/* Tags & Timestamp */}
                  <div className="pt-1.5 border-t border-[#30363D] flex items-center justify-between text-[10px] text-[#8B949E] font-mono">
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded-sm bg-[#21262D] border border-[#30363D] text-[#58A6FF]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 3: PINNED CITATIONS ================= */}
        {activeTab === 'pins' && (
          <div className="space-y-3">
            <div className="text-[11px] text-[#8B949E] leading-tight">
              Pinned code anchors and documentation citations bookmarked from your repository queries.
            </div>

            {pinnedCitations.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#8B949E] border border-dashed border-[#30363D] rounded-lg">
                No pinned citations yet. Click "Pin Citations" under any chat answer to bookmark exact file line ranges here.
              </div>
            ) : (
              pinnedCitations.map((c) => (
                <div
                  key={c.id}
                  id={`pinned-citation-${c.id}`}
                  className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg shadow-xs space-y-2 hover:border-[#484F58] transition"
                >
                  <div className="flex items-center justify-between">
                    <CitationChip citation={c} onClick={onSelectCitation} />
                    <button
                      onClick={() => onUnpinCitation(c.id)}
                      className="p-1 text-[#8B949E] hover:text-[#F85149] rounded"
                      title="Unpin citation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {c.snippet && (
                    <div
                      onClick={() => onSelectCitation(c)}
                      className="p-2 rounded-md bg-[#0D1117] text-[#C9D1D9] font-mono text-[10px] max-h-24 overflow-y-auto cursor-pointer border border-[#30363D] hover:border-[#58A6FF]"
                      title="Click to view file in full context"
                    >
                      <pre className="whitespace-pre-wrap">{c.snippet}</pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ================= ARTIFACT MODAL / FULL VIEWER ================= */}
      {selectedArtifact && (
        <div
          id="artifact-viewer-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-6"
          onClick={() => setSelectedArtifact(null)}
        >
          <div
            className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* If Mindmap artifact */}
            {selectedArtifact.type === 'mindmap' ? (
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute top-2.5 right-3 z-20">
                  <button
                    onClick={() => setSelectedArtifact(null)}
                    className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#30363D] transition cursor-pointer shadow-md"
                    title="Close Mindmap"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <MindmapViewer
                  artifact={selectedArtifact}
                  repoSource={repoSource}
                  onSelectCitation={(cit) => {
                    setSelectedArtifact(null);
                    onSelectCitation(cit);
                  }}
                />
              </div>
            ) : selectedArtifact.type === 'slideshow' ? (
              /* If Slideshow artifact */
              <div className="flex-1 flex flex-col overflow-hidden relative">
                <div className="absolute top-2.5 right-3 z-20">
                  <button
                    onClick={() => setSelectedArtifact(null)}
                    className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#30363D] transition cursor-pointer shadow-md"
                    title="Close Slideshow"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <SlideshowViewer
                  artifact={selectedArtifact}
                  repoSource={repoSource}
                  onSelectCitation={(cit) => {
                    setSelectedArtifact(null);
                    onSelectCitation(cit);
                  }}
                />
              </div>
            ) : (
              /* Standard Artifact Markdown View */
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[#F0F6FC]">
                        {selectedArtifact.title}
                      </h3>
                      <p className="text-[11px] text-[#8B949E] font-mono">
                        Grounded Research Artifact &bull; {repoSource.fullName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      id="artifact-copy-btn"
                      onClick={handleCopyArtifactContent}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] transition cursor-pointer"
                    >
                      {copiedArtifact ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
                      <span>{copiedArtifact ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      id="artifact-save-note-btn"
                      onClick={() => handleSaveArtifactAsNote(selectedArtifact)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] text-white transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Save as Note</span>
                    </button>

                    <button
                      onClick={() => setSelectedArtifact(null)}
                      className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Citations bar */}
                {selectedArtifact.citations && selectedArtifact.citations.length > 0 && (
                  <div className="px-5 py-2 bg-[#0D1117] border-b border-[#30363D] flex items-center gap-2 overflow-x-auto">
                    <span className="text-[11px] font-semibold text-[#58A6FF] shrink-0 font-mono">
                      Grounded Citations:
                    </span>
                    <div className="flex gap-1.5">
                      {selectedArtifact.citations.map((c) => (
                        <CitationChip
                          key={c.id}
                          citation={c}
                          onClick={(cit) => {
                            setSelectedArtifact(null);
                            onSelectCitation(cit);
                          }}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 text-[#C9D1D9] leading-relaxed bg-[#0D1117]">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedArtifact.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
