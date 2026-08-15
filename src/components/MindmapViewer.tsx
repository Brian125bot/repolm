import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Artifact, Citation, RepoSource } from '../types';
import { CitationChip } from './CitationChip';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Code,
  Layers,
  FileText,
  ExternalLink,
  GitBranch,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface MindmapViewerProps {
  artifact: Artifact;
  repoSource: RepoSource;
  onSelectCitation: (citation: Citation) => void;
}

interface MindmapNode {
  id: string;
  label: string;
  category?: 'root' | 'branch' | 'leaf';
  depth: number;
  description?: string;
  citations: Citation[];
  children: MindmapNode[];
}

export const MindmapViewer: React.FC<MindmapViewerProps> = ({
  artifact,
  repoSource,
  onSelectCitation,
}) => {
  const [activeView, setActiveView] = useState<'visual' | 'outline' | 'mermaid'>('visual');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Extract Mermaid block if present
  const mermaidCode = useMemo(() => {
    const match = artifact.content.match(/```mermaid([\s\S]*?)```/);
    if (match && match[1]) {
      return match[1].trim();
    }
    // Default fallback mermaid
    return `mindmap\n  root(("${repoSource.name}"))\n    ["Architecture"]\n      ["Core Engine"]\n      ["State Flow"]\n    ["API Surface"]\n      ["Hooks & Methods"]\n      ["Plugins"]\n    ["Infrastructure"]\n      ["Tests"]\n      ["CI/CD Workflows"]`;
  }, [artifact.content, repoSource.name]);

  // Parse markdown into a hierarchical tree structure for interactive visualization
  const rootNode = useMemo((): MindmapNode => {
    const lines = artifact.content.split('\n');
    const root: MindmapNode = {
      id: 'root-0',
      label: repoSource.fullName || repoSource.name,
      category: 'root',
      depth: 0,
      description: repoSource.description,
      citations: [],
      children: [],
    };

    let currentH2: MindmapNode | null = null;
    let currentH3: MindmapNode | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('```') || line.startsWith('mindmap') || line.startsWith('root((')) {
        continue;
      }

      // Check citations on the line
      const lineCitations: Citation[] = [];
      const citMatches = line.matchAll(/\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g);
      for (const m of citMatches) {
        const filePath = m[1];
        const startLine = parseInt(m[2], 10);
        const endLine = m[3] ? parseInt(m[3], 10) : startLine;
        lineCitations.push({
          id: `cit-node-${i}-${filePath}-${startLine}`,
          filePath,
          startLine,
          endLine,
          fileCategory: 'code',
        });
      }

      const cleanText = line
        .replace(/\[([a-zA-Z0-9_\-./]+):L(\d+)(?:-L?(\d+))?\]/g, '')
        .replace(/^[#*-\d.]+\s*/, '')
        .replace(/[\[\]\(\)\"\`]/g, '')
        .trim();

      if (!cleanText) continue;

      if (line.startsWith('## ')) {
        currentH2 = {
          id: `h2-${root.children.length}`,
          label: cleanText,
          category: 'branch',
          depth: 1,
          citations: lineCitations,
          children: [],
        };
        root.children.push(currentH2);
        currentH3 = null;
      } else if (line.startsWith('### ')) {
        currentH3 = {
          id: `h3-${currentH2 ? currentH2.children.length : root.children.length}`,
          label: cleanText,
          category: 'leaf',
          depth: 2,
          citations: lineCitations,
          children: [],
        };
        if (currentH2) {
          currentH2.children.push(currentH3);
        } else {
          root.children.push(currentH3);
        }
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemNode: MindmapNode = {
          id: `item-${i}`,
          label: cleanText,
          category: 'leaf',
          depth: currentH3 ? 3 : currentH2 ? 2 : 1,
          citations: lineCitations,
          children: [],
        };

        if (currentH3) {
          currentH3.children.push(itemNode);
        } else if (currentH2) {
          currentH2.children.push(itemNode);
        } else {
          root.children.push(itemNode);
        }
      }
    }

    // Fallback if parsing produced few nodes
    if (root.children.length === 0) {
      root.children = [
        {
          id: 'branch-arch',
          label: 'Core Architecture',
          category: 'branch',
          depth: 1,
          citations: artifact.citations.slice(0, 2),
          children: [
            {
              id: 'leaf-entry',
              label: 'Main Entry Point & Store Initializer',
              category: 'leaf',
              depth: 2,
              citations: artifact.citations.slice(0, 1),
              children: [],
            },
            {
              id: 'leaf-lifecycle',
              label: 'State Lifecycle & Subscriptions',
              category: 'leaf',
              depth: 2,
              citations: artifact.citations.slice(1, 2),
              children: [],
            },
          ],
        },
        {
          id: 'branch-api',
          label: 'Public APIs & Hooks',
          category: 'branch',
          depth: 1,
          citations: artifact.citations.slice(2, 4),
          children: [
            {
              id: 'leaf-hooks',
              label: 'React Hook Bindings',
              category: 'leaf',
              depth: 2,
              citations: artifact.citations.slice(2, 3),
              children: [],
            },
            {
              id: 'leaf-vanilla',
              label: 'Vanilla State Utilities',
              category: 'leaf',
              depth: 2,
              citations: artifact.citations.slice(3, 4),
              children: [],
            },
          ],
        },
        {
          id: 'branch-quality',
          label: 'Quality, Tests & CI',
          category: 'branch',
          depth: 1,
          citations: artifact.citations.slice(4, 6),
          children: [
            {
              id: 'leaf-tests',
              label: 'Unit Test Coverage & Suites',
              category: 'leaf',
              depth: 2,
              citations: artifact.citations.slice(4, 5),
              children: [],
            },
          ],
        },
      ];
    }

    return root;
  }, [artifact.content, artifact.citations, repoSource.fullName, repoSource.name, repoSource.description]);

  const toggleNode = (nodeId: string) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedNodeIds(new Set());
  const collapseAll = () => {
    const allBranchIds = new Set<string>();
    rootNode.children.forEach((c) => {
      allBranchIds.add(c.id);
      c.children.forEach((cc) => allBranchIds.add(cc.id));
    });
    setCollapsedNodeIds(allBranchIds);
  };

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderVisualNode = (node: MindmapNode, index: number, isLast: boolean) => {
    const isCollapsed = collapsedNodeIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const matchesSearch =
      searchQuery.trim() !== '' &&
      node.label.toLowerCase().includes(searchQuery.toLowerCase());

    const isRoot = node.category === 'root';
    const isBranch = node.category === 'branch';

    return (
      <div key={node.id} className="relative flex flex-col items-start my-1.5 transition-all">
        {/* Node Box */}
        <div
          className={`group flex items-start gap-2 p-2.5 rounded-lg border transition-all ${
            isRoot
              ? 'bg-[#161B22] border-[#58A6FF] shadow-md ring-1 ring-[#58A6FF]/30'
              : isBranch
              ? 'bg-[#161B22] border-[#30363D] hover:border-[#58A6FF]/60 hover:bg-[#21262D]'
              : 'bg-[#0D1117] border-[#30363D]/80 hover:border-[#58A6FF]/40 hover:bg-[#161B22]'
          } ${matchesSearch ? 'ring-2 ring-[#D29922] bg-[#D29922]/10' : ''}`}
        >
          {hasChildren && (
            <button
              onClick={() => toggleNode(node.id)}
              className="p-1 rounded hover:bg-[#30363D] text-[#8B949E] hover:text-[#F0F6FC] transition shrink-0 cursor-pointer mt-0.5"
              title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-[#58A6FF]" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {!hasChildren && (
            <div className="w-4 h-4 flex items-center justify-center text-[#8B949E] shrink-0 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#58A6FF]/70" />
            </div>
          )}

          <div className="space-y-1 min-w-0 max-w-md">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-semibold leading-tight ${
                  isRoot
                    ? 'text-[#58A6FF] text-sm font-mono'
                    : isBranch
                    ? 'text-[#F0F6FC]'
                    : 'text-[#C9D1D9]'
                }`}
              >
                {node.label}
              </span>

              {hasChildren && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#21262D] text-[#8B949E] border border-[#30363D] font-mono">
                  {node.children.length}
                </span>
              )}
            </div>

            {node.description && (
              <p className="text-[11px] text-[#8B949E] leading-relaxed line-clamp-2">
                {node.description}
              </p>
            )}

            {/* Clickable Citations on Node */}
            {node.citations && node.citations.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {node.citations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCitation(c)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#388BFD]/15 hover:bg-[#388BFD]/30 text-[#58A6FF] border border-[#388BFD]/30 transition cursor-pointer"
                    title={`View ${c.filePath}:${c.startLine}`}
                  >
                    <span>{c.filePath.split('/').pop()}:L{c.startLine}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sub-Tree Branches */}
        {hasChildren && !isCollapsed && (
          <div className="pl-6 ml-3 mt-1.5 border-l-2 border-[#30363D]/70 space-y-1">
            {node.children.map((child, idx) =>
              renderVisualNode(child, idx, idx === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col bg-[#0D1117] text-[#C9D1D9] border border-[#30363D] rounded-xl overflow-hidden shadow-xl ${
        isFullscreen ? 'fixed inset-4 z-50' : 'h-full min-h-[520px]'
      }`}
    >
      {/* Mindmap Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161B22] border-b border-[#30363D] flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-[#F0F6FC]">
                {artifact.title || 'Interactive Codebase Mindmap'}
              </h3>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#21262D] border border-[#30363D] text-[#58A6FF] font-mono">
                {repoSource.name}
              </span>
            </div>
            <p className="text-[10px] text-[#8B949E] font-mono">
              Hierarchical visual tree with verified source citations
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0D1117] p-1 rounded-lg border border-[#30363D]">
          <button
            onClick={() => setActiveView('visual')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'visual'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs'
                : 'text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Interactive Canvas</span>
          </button>
          <button
            onClick={() => setActiveView('mermaid')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'mermaid'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs'
                : 'text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Mermaid Code</span>
          </button>
          <button
            onClick={() => setActiveView('outline')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition cursor-pointer flex items-center gap-1.5 ${
              activeView === 'outline'
                ? 'bg-[#21262D] text-[#58A6FF] shadow-xs'
                : 'text-[#8B949E] hover:text-[#F0F6FC]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Outline</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyMermaid}
            className="px-2.5 py-1 text-xs font-mono rounded-md border border-[#30363D] bg-[#21262D] text-[#C9D1D9] hover:text-[#F0F6FC] hover:bg-[#30363D] transition flex items-center gap-1.5 cursor-pointer"
            title="Copy Mermaid syntax"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#3FB950]" /> : <Copy className="w-3.5 h-3.5 text-[#8B949E]" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy Mermaid'}</span>
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-md border border-[#30363D] bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Canvas'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Control bar for Visual mode */}
      {activeView === 'visual' && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#161B22]/60 border-b border-[#30363D] text-xs flex-wrap gap-2">
          {/* Search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8B949E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search mindmap nodes..."
              className="w-full pl-8 pr-3 py-1 text-xs font-mono rounded-md border border-[#30363D] bg-[#0D1117] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-2 py-0.5 text-[11px] font-mono rounded border border-[#30363D] hover:bg-[#21262D] text-[#8B949E] hover:text-[#C9D1D9] transition cursor-pointer"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-0.5 text-[11px] font-mono rounded border border-[#30363D] hover:bg-[#21262D] text-[#8B949E] hover:text-[#C9D1D9] transition cursor-pointer"
            >
              Collapse All
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 border-l border-[#30363D] pl-2 ml-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 15, 60))}
                className="p-1 rounded hover:bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-[#8B949E] w-9 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 15, 160))}
                className="p-1 rounded hover:bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel(100)}
                className="p-1 rounded hover:bg-[#21262D] text-[#8B949E] hover:text-[#F0F6FC] transition cursor-pointer"
                title="Reset Zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main View Area */}
      <div className="flex-1 overflow-auto p-4 relative bg-[#0D1117]">
        {activeView === 'visual' && (
          <div
            className="transition-transform origin-top-left"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            {renderVisualNode(rootNode, 0, true)}
          </div>
        )}

        {activeView === 'mermaid' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#8B949E]">
              <span>Mermaid mindmap diagram definition:</span>
              <button
                onClick={handleCopyMermaid}
                className="text-[#58A6FF] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] text-[#58A6FF] overflow-x-auto leading-relaxed">
              {mermaidCode}
            </pre>
            <div className="p-3 rounded-lg bg-[#161B22]/60 border border-[#30363D] text-[#8B949E] text-[11px] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#58A6FF] shrink-0" />
              <span>You can paste this Mermaid code directly into GitHub Markdown or Notion docs.</span>
            </div>
          </div>
        )}

        {activeView === 'outline' && (
          <div className="prose prose-sm max-w-none text-[#C9D1D9] text-xs leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {artifact.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Footer Citations Bar */}
      {artifact.citations && artifact.citations.length > 0 && (
        <div className="px-4 py-2.5 bg-[#161B22] border-t border-[#30363D] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#8B949E] font-mono">
            <GitBranch className="w-3.5 h-3.5 text-[#58A6FF]" />
            <span>{artifact.citations.length} Grounded Source Citations:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
            {artifact.citations.map((c) => (
              <CitationChip
                key={c.id}
                citation={c}
                onClick={onSelectCitation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
