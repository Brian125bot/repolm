import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Cpu,
  Layers,
  FileCode,
  ShieldCheck,
  Zap,
  Terminal,
  FolderTree,
  Sparkles,
  GitBranch,
  Network,
  Presentation,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'models' | 'artifacts' | 'citations' | 'api' | 'security'
  >('overview');

  if (!isOpen) return null;

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Architecture & Overview', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'models', label: 'Gemini Models (3.7 / 3.5 / 3.1)', icon: <Cpu className="w-3.5 h-3.5" /> },
    { id: 'artifacts', label: '15 Research Artifacts', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'citations', label: 'Strict Grounding & Citations', icon: <FolderTree className="w-3.5 h-3.5" /> },
    { id: 'api', label: 'API Reference', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Security & Privacy', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in select-none">
      <div
        id="documentation-modal-container"
        className="w-full max-w-4xl max-h-[90vh] bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl flex flex-col overflow-hidden text-[#C9D1D9]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between bg-[#0D1117]/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#1F6FEB] flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F0F6FC] flex items-center gap-2">
                <span>RepoNotebook Documentation &amp; Architecture</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
                  v2.4
                </span>
              </h2>
              <p className="text-xs text-[#8B949E]">
                Comprehensive reference for single-repo grounding, multi-model execution, and research artifacts.
              </p>
            </div>
          </div>
          <button
            id="close-documentation-modal-btn"
            onClick={onClose}
            className="p-1 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-5 border-b border-[#30363D] bg-[#161B22] flex gap-1 overflow-x-auto shrink-0 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#58A6FF] text-[#58A6FF] bg-[#21262D]/40'
                  : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9] hover:border-[#30363D]'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0D1117] text-xs sm:text-sm select-text">
          {/* TAB 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#3FB950]" />
                  The Single-Repository Grounding Paradigm
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  <strong>RepoNotebook</strong> is designed as a deep-research notebook strictly grounded in exactly <em>one GitHub repository at a time</em>. Unlike broad AI search engines or generic multi-repo aggregators that hallucinate non-existent files or blend external codebases, RepoNotebook isolates repository context completely.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] space-y-1.5">
                  <div className="text-xs font-semibold text-[#58A6FF] flex items-center gap-1.5">
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>1. Ingestion &amp; Chunking</span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    Recursive Git tree ingestion maps code, documentation, configuration, tests, and CI workflows into indexed semantic chunks.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] space-y-1.5">
                  <div className="text-xs font-semibold text-[#A371F7] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>2. Grounded Reasoning</span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    Google GenAI SDK (Gemini 3.7 Flash, 3.5 Flash Lite, 3.1 Flash Lite) processes relevant chunks with strict single-repo prompt guardrails.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] space-y-1.5">
                  <div className="text-xs font-semibold text-[#3FB950] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>3. Verified Citations</span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    Every answer, artifact, and note links back to verifiable file paths and exact line ranges with click-to-view modal inspection.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] space-y-2">
                <h4 className="text-xs font-semibold text-[#F0F6FC]">Three-Panel Workspace Layout</h4>
                <ul className="space-y-1.5 text-xs text-[#8B949E] list-disc list-inside leading-relaxed">
                  <li><strong className="text-[#C9D1D9]">Left Panel (Sources):</strong> File browser, category filters (Code, Docs, Configs, Tests, Workflows), repository stats, and one-click re-indexing.</li>
                  <li><strong className="text-[#C9D1D9]">Center Panel (Chat):</strong> Citation-backed conversational stream with Answer Modes (Detailed, Concise, Code Focus, Architecture, Beginner), Model Selector, and Chat History Reset.</li>
                  <li><strong className="text-[#C9D1D9]">Right Panel (Research Studio):</strong> 15 on-demand Research Artifacts, Markdown Note Editor with Tags &amp; Citations, Pinned Citations Tray, and AI Briefing Doc synthesis.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Models */}
          {activeTab === 'models' && (
            <div className="space-y-5 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-1.5">
                  Gemini Model Selection Architecture
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  Select between three purpose-tuned Gemini models directly inside the chat panel. Each model is proxied server-side via the official <code className="text-[#58A6FF] font-mono text-xs">@google/genai</code> TypeScript SDK with exponential backoff and transient error recovery.
                </p>
              </div>

              <div className="space-y-3">
                {/* 3.7 Flash */}
                <div className="p-4 rounded-lg bg-[#161B22] border border-[#A371F7]/40 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#D2A8FF]" />
                      <span className="font-bold text-[#F0F6FC] text-sm">Gemini 3.7 Flash (<code className="font-mono text-xs text-[#D2A8FF]">gemini-3.7-flash</code>)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#A371F7]/20 text-[#D2A8FF] font-mono border border-[#A371F7]/40 font-semibold">
                      Flagship Reasoning (Recommended)
                    </span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    The primary flagship model for deep technical reasoning, intricate codebase architecture, cross-module data flow analysis, and nuanced multi-citation code generation. Ideal for answering complex architectural inquiries and generating exhaustive research artifacts.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-[#8B949E] pt-1">
                    <span>⚡ Speed: <strong>Standard Fast</strong></span>
                    <span>🎯 Reasoning: <strong>Maximum</strong></span>
                    <span>📄 Best For: <strong>Architecture, Refactoring, Deep Q&amp;A</strong></span>
                  </div>
                </div>

                {/* 3.5 Flash Lite */}
                <div className="p-4 rounded-lg bg-[#161B22] border border-[#58A6FF]/40 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#58A6FF]" />
                      <span className="font-bold text-[#F0F6FC] text-sm">Gemini 3.5 Flash Lite (<code className="font-mono text-xs text-[#58A6FF]">gemini-3.5-flash-lite</code>)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#58A6FF]/20 text-[#58A6FF] font-mono border border-[#58A6FF]/40 font-semibold">
                      Balanced &amp; Low Latency
                    </span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    An ultra-efficient model providing great precision with significantly reduced response latency. Excellent for exploratory Q&amp;A, quick code clarifications, follow-up prompt loops, and interactive research brainstorming.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-[#8B949E] pt-1">
                    <span>⚡ Speed: <strong>Ultra Fast</strong></span>
                    <span>🎯 Reasoning: <strong>High</strong></span>
                    <span>📄 Best For: <strong>Interactive Chat, Code Exploration</strong></span>
                  </div>
                </div>

                {/* 3.1 Flash Lite */}
                <div className="p-4 rounded-lg bg-[#161B22] border border-[#3FB950]/40 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-[#3FB950]" />
                      <span className="font-bold text-[#F0F6FC] text-sm">Gemini 3.1 Flash Lite (<code className="font-mono text-xs text-[#3FB950]">gemini-3.1-flash-lite</code>)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3FB950]/20 text-[#3FB950] font-mono border border-[#3FB950]/40 font-semibold">
                      Fastest Throughput
                    </span>
                  </div>
                  <p className="text-xs text-[#8B949E] leading-relaxed">
                    High-throughput, lightweight engine tuned for instantaneous queries. Perfect for finding where a specific function or interface is declared, querying configuration flags, or generating quick glossary definitions with lightning speed.
                  </p>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-[#8B949E] pt-1">
                    <span>⚡ Speed: <strong>Lightning Fast</strong></span>
                    <span>🎯 Reasoning: <strong>Moderate</strong></span>
                    <span>📄 Best For: <strong>Quick Lookups, Syntax Checks, Definitions</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Artifacts */}
          {activeTab === 'artifacts' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-1.5">
                  15 Grounded Research Artifacts
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  Generate comprehensive, citation-backed documentation artifacts with one click from the Research Studio sidebar:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#58A6FF] flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-[#58A6FF]" />
                    <span>Interactive Mindmap</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E]">Hierarchical node-link SVG visualization rendered via D3 with interactive node expansion and citation tracking.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#D2A8FF] flex items-center gap-1.5">
                    <Presentation className="w-3.5 h-3.5 text-[#D2A8FF]" />
                    <span>Presentation Slideshow</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E]">Executive walkthrough slide deck with keyboard navigation (Arrows/Spacebar), fullscreen mode, and grounded takeaways.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#3FB950] flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#3FB950]" />
                    <span>System Architecture</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E]">Subsystem topology, data flow diagrams, state management boundaries, and ASCII/Mermaid visual representations.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#E3B341] flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-[#E3B341]" />
                    <span>Public API Surface</span>
                  </div>
                  <p className="text-[11px] text-[#8B949E]">Complete catalog of exported functions, interfaces, type declarations, hooks, and parameter schemas.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#F0F6FC]">Getting Started &amp; Setup</div>
                  <p className="text-[11px] text-[#8B949E]">Verified installation prerequisites, build scripts, local dev workflow, and initial setup steps.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#F0F6FC]">Developer Onboarding Guide</div>
                  <p className="text-[11px] text-[#8B949E]">Day-1 orientation walkthrough, dev conventions, testing procedures, and contribution guidelines.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#F0F6FC]">Testing &amp; Quality Report</div>
                  <p className="text-[11px] text-[#8B949E]">Test framework audit, test runner scripts, unit/integration suite breakdown, and mock strategies.</p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1">
                  <div className="text-xs font-semibold text-[#F0F6FC]">Risks &amp; Rough Edges</div>
                  <p className="text-[11px] text-[#8B949E]">Critical edge cases, concurrency gotchas, deprecation warnings, and performance bottlenecks.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Citations */}
          {activeTab === 'citations' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-1.5">
                  Strict Grounding &amp; Citation Engine
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  RepoNotebook guarantees transparent factual traceability. Every claim links to verifiable source lines.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] space-y-3 font-mono text-xs">
                <div className="text-[#8B949E] text-[11px] uppercase tracking-wider">Citation Tag Standard:</div>
                <div className="p-2.5 rounded bg-[#0D1117] border border-[#30363D] text-[#58A6FF]">
                  [path/to/file.ts:L45-L68]
                </div>
                <p className="text-[11px] text-[#8B949E] leading-relaxed font-sans">
                  The regex parser extracts citation tokens and correlates them against indexed tree files. Clicking any citation chip opens the <strong>File Viewer Modal</strong>, displaying the full file content with automatic scrolling and glowing line highlighting for the cited span.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] space-y-2">
                <h4 className="text-xs font-semibold text-[#F0F6FC]">Pinned Citations &amp; Studio Notes</h4>
                <p className="text-xs text-[#8B949E] leading-relaxed">
                  Pin key citations to your persistent workspace tray, or convert any chat response into an editable note with attached citation links. Notes can be categorized with custom tags and merged into an executive Briefing Document anytime.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: API Reference */}
          {activeTab === 'api' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-1.5">
                  Backend API Reference
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  Express server endpoints running on port 3000 proxies all requests securely without client exposure:
                </p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#238636]/20 text-[#3FB950] font-bold">POST</span>
                    <span className="text-[#F0F6FC]">/api/repo/ingest</span>
                  </div>
                  <p className="text-[#8B949E] font-sans text-xs">
                    Ingests a GitHub repo URL, fetches metadata, tree items, and file contents, and creates structured semantic chunks.
                  </p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#238636]/20 text-[#3FB950] font-bold">POST</span>
                    <span className="text-[#F0F6FC]">/api/repo/query</span>
                  </div>
                  <p className="text-[#8B949E] font-sans text-xs">
                    Executes grounded Q&amp;A using the specified Gemini model (3.7 Flash, 3.5 Flash Lite, or 3.1 Flash Lite) with answer modes and returns structured line citations.
                  </p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#238636]/20 text-[#3FB950] font-bold">POST</span>
                    <span className="text-[#F0F6FC]">/api/repo/artifact</span>
                  </div>
                  <p className="text-[#8B949E] font-sans text-xs">
                    Generates any of the 15 specialized research artifacts (mindmaps, slideshows, architecture, etc.) with markdown output and line references.
                  </p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#238636]/20 text-[#3FB950] font-bold">POST</span>
                    <span className="text-[#F0F6FC]">/api/notes/merge</span>
                  </div>
                  <p className="text-[#8B949E] font-sans text-xs">
                    Synthesizes multiple user notes and research findings into a cohesive, publication-ready Briefing Document.
                  </p>
                </div>

                <div className="p-3 bg-[#161B22] border border-[#30363D] rounded-lg space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-[#1F6FEB]/20 text-[#58A6FF] font-bold">GET</span>
                    <span className="text-[#F0F6FC]">/api/health</span>
                  </div>
                  <p className="text-[#8B949E] font-sans text-xs">
                    Returns server status, timestamp, and container connectivity health.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Security & Privacy */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="text-base font-semibold text-[#F0F6FC] mb-1.5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#3FB950]" />
                  Security, Privacy &amp; Grounding Guardrails
                </h3>
                <p className="text-[#8B949E] leading-relaxed">
                  RepoNotebook is designed with strict enterprise privacy and safety constraints:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-xs text-[#F0F6FC]">Server-Side Secret Isolation</h5>
                    <p className="text-xs text-[#8B949E] leading-relaxed">
                      API keys (<code className="text-[#58A6FF] font-mono">GEMINI_API_KEY</code>) are managed strictly on the server-side and never exposed to the browser.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-xs text-[#F0F6FC]">Strict Single-Repo Boundaries</h5>
                    <p className="text-xs text-[#8B949E] leading-relaxed">
                      Notebooks are strictly bound to one repository at a time. The assistant is instructed to explicitly state when something is not in the repository and refuse external hallucinations.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#161B22] border border-[#30363D] flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-xs text-[#F0F6FC]">Private Repository Support</h5>
                    <p className="text-xs text-[#8B949E] leading-relaxed">
                      Users can supply a personal GitHub access token stored strictly in browser localStorage to securely access private repos and bypass public rate limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#30363D] bg-[#161B22] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-[#8B949E] font-mono">
            RepoNotebook &bull; Powered by Google Gemini &amp; GitHub REST API
          </span>
          <button
            id="close-documentation-btn"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md bg-[#21262D] border border-[#30363D] hover:bg-[#30363D] text-[#F0F6FC] text-xs font-medium transition cursor-pointer"
          >
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
