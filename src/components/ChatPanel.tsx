import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ChatMessage,
  Citation,
  AnswerMode,
  RepoSource,
  GeminiModelId,
  AVAILABLE_MODELS,
} from '../types';
import { CitationChip } from './CitationChip';
import {
  Send,
  Sparkles,
  BookmarkPlus,
  Copy,
  Check,
  Pin,
  HelpCircle,
  Code,
  Layers,
  GraduationCap,
  AlignLeft,
  FileText,
  AlertCircle,
  RefreshCw,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  X,
  Bot,
  Terminal,
  Cpu,
  ChevronDown,
  Zap,
} from 'lucide-react';

interface ChatPanelProps {
  messages: ChatMessage[];
  repoSource: RepoSource;
  answerMode: AnswerMode;
  onAnswerModeChange: (mode: AnswerMode) => void;
  onSendMessage: (question: string, model?: GeminiModelId) => void;
  isLoading: boolean;
  onSelectCitation: (citation: Citation) => void;
  onSaveAsNote: (message: ChatMessage) => void;
  onPinCitation: (citation: Citation) => void;
  suggestedQuestions: string[];
  onClearChat?: () => void;
  isLeftPanelOpen?: boolean;
  isRightPanelOpen?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  repoSource,
  answerMode,
  onAnswerModeChange,
  onSendMessage,
  isLoading,
  onSelectCitation,
  onSaveAsNote,
  onPinCitation,
  suggestedQuestions,
  onClearChat,
  isLeftPanelOpen = true,
  isRightPanelOpen = true,
  onToggleLeftPanel,
  onToggleRightPanel,
}) => {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>('gemini-3.7-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModelOption = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    const q = input.trim();
    setInput('');
    onSendMessage(q, selectedModel);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    let text = msg.content;
    if (msg.citations && msg.citations.length > 0) {
      text += '\n\nCitations:\n' + msg.citations.map((c) => `- ${c.filePath}:L${c.startLine}-L${c.endLine}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveNoteClick = (msg: ChatMessage) => {
    onSaveAsNote(msg);
    setSavedNoteId(msg.id);
    setTimeout(() => setSavedNoteId(null), 2000);
  };

  const handleConfirmClear = () => {
    if (onClearChat) {
      onClearChat();
    }
    setShowClearConfirm(false);
  };

  const answerModes: Array<{ id: AnswerMode; label: string; icon: React.ReactNode }> = [
    { id: 'detailed', label: 'Detailed', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'concise', label: 'Concise', icon: <AlignLeft className="w-3.5 h-3.5" /> },
    { id: 'code', label: 'Code Focus', icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'architecture', label: 'Architecture', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'beginner', label: 'Beginner', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  ];

  const getModelBadgeColor = (modelId?: GeminiModelId) => {
    switch (modelId) {
      case 'gemini-3.7-flash':
        return 'bg-[#A371F7]/15 border-[#A371F7]/40 text-[#D2A8FF]';
      case 'gemini-3.5-flash-lite':
        return 'bg-[#58A6FF]/15 border-[#58A6FF]/40 text-[#58A6FF]';
      case 'gemini-3.1-flash-lite':
        return 'bg-[#3FB950]/15 border-[#3FB950]/40 text-[#3FB950]';
      default:
        return 'bg-[#58A6FF]/15 border-[#58A6FF]/40 text-[#58A6FF]';
    }
  };

  const getModelDisplayName = (modelId?: GeminiModelId) => {
    switch (modelId) {
      case 'gemini-3.7-flash':
        return '3.7 Flash';
      case 'gemini-3.5-flash-lite':
        return '3.5 Flash Lite';
      case 'gemini-3.1-flash-lite':
        return '3.1 Flash Lite';
      default:
        return '3.7 Flash';
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#0D1117] text-[#C9D1D9] overflow-hidden relative">
      {/* 1. Top Control Bar: Side Panel Toggles, Model Selector, Answer Mode & Clear Chat */}
      <div className="px-3 sm:px-4 py-2 border-b border-[#30363D] bg-[#161B22] flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left Side: Left Panel Toggle, Model Dropdown & Answer Mode Tabs */}
        <div className="flex items-center flex-wrap gap-2">
          {onToggleLeftPanel && (
            <button
              id="toggle-left-panel-btn"
              onClick={onToggleLeftPanel}
              className={`p-1.5 rounded-md border transition cursor-pointer flex items-center gap-1 text-xs ${
                isLeftPanelOpen
                  ? 'bg-[#21262D] border-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D]'
                  : 'bg-[#58A6FF]/15 border-[#58A6FF]/50 text-[#58A6FF] hover:bg-[#58A6FF]/25'
              }`}
              title={isLeftPanelOpen ? 'Collapse Sources sidebar' : 'Expand Sources sidebar'}
            >
              {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          )}

          {/* Model Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="chat-model-selector-btn"
              type="button"
              onClick={() => setIsModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0D1117] border border-[#30363D] hover:border-[#58A6FF]/60 text-xs font-medium text-[#F0F6FC] transition cursor-pointer shadow-xs"
              title="Select Gemini Model"
            >
              <Cpu className="w-3.5 h-3.5 text-[#A371F7]" />
              <span className="font-semibold">{activeModelOption.name}</span>
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.2 rounded bg-[#21262D] border border-[#30363D] text-[#8B949E]">
                {activeModelOption.badge}
              </span>
              <ChevronDown className={`w-3 h-3 text-[#8B949E] transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isModelDropdownOpen && (
              <div
                id="model-selector-menu"
                className="absolute left-0 top-9 z-50 w-72 p-2 bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl space-y-1.5 animate-in fade-in"
              >
                <div className="px-2 py-1 text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider flex items-center justify-between border-b border-[#30363D]/60 pb-1.5">
                  <span>Gemini Model Architecture</span>
                  <span className="text-[#3FB950] font-mono font-normal">Active</span>
                </div>

                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = model.id === selectedModel;
                  return (
                    <button
                      key={model.id}
                      id={`select-model-${model.id}`}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg transition cursor-pointer flex flex-col gap-1 border ${
                        isSelected
                          ? 'bg-[#21262D] border-[#58A6FF]/60 shadow-xs'
                          : 'border-transparent hover:bg-[#21262D]/60 hover:border-[#30363D]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Zap className={`w-3.5 h-3.5 ${model.id === 'gemini-3.7-flash' ? 'text-[#D2A8FF]' : model.id === 'gemini-3.5-flash-lite' ? 'text-[#58A6FF]' : 'text-[#3FB950]'}`} />
                          <span className="text-xs font-semibold text-[#F0F6FC]">{model.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${getModelBadgeColor(model.id)}`}>
                            {model.tag}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#58A6FF]" />}
                        </div>
                      </div>
                      <p className="text-[11px] text-[#8B949E] leading-tight">
                        {model.description}
                      </p>
                      <div className="text-[10px] text-[#8B949E]/80 font-mono pt-0.5">
                        ⚡ Speed: <strong className="text-[#C9D1D9]">{model.speed}</strong>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Answer Mode Tabs */}
          <div className="flex items-center gap-1 bg-[#0D1117] p-0.5 rounded-md border border-[#30363D]">
            {answerModes.map((m) => (
              <button
                key={m.id}
                id={`answer-mode-${m.id}`}
                onClick={() => onAnswerModeChange(m.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  answerMode === m.id
                    ? 'bg-[#21262D] text-[#58A6FF] shadow-xs font-semibold border border-[#30363D]'
                    : 'text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#161B22]'
                }`}
              >
                {m.icon}
                <span className="hidden xl:inline">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Grounding Status, Clear Chat & Right Panel Toggle */}
        <div className="flex items-center gap-2">
          <div className="hidden 2xl:flex items-center gap-1.5 text-[11px] text-[#8B949E] font-mono mr-1">
            <span className="w-2 h-2 rounded-full bg-[#3FB950] animate-pulse" />
            <span>Grounded in {repoSource.name}</span>
          </div>

          {/* Clear Chat Button */}
          {onClearChat && (
            <div className="relative">
              <button
                id="clear-chat-history-btn"
                onClick={() => setShowClearConfirm(true)}
                disabled={messages.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#DA3633]/20 hover:border-[#DA3633]/50 hover:text-[#F85149] disabled:opacity-40 disabled:hover:bg-[#21262D] disabled:hover:text-[#8B949E] disabled:hover:border-[#30363D] text-xs font-medium text-[#8B949E] transition cursor-pointer disabled:cursor-not-allowed"
                title="Clear center panel chat history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>

              {/* Confirmation Popover */}
              {showClearConfirm && (
                <div
                  id="clear-chat-confirm-popover"
                  className="absolute right-0 top-9 z-50 w-64 p-3 bg-[#161B22] border border-[#30363D] rounded-lg shadow-2xl space-y-2.5 animate-in fade-in"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold text-[#F0F6FC]">
                      Clear chat history?
                    </span>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="text-[#8B949E] hover:text-[#F0F6FC] p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#8B949E] leading-tight">
                    This will clear all conversation messages for <strong className="text-[#C9D1D9]">{repoSource.name}</strong>. Notes and artifacts will remain preserved.
                  </p>
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="px-2.5 py-1 text-[11px] rounded bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC] transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      id="confirm-clear-chat-btn"
                      onClick={handleConfirmClear}
                      className="px-2.5 py-1 text-[11px] font-medium rounded bg-[#DA3633] hover:bg-[#B62324] text-white transition cursor-pointer"
                    >
                      Clear History
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right Panel Toggle */}
          {onToggleRightPanel && (
            <button
              id="toggle-right-panel-btn"
              onClick={onToggleRightPanel}
              className={`p-1.5 rounded-md border transition cursor-pointer flex items-center gap-1 text-xs ${
                isRightPanelOpen
                  ? 'bg-[#21262D] border-[#30363D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D]'
                  : 'bg-[#58A6FF]/15 border-[#58A6FF]/50 text-[#58A6FF] hover:bg-[#58A6FF]/25'
              }`}
              title={isRightPanelOpen ? 'Collapse Studio sidebar' : 'Expand Studio sidebar'}
            >
              {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-[#0D1117]">
        {messages.length === 0 ? (
          /* Empty State when chat history is cleared or empty */
          <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto space-y-4 animate-in fade-in">
            <div className="w-12 h-12 rounded-xl bg-[#161B22] border border-[#30363D] text-[#58A6FF] flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#F0F6FC]">
                Grounded Chat for {repoSource.name}
              </h3>
              <p className="text-xs text-[#8B949E] leading-relaxed">
                Ask questions about code architecture, implementation details, dependencies, or bug risks. Model in use: <strong className="text-[#F0F6FC]">{activeModelOption.name}</strong>.
              </p>
            </div>

            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="w-full space-y-2 pt-2 text-left">
                <div className="text-[11px] font-mono text-[#8B949E] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#58A6FF]" />
                  <span>Suggested queries:</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(q, selectedModel)}
                      className="text-left text-xs p-2.5 rounded-lg bg-[#161B22] border border-[#30363D] hover:border-[#58A6FF]/60 hover:text-[#58A6FF] text-[#C9D1D9] transition cursor-pointer flex items-center justify-between group"
                    >
                      <span>{q}</span>
                      <span className="text-[#8B949E] group-hover:text-[#58A6FF] text-[11px] font-mono">&rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              id={`chat-message-${msg.id}`}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              {msg.role === 'user' ? (
                // User message bubble
                <div className="max-w-2xl bg-[#1F6FEB] text-white rounded-xl rounded-tr-xs px-3.5 py-2.5 text-xs sm:text-sm shadow-xs border border-[#388BFD]/40">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div className="text-[10px] text-blue-200 mt-1 text-right font-mono">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ) : (
                // Assistant message
                <div className="w-full max-w-3xl bg-[#161B22] border border-[#30363D] rounded-xl rounded-tl-xs p-4 sm:p-5 shadow-xs space-y-3.5">
                  {/* Assistant header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-6 h-6 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF] flex items-center justify-center">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-[#F0F6FC]">
                        RepoNotebook
                      </span>

                      {/* Model badge tag */}
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-mono font-medium ${getModelBadgeColor(msg.modelUsed || selectedModel)}`}>
                        <Zap className="w-2.5 h-2.5" />
                        {getModelDisplayName(msg.modelUsed || selectedModel)}
                      </span>

                      {msg.confidence === 'not_found' && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#D29922]/20 border border-[#D29922]/40 text-[#E3B341] font-medium">
                          <AlertCircle className="w-3 h-3" />
                          Outside Repo Scope
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8B949E] font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Markdown body */}
                  <div className="prose prose-sm max-w-none text-[#C9D1D9] leading-relaxed space-y-3">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          return (
                            <code
                              className="bg-[#21262D] text-[#58A6FF] font-mono text-xs px-1.5 py-0.5 rounded border border-[#30363D]"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        pre({ children }) {
                          return (
                            <pre className="bg-[#0D1117] text-[#C9D1D9] p-3 rounded-lg overflow-x-auto font-mono text-xs my-2.5 border border-[#30363D]">
                              {children}
                            </pre>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>

                  {/* Grounding Citations Block */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2.5 border-t border-[#30363D]">
                      <div className="text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-[#58A6FF]" />
                        <span>Verified Repo Citations ({msg.citations.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map((c) => (
                          <CitationChip
                            key={c.id}
                            citation={c}
                            onClick={onSelectCitation}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Action Toolbar */}
                  <div className="pt-2 border-t border-[#30363D] flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <button
                        id={`save-note-btn-${msg.id}`}
                        onClick={() => handleSaveNoteClick(msg)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:bg-[#30363D] hover:text-[#F0F6FC] transition cursor-pointer text-[11px] font-medium"
                      >
                        {savedNoteId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                            <span className="text-[#3FB950]">Saved to Notes!</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5 text-[#58A6FF]" />
                            <span>Save as Note</span>
                          </>
                        )}
                      </button>

                      {msg.citations && msg.citations.length > 0 && (
                        <button
                          id={`pin-citations-btn-${msg.id}`}
                          onClick={() => {
                            msg.citations.forEach((c) => onPinCitation(c));
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:bg-[#30363D] hover:text-[#F0F6FC] transition cursor-pointer text-[11px] font-medium"
                          title="Pin all citations to notebook studio"
                        >
                          <Pin className="w-3.5 h-3.5 text-[#E3B341]" />
                          <span>Pin Citations</span>
                        </button>
                      )}

                      <button
                        id={`copy-msg-btn-${msg.id}`}
                        onClick={() => handleCopyMessage(msg)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:bg-[#30363D] hover:text-[#F0F6FC] transition cursor-pointer text-[11px] font-medium"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#3FB950]" />
                            <span className="text-[#3FB950]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-[#8B949E]" />
                            <span>Copy with Citations</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Follow-up suggestions */}
                  {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[10px] text-[#8B949E] font-medium mb-1.5 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-[#58A6FF]" />
                        <span>Suggested Follow-ups:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedFollowUps.map((q, idx) => (
                          <button
                            key={idx}
                            id={`follow-up-${msg.id}-${idx}`}
                            onClick={() => onSendMessage(q, selectedModel)}
                            className="text-left text-xs px-2.5 py-1 rounded-md bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] text-[#58A6FF] transition cursor-pointer"
                          >
                            &rarr; {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="w-full max-w-3xl bg-[#161B22] border border-[#30363D] rounded-xl rounded-tl-xs p-4 flex items-center gap-3 text-xs text-[#8B949E]">
            <RefreshCw className="w-4 h-4 text-[#58A6FF] animate-spin shrink-0" />
            <span>
              Querying <strong className="text-[#D2A8FF]">{activeModelOption.name}</strong> for <strong className="text-[#F0F6FC]">{repoSource.name}</strong>, grounding evidence, and generating citation-backed response...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 3. Bottom Suggested Questions Chips */}
      {messages.length > 0 && messages.length <= 2 && suggestedQuestions.length > 0 && (
        <div className="px-4 py-2 border-t border-[#30363D] bg-[#161B22]/60">
          <div className="text-[10px] font-semibold text-[#8B949E] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#E3B341]" />
            <span>Explore {repoSource.name}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestedQuestions.map((sq, i) => (
              <button
                key={i}
                id={`suggested-q-${i}`}
                onClick={() => onSendMessage(sq, selectedModel)}
                className="shrink-0 text-xs px-3 py-1 rounded-full bg-[#21262D] border border-[#30363D] text-[#C9D1D9] hover:border-[#58A6FF] hover:text-[#58A6FF] shadow-2xs transition cursor-pointer"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Chat Input Bar with Quick Model Segment Selector */}
      <div className="p-3 border-t border-[#30363D] bg-[#161B22] shrink-0">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              id="chat-input-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Ask a question grounded strictly in ${repoSource.fullName} (using ${activeModelOption.name})...`}
              rows={2}
              className="w-full pl-3.5 pr-10 py-2 text-xs sm:text-sm rounded-lg border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF] resize-none transition"
            />
          </div>

          <button
            id="chat-submit-btn"
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-10 px-3.5 rounded-lg bg-[#238636] hover:bg-[#2EA043] disabled:opacity-40 text-white font-medium shadow-xs transition flex items-center justify-center cursor-pointer shrink-0"
            title={`Send query using ${activeModelOption.name} (Enter)`}
          >
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between text-[10px] text-[#8B949E] mt-2 px-1 gap-2 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8B949E]">Model:</span>
            <div className="inline-flex rounded-md border border-[#30363D] bg-[#0D1117] p-0.5">
              {AVAILABLE_MODELS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                    selectedModel === m.id
                      ? 'bg-[#21262D] text-[#58A6FF] font-semibold border border-[#30363D]'
                      : 'text-[#8B949E] hover:text-[#C9D1D9]'
                  }`}
                  title={`${m.name}: ${m.description}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span>Press <strong>Enter</strong> to send</span>
            <span className="text-[#3FB950]">● Strict 1-Repo Guard Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
