import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Artifact,
} from './types';
import {
  getSavedGitHubToken,
  ingestRepository,
  askRepoQuestion,
  generateRepoArtifact,
} from './services/api';
import { getSampleZustandNotebook } from './sampleRepos';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import {
  subscribeToUserNotebooks,
  subscribeToUserNotes,
  subscribeToUserArtifacts,
  subscribeToNotebookMessages,
  saveNotebookToFirestore,
  deleteNotebookFromFirestore,
  saveNoteToFirestore,
  deleteNoteFromFirestore,
  saveArtifactToFirestore,
  deleteArtifactFromFirestore,
  saveChatMessageToFirestore,
} from './services/firebaseDb';
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
  Loader2,
  BookOpen,
} from 'lucide-react';

function AppContent() {
  const { user, loading: authLoading } = useAuth();

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'workspace' | 'home'>('workspace');
  const [githubToken, setGithubToken] = useState<string>(() => getSavedGitHubToken());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

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

  const seededRef = useRef(false);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // 1. Subscribe to User's Notebooks in Firestore
  useEffect(() => {
    if (!user) {
      setNotebooks([]);
      setIsInitialLoad(false);
      return;
    }

    const unsubscribe = subscribeToUserNotebooks(
      user.uid,
      async (cloudNotebooks) => {
        if (cloudNotebooks.length === 0 && !seededRef.current) {
          seededRef.current = true;
          // Seed initial starter notebook in Firestore for this user
          const sample = getSampleZustandNotebook();
          try {
            await saveNotebookToFirestore(user.uid, sample);
            // Also seed sample notes and artifacts
            for (const note of sample.notes) {
              await saveNoteToFirestore(user.uid, note);
            }
            for (const art of sample.artifacts) {
              await saveArtifactToFirestore(user.uid, art);
            }
            for (const msg of sample.messages) {
              await saveChatMessageToFirestore(user.uid, sample.id, msg);
            }
          } catch (e) {
            console.error('Failed to seed starter notebook', e);
          }
        } else {
          setNotebooks(cloudNotebooks);
          setActiveId((prev) => {
            if (prev && cloudNotebooks.some((n) => n.id === prev)) return prev;
            return cloudNotebooks[0]?.id || '';
          });
        }
        setIsInitialLoad(false);
      },
      (err) => {
        console.error('Notebook subscription error', err);
        setIsInitialLoad(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Subscribe to Notes for Active Notebook
  useEffect(() => {
    if (!user || !activeId) return;

    const unsubscribe = subscribeToUserNotes(user.uid, activeId, (cloudNotes) => {
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === activeId ? { ...nb, notes: cloudNotes } : nb))
      );
    });

    return () => unsubscribe();
  }, [user, activeId]);

  // 3. Subscribe to Artifacts for Active Notebook
  useEffect(() => {
    if (!user || !activeId) return;

    const unsubscribe = subscribeToUserArtifacts(user.uid, activeId, (cloudArtifacts) => {
      setNotebooks((prev) =>
        prev.map((nb) => (nb.id === activeId ? { ...nb, artifacts: cloudArtifacts } : nb))
      );
    });

    return () => unsubscribe();
  }, [user, activeId]);

  // 4. Subscribe to Messages for Active Notebook
  useEffect(() => {
    if (!user || !activeId) return;

    const unsubscribe = subscribeToNotebookMessages(user.uid, activeId, (cloudMessages) => {
      if (cloudMessages.length > 0) {
        setNotebooks((prev) =>
          prev.map((nb) => (nb.id === activeId ? { ...nb, messages: cloudMessages } : nb))
        );
      }
    });

    return () => unsubscribe();
  }, [user, activeId]);

  const activeNotebook = notebooks.find((n) => n.id === activeId) || notebooks[0] || null;

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

  // Send message in chat with Firestore sync
  const handleSendMessage = async (question: string, model?: GeminiModelId) => {
    if (!activeNotebook || isQuerying || !user) return;

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
    setIsSyncing(true);

    try {
      // Persist user message to Firestore
      await saveChatMessageToFirestore(user.uid, activeNotebook.id, userMessage);

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

      // Persist assistant response to Firestore
      await saveChatMessageToFirestore(user.uid, activeNotebook.id, assistantMessage);
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
      setIsSyncing(false);
    }
  };

  // Generate research artifact with Firestore sync
  const handleGenerateArtifact = async (type: ArtifactType) => {
    if (!activeNotebook || isGeneratingArtifact || !user) return;

    setIsGeneratingArtifact(true);
    setGeneratingArtifactType(type);
    setIsSyncing(true);

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

      // Persist artifact to Firestore
      await saveArtifactToFirestore(user.uid, artifact);
      showNotification(`Artifact "${artifact.title}" saved to your cloud account!`);
    } catch (err: any) {
      alert(`Artifact generation failed: ${err.message}`);
    } finally {
      setIsGeneratingArtifact(false);
      setGeneratingArtifactType(null);
      setIsSyncing(false);
    }
  };

  // Save/Edit note with Firestore sync
  const handleSaveNote = async (partialNote: Partial<Note>) => {
    if (!activeNotebook || !user) return;

    setIsSyncing(true);
    const existingIndex = activeNotebook.notes.findIndex((n) => n.id === partialNote.id);
    let noteToSave: Note;

    if (existingIndex >= 0) {
      const existing = activeNotebook.notes[existingIndex];
      noteToSave = {
        ...existing,
        ...partialNote,
        updatedAt: new Date().toISOString(),
      } as Note;
    } else {
      noteToSave = {
        id: partialNote.id || `note-${Date.now()}`,
        notebookId: activeNotebook.id,
        title: partialNote.title || 'Untitled Note',
        content: partialNote.content || '',
        tags: partialNote.tags || ['general'],
        citations: partialNote.citations || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Optimistic update
    setNotebooks((prev) =>
      prev.map((n) => {
        if (n.id !== activeNotebook.id) return n;
        const exists = n.notes.some((item) => item.id === noteToSave.id);
        const newNotes = exists
          ? n.notes.map((item) => (item.id === noteToSave.id ? noteToSave : item))
          : [noteToSave, ...n.notes];
        return { ...n, notes: newNotes, updatedAt: new Date().toISOString() };
      })
    );

    try {
      await saveNoteToFirestore(user.uid, noteToSave);
      showNotification('Note synced to cloud account!');
    } catch (err) {
      console.error('Failed to save note to Firestore', err);
    } finally {
      setIsSyncing(false);
    }
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

  // Delete note from Firestore & state
  const handleDeleteNote = async (noteId: string) => {
    if (!activeNotebook || !user) return;
    setIsSyncing(true);
    const updatedNotes = activeNotebook.notes.filter((n) => n.id !== noteId);
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? { ...n, notes: updatedNotes } : n))
    );

    try {
      await deleteNoteFromFirestore(user.uid, noteId);
      showNotification('Note deleted from cloud account.');
    } catch (err) {
      console.error('Failed to delete note from Firestore', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Pin citation
  const handlePinCitation = async (citation: Citation) => {
    if (!activeNotebook || !user) return;
    const alreadyPinned = activeNotebook.pinnedCitations.some((c) => c.id === citation.id);
    if (alreadyPinned) return;

    const updatedPins = [citation, ...activeNotebook.pinnedCitations];
    const updatedNotebook = { ...activeNotebook, pinnedCitations: updatedPins };
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? updatedNotebook : n))
    );
    showNotification(`Pinned ${citation.filePath}:${citation.startLine}`);

    try {
      await saveNotebookToFirestore(user.uid, updatedNotebook);
    } catch (e) {
      console.error('Failed to save pinned citation', e);
    }
  };

  // Unpin citation
  const handleUnpinCitation = async (citationId: string) => {
    if (!activeNotebook || !user) return;
    const updatedPins = activeNotebook.pinnedCitations.filter((c) => c.id !== citationId);
    const updatedNotebook = { ...activeNotebook, pinnedCitations: updatedPins };
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? updatedNotebook : n))
    );

    try {
      await saveNotebookToFirestore(user.uid, updatedNotebook);
    } catch (e) {
      console.error('Failed to update unpin citation', e);
    }
  };

  // Ingest a new repository & save to Firestore
  const handleIngestRepo = async (params: IngestRepoParams) => {
    if (!user) return;
    setIsIngesting(true);
    setIsSyncing(true);
    try {
      const result = await ingestRepository(params);
      setNotebooks((prev) => [result.notebook, ...prev]);
      setActiveId(result.notebook.id);
      setViewMode('workspace');
      setIsNewNotebookOpen(false);

      // Save new notebook to Firestore
      await saveNotebookToFirestore(user.uid, result.notebook);
      for (const msg of result.notebook.messages) {
        await saveChatMessageToFirestore(user.uid, result.notebook.id, msg);
      }

      if (result.rateLimitNotice) {
        showNotification(result.rateLimitNotice);
      } else {
        showNotification(`Repository ${result.notebook.source.fullName} indexed & saved to cloud!`);
      }
    } catch (err: any) {
      throw err;
    } finally {
      setIsIngesting(false);
      setIsSyncing(false);
    }
  };

  // Re-index active repo & sync to Firestore
  const handleReindex = async () => {
    if (!activeNotebook || isReindexing || !user) return;
    setIsReindexing(true);
    setIsSyncing(true);
    try {
      const result = await ingestRepository({
        repoUrl: activeNotebook.source.repoUrl,
        ref: activeNotebook.source.selectedRef,
        pathFilter: activeNotebook.pathFilter,
      });

      const refreshedNotebook: Notebook = {
        ...result.notebook,
        id: activeNotebook.id,
        messages: activeNotebook.messages,
        notes: activeNotebook.notes,
        artifacts: activeNotebook.artifacts,
        pinnedCitations: activeNotebook.pinnedCitations,
      };

      setNotebooks((prev) => prev.map((n) => (n.id === activeNotebook.id ? refreshedNotebook : n)));
      await saveNotebookToFirestore(user.uid, refreshedNotebook);
      showNotification('Repository re-indexed and synchronized!');
    } catch (err: any) {
      alert(`Re-index failed: ${err.message}`);
    } finally {
      setIsReindexing(false);
      setIsSyncing(false);
    }
  };

  // Delete notebook from Firestore & state
  const handleDeleteNotebook = async (id: string) => {
    if (!user) return;
    const remaining = notebooks.filter((n) => n.id !== id);
    if (remaining.length === 0) return;

    setNotebooks(remaining);
    if (activeId === id) {
      setActiveId(remaining[0].id);
    }
    showNotification('Notebook removed from cloud.');

    try {
      await deleteNotebookFromFirestore(user.uid, id);
    } catch (err) {
      console.error('Failed to delete notebook from Firestore', err);
    }
  };

  // Clear center panel chat history for active repository
  const handleClearChat = async () => {
    if (!activeNotebook || !user) return;
    const clearedNotebook: Notebook = {
      ...activeNotebook,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setNotebooks((prev) =>
      prev.map((n) => (n.id === activeNotebook.id ? clearedNotebook : n))
    );
    showNotification(`Chat history cleared for ${activeNotebook.source.name}.`);

    try {
      await saveNotebookToFirestore(user.uid, clearedNotebook);
    } catch (e) {
      console.error('Failed to save cleared chat', e);
    }
  };

  // Loading state while checking auth
  if (authLoading || (user && isInitialLoad)) {
    return (
      <div className="h-screen w-screen bg-[#0D1117] flex flex-col items-center justify-center text-[#C9D1D9] gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-xl animate-pulse">
          <BookOpen className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-sm text-[#8B949E]">
          <Loader2 className="w-4 h-4 animate-spin text-[#58A6FF]" />
          <span>Connecting to your cloud workspace...</span>
        </div>
      </div>
    );
  }

  // Auth gate: If not authenticated, require login
  if (!user) {
    return <AuthScreen />;
  }

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
        isSyncing={isSyncing}
      />

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-16 right-6 z-50 bg-[#161B22] text-[#F0F6FC] text-xs font-medium px-4 py-2.5 rounded-lg shadow-xl border border-[#30363D] animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

