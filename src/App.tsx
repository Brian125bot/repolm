import React, { useState, useEffect } from 'react';
import {
  Notebook,
  SourceFile,
  Citation,
  AnswerMode,
  ArtifactType,
  ChatMessage,
  Note,
  IngestRepoParams,
  GeminiModelId,
} from './types';
import {
  getSavedNotebooks,
  saveNotebooks,
  loadPersistentNotebooks,
  getActiveNotebookId,
  setActiveNotebookId,
  getSavedGitHubToken,
  ingestRepository,
  askRepoQuestion,
  generateRepoArtifact,
} from './services/api';
import { Navbar } from './components/Navbar';
import { SourcePanel } from './components/SourcePanel';
import { ChatPanel } from './components/ChatPanel';
import { StudioPanel } from './components/StudioPanel';
import { FileViewerModal } from './components/FileViewerModal';
import { NewNotebookModal } from './components/NewNotebookModal';
import { SettingsModal } from './components/SettingsModal';
import { MergeNotesModal } from './components/MergeNotesModal';
import { DocumentationModal } from './components/DocumentationModal';
import { HomeScreen } from './components/HomeScreen';
import {
  PanelLeftOpen,
  PanelRightOpen,
  FolderTree,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(() => getSavedNotebooks());
  const [activeId, setActiveId] = useState<string>(() => getActiveNotebookId());
  const [viewMode, setViewMode] = useState<'workspace' | 'home'>('workspace');
  const [githubToken, setGithubToken] = useState<string>(() => getSavedGitHubToken());

  // Load from persistent disk / IndexedDB on startup
  useEffect(() => {
    async function initStorage() {
      try {
        const persisted = await loadPersistentNotebooks();
        if (persisted && persisted.length > 0) {
          setNotebooks(persisted);
        }
      } catch (err) {
        console.warn('Persistent storage load notice:', err);
      }
    }
    initStorage();
  }, []);

  // Panel collapse states
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  // Modal states
  const [isNewNotebookOpen, setIsNewNotebookOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);

  // File viewer modal state
  const [viewingFile, setViewingFile] = useState<SourceFile | null>(null);
  const [viewingCitation, setViewingCitation] = useState<Citation | null>(null);

  // Interaction states
  const [answerMode, setAnswerMode] = useState<AnswerMode>('detailed');
  const [isQuerying, setIsQuerying] = useState(false);
  const [isGeneratingArtifact, setIsGeneratingArtifact] = useState(false);
  const [generatingArtifactType, setGeneratingArtifactType] = useState<ArtifactType | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Save notebooks to persistent multi-tier storage (IndexedDB + Disk Sync + LocalStorage)
  useEffect(() => {
    saveNotebooks(notebooks);
  }, [notebooks]);

  // Sync active notebook ID
  useEffect(() => {
    setActiveNotebookId(activeId);
  }, [activeId]);

  const activeNotebook = notebooks.find((n) => n.id === activeId) || notebooks[0] || null;

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Switch active notebook
  const handleSelectNotebook = (id: string) => {
    setActiveId(id);
    setViewMode('workspace');
  };

  // Open file viewer from citation or tree
  const handleSelectFile = (file: SourceFile) => {
    setViewingFile(file);
    setViewingCitation(null);
  };

  const handleSelectCitation = (citation: Citation) => {
    if (!activeNotebook) return;
    const file = activeNotebook.files.find((f) => f.path === citation.filePath);
    if (file) {
      setViewingFile(file);
      setViewingCitation(citation);
    } else {
      // Fallback synthetic file if path not directly matched
      setViewingFile({
        id: `synth-${citation.filePath}`,
        path: citation.filePath,
        language: 'Text',
        fileCategory: citation.fileCategory || 'code',
        size: citation.snippet?.length || 0,
        lineCount: citation.endLine,
        content: citation.snippet || `// Content for ${citation.filePath}\n// Lines ${citation.startLine}-${citation.endLine}`,
      });
      setViewingCitation(citation);
    }
  };

  // Send message in chat
  const handleSendMessage = async (question: string, model?: GeminiModelId) => {
    if (!activeNotebook || isQuerying) return;

    const userMessage: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
    };

    // Optimistically add user message
    const updatedMessages = [...activeNotebook.messages, userMessage];
    const updatedNotebook = {
      ...activeNotebook,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    };

    setNotebooks((prev) => prev.map((n) => (n.id === activeNotebook.id ? updatedNotebook : n)));
    setIsQuerying(true);

    try {
      const response = await askRepoQuestion({
        question,
        notebook: updatedNotebook,
        answerMode,
        model,
      });

      const assistantMessage: ChatMessage = {
        id: `msg-asst-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        citations: response.citations,
        suggestedFollowUps: response.suggestedFollowUps,
        createdAt: new Date().toISOString(),
        answerMode,
        confidence: response.confidence,
        modelUsed: response.modelUsed || model || 'gemini-3.7-flash',
      };

      const finalNotebook = {
        ...updatedNotebook,
        messages: [...updatedMessages, assistantMessage],
        updatedAt: new Date().toISOString(),
      };

      setNotebooks((prev) => prev.map((n) => (n.id === activeNotebook.id ? finalNotebook : n)));
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        content: `❌ Query failed: ${err.message || 'An unexpected error occurred while querying the repository index.'}`,
        citations: [],
        createdAt: new Date().toISOString(),
        confidence: 'not_found',
      };

      setNotebooks((prev) =>
        prev.map((n) =>
          n.id === activeNotebook.id
            ? { ...n, messages: [...updatedMessages, errorMessage] }
            : n
        )
      );
    } finally {
      setIsQuerying(false);
    }
  };

  // Generate research artifact
  const handleGenerateArtifact = async (type: ArtifactType) => {
    if (!activeNotebook || isGeneratingArtifact) return;

    setIsGeneratingArtifact(true);
    setGeneratingArtifactType(type);

    try {
      const artifact = await generateRepoArtifact({
        artifactType: type,
        notebook: activeNotebook,
      });

      const updatedArtifacts = [
        ...activeNotebook.artifacts.filter((a) => a.type !== type),
        artifact,
      ];

      const updatedNotebook = {
        ...activeNotebook,
        artifacts: updatedArtifacts,
        updatedAt: new Date().toISOString(),
      };

      setNotebooks((prev) => prev.map((n) => (n.id === activeNotebook.id ? updatedNotebook : n)));
      showNotification(`Artifact "${artifact.title}" generated with repo citations!`);
    } catch (err: any) {
      alert(`Artifact generation failed: ${err.message}`);
    } finally {
      setIsGeneratingArtifact(false);
      setGeneratingArtifactType(null);
    }
  };

  // Save/Edit note
  const handleSaveNote = (partialNote: Partial<Note>) => {
    if (!activeNotebook) return;

    const existingIndex = activeNotebook.notes.findIndex((n) => n.id === partialNote.id);
    let updatedNotes: Note[];

    if (existingIndex >= 0) {
      const existing = activeNotebook.notes[existingIndex];
      const updated: Note = {
        ...existing,
        ...partialNote,
        updatedAt: new Date().toISOString(),
      } as Note;
      updatedNotes = [...activeNotebook.notes];
      updatedNotes[existingIndex] = updated;
    } else {
      const newNote: Note = {
        id: partialNote.id || `note-${Date.now()}`,
        notebookId: activeNotebook.id,
        title: partialNote.title || 'Untitled Note',
        content: partialNote.content || '',
        tags: partialNote.tags || ['general'],
        citations: partialNote.citations || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedNotes = [newNote, ...activeNotebook.notes];
    }

    setNotebooks((prev) =>
      prev.map((n) =>
        n.id === activeNotebook.id ? { ...n, notes: updatedNotes, updatedAt: new Date().toISOString() } : n
      )
    );
    showNotification('Note saved to notebook studio!');
  };

  // Save chat response as note
  const handleSaveMessageAsNote = (msg: ChatMessage) => {
    if (!activeNotebook) return;

    const titleMatch = msg.content.match(/^#+\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Findings on ${activeNotebook.source.name}`;

    handleSaveNote({
      id: `note-from-msg-${msg.id}`,
      notebookId: activeNotebook.id,
      title: title.slice(0, 60),
      content: msg.content,
      tags: ['chat-finding', 'grounded'],
      citations: msg.citations,
      sourceMessageId: msg.id,
    });
  };

  // Delete note
  const handleDeleteNote = (noteId: string) => {
    if (!activeNotebook) return;
    const updatedNotes = activeNotebook.notes.filter((n) => n.id !== noteId);
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? { ...n, notes: updatedNotes } : n))
    );
    showNotification('Note deleted.');
  };

  // Pin citation
  const handlePinCitation = (citation: Citation) => {
    if (!activeNotebook) return;
    const alreadyPinned = activeNotebook.pinnedCitations.some((c) => c.id === citation.id);
    if (alreadyPinned) return;

    const updatedPins = [citation, ...activeNotebook.pinnedCitations];
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? { ...n, pinnedCitations: updatedPins } : n))
    );
    showNotification(`Pinned ${citation.filePath}:${citation.startLine}`);
  };

  // Unpin citation
  const handleUnpinCitation = (citationId: string) => {
    if (!activeNotebook) return;
    const updatedPins = activeNotebook.pinnedCitations.filter((c) => c.id !== citationId);
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? { ...n, pinnedCitations: updatedPins } : n))
    );
  };

  // Ingest a new repository (GitHub, Local Directory, or Browser Upload)
  const handleIngestRepo = async (params: IngestRepoParams) => {
    setIsIngesting(true);
    try {
      const result = await ingestRepository(params);
      setNotebooks((prev) => [result.notebook, ...prev.filter((n) => n.id !== result.notebook.id)]);
      setActiveId(result.notebook.id);
      setViewMode('workspace');
      setIsNewNotebookOpen(false);

      if (result.rateLimitNotice) {
        showNotification(result.rateLimitNotice);
      } else {
        showNotification(`Workspace ${result.notebook.source.fullName} indexed & persisted successfully!`);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setIsIngesting(false);
    }
  };

  // Re-index active repo or local folder
  const handleReindex = async () => {
    if (!activeNotebook || isReindexing) return;
    setIsReindexing(true);
    try {
      const result = await ingestRepository({
        isLocal: activeNotebook.source.isLocal,
        localPath: activeNotebook.source.localPath,
        repoUrl: activeNotebook.source.repoUrl,
        ref: activeNotebook.source.selectedRef,
        pathFilter: activeNotebook.pathFilter,
      });

      // Preserve existing user notes and chat messages while updating files/chunks
      const refreshedNotebook: Notebook = {
        ...result.notebook,
        id: activeNotebook.id,
        messages: activeNotebook.messages,
        notes: activeNotebook.notes,
        artifacts: activeNotebook.artifacts,
        pinnedCitations: activeNotebook.pinnedCitations,
      };

      setNotebooks((prev) => prev.map((n) => (n.id === activeNotebook.id ? refreshedNotebook : n)));
      showNotification('Codebase re-indexed successfully!');
    } catch (err: any) {
      alert(`Re-index failed: ${err.message}`);
    } finally {
      setIsReindexing(false);
    }
  };

  // Delete notebook
  const handleDeleteNotebook = (id: string) => {
    const remaining = notebooks.filter((n) => n.id !== id);
    if (remaining.length === 0) return;
    setNotebooks(remaining);
    if (activeId === id) {
      setActiveId(remaining[0].id);
    }
    showNotification('Notebook removed.');
  };

  // Clear center panel chat history for active repository
  const handleClearChat = () => {
    if (!activeNotebook) return;
    const clearedNotebook: Notebook = {
      ...activeNotebook,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? clearedNotebook : n))
    );
    showNotification(`Chat history cleared for ${activeNotebook.source.name}.`);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0D1117] text-[#C9D1D9] font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        notebooks={notebooks}
        activeNotebook={activeNotebook}
        onSelectNotebook={handleSelectNotebook}
        onNewNotebook={() => setIsNewNotebookOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDocs={() => setIsDocsOpen(true)}
        hasCustomToken={Boolean(githubToken)}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 bg-[#161B22] text-[#F0F6FC] text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl border border-[#30363D] animate-in fade-in slide-in-from-top-2 flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-[#58A6FF]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Workspace Body */}
      {viewMode === 'home' || !activeNotebook ? (
        <HomeScreen
          notebooks={notebooks}
          onSelectNotebook={handleSelectNotebook}
          onOpenNewNotebookModal={() => setIsNewNotebookOpen(true)}
          onIngestRepo={handleIngestRepo}
          onDeleteNotebook={handleDeleteNotebook}
          isLoading={isIngesting}
        />
      ) : (
        <div className="flex-1 flex overflow-hidden bg-[#0D1117]">
          {/* 1. Left Panel: Repository Source & Files (Collapsible) */}
          {isLeftPanelOpen ? (
            <div className="w-72 lg:w-80 shrink-0 h-full border-r border-[#30363D] transition-all duration-200">
              <SourcePanel
                source={activeNotebook.source}
                files={activeNotebook.files}
                onSelectFile={handleSelectFile}
                onReindex={handleReindex}
                isReindexing={isReindexing}
                onToggleCollapse={() => setIsLeftPanelOpen(false)}
              />
            </div>
          ) : (
            <div className="w-11 shrink-0 h-full bg-[#161B22] border-r border-[#30363D] flex flex-col items-center py-3 justify-between select-none transition-all duration-200">
              <div className="flex flex-col items-center gap-3">
                <button
                  id="expand-left-panel-btn"
                  onClick={() => setIsLeftPanelOpen(true)}
                  className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#58A6FF] hover:border-[#58A6FF]/50 transition cursor-pointer"
                  title="Expand Sources Sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsLeftPanelOpen(true)}
                  className="text-[11px] font-mono text-[#8B949E] [writing-mode:vertical-rl] rotate-180 flex items-center gap-2 py-3 cursor-pointer hover:text-[#C9D1D9] transition"
                  title="Click to expand sources"
                >
                  <FolderTree className="w-3.5 h-3.5 rotate-90 text-[#58A6FF]" />
                  <span className="font-semibold">{activeNotebook.source.name}</span>
                  <span className="bg-[#21262D] px-1.5 py-0.5 rounded text-[10px] text-[#8B949E] border border-[#30363D]">
                    {activeNotebook.files.length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Center Panel: Grounded Chat Workspace (flexible width) */}
          <div className="flex-1 h-full min-w-0 bg-[#0D1117]">
            <ChatPanel
              messages={activeNotebook.messages}
              repoSource={activeNotebook.source}
              answerMode={answerMode}
              onAnswerModeChange={setAnswerMode}
              onSendMessage={handleSendMessage}
              isLoading={isQuerying}
              onSelectCitation={handleSelectCitation}
              onSaveAsNote={handleSaveMessageAsNote}
              onPinCitation={handlePinCitation}
              suggestedQuestions={activeNotebook.suggestedQuestions}
              onClearChat={handleClearChat}
              isLeftPanelOpen={isLeftPanelOpen}
              isRightPanelOpen={isRightPanelOpen}
              onToggleLeftPanel={() => setIsLeftPanelOpen((prev) => !prev)}
              onToggleRightPanel={() => setIsRightPanelOpen((prev) => !prev)}
            />
          </div>

          {/* 3. Right Panel: Studio, Artifacts & Notes (Collapsible) */}
          {isRightPanelOpen ? (
            <div className="w-80 xl:w-96 shrink-0 h-full border-l border-[#30363D] transition-all duration-200">
              <StudioPanel
                notebookId={activeNotebook.id}
                repoSource={activeNotebook.source}
                artifacts={activeNotebook.artifacts}
                notes={activeNotebook.notes}
                pinnedCitations={activeNotebook.pinnedCitations}
                onGenerateArtifact={handleGenerateArtifact}
                isGeneratingArtifact={isGeneratingArtifact}
                generatingType={generatingArtifactType}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                onSelectCitation={handleSelectCitation}
                onUnpinCitation={handleUnpinCitation}
                onOpenMergeModal={() => setIsMergeModalOpen(true)}
                onToggleCollapse={() => setIsRightPanelOpen(false)}
              />
            </div>
          ) : (
            <div className="w-11 shrink-0 h-full bg-[#161B22] border-l border-[#30363D] flex flex-col items-center py-3 justify-between select-none transition-all duration-200">
              <div className="flex flex-col items-center gap-3">
                <button
                  id="expand-right-panel-btn"
                  onClick={() => setIsRightPanelOpen(true)}
                  className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-[#58A6FF] hover:border-[#58A6FF]/50 transition cursor-pointer"
                  title="Expand Research Studio"
                >
                  <PanelRightOpen className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsRightPanelOpen(true)}
                  className="text-[11px] font-mono text-[#8B949E] [writing-mode:vertical-rl] rotate-180 flex items-center gap-2 py-3 cursor-pointer hover:text-[#C9D1D9] transition"
                  title="Click to expand studio"
                >
                  <Sparkles className="w-3.5 h-3.5 rotate-90 text-[#58A6FF]" />
                  <span className="font-semibold">Studio</span>
                  <span className="bg-[#21262D] px-1.5 py-0.5 rounded text-[10px] text-[#8B949E] border border-[#30363D]">
                    {activeNotebook.artifacts.length + activeNotebook.notes.length}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {viewingFile && activeNotebook && (
        <FileViewerModal
          file={viewingFile}
          citation={viewingCitation}
          repoSource={activeNotebook.source}
          onClose={() => {
            setViewingFile(null);
            setViewingCitation(null);
          }}
        />
      )}

      <NewNotebookModal
        isOpen={isNewNotebookOpen}
        onClose={() => setIsNewNotebookOpen(false)}
        onIngest={handleIngestRepo}
        isLoading={isIngesting}
        savedToken={githubToken}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        savedToken={githubToken}
        onTokenUpdated={(token) => setGithubToken(token)}
        notebooks={notebooks}
        onNotebooksUpdated={(updated) => setNotebooks(updated)}
      />

      {activeNotebook && (
        <MergeNotesModal
          isOpen={isMergeModalOpen}
          onClose={() => setIsMergeModalOpen(false)}
          notebook={activeNotebook}
          onSaveMergedNote={(title, content) => {
            handleSaveNote({
              title,
              content,
              tags: ['executive-briefing', 'synthesis'],
            });
          }}
        />
      )}

      <DocumentationModal
        isOpen={isDocsOpen}
        onClose={() => setIsDocsOpen(false)}
      />
    </div>
  );
}
