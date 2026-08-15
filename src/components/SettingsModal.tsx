import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Check,
  Shield,
  ExternalLink,
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Database,
  CheckCircle2,
} from 'lucide-react';
import {
  saveGitHubToken,
  getStorageDiagnostics,
  exportAllDataAsJSON,
  importDataFromJSON,
} from '../services/api';
import { Notebook, StorageStats } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedToken: string;
  onTokenUpdated: (token: string) => void;
  notebooks: Notebook[];
  onNotebooksUpdated: (notebooks: Notebook[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  savedToken,
  onTokenUpdated,
  notebooks,
  onNotebooksUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'github'>('storage');
  const [token, setToken] = useState(savedToken);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    setIsLoadingStats(true);
    try {
      const s = await getStorageDiagnostics();
      setStats(s);
    } catch {
      // ignore
    } finally {
      setIsLoadingStats(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveToken = (e: React.FormEvent) => {
    e.preventDefault();
    saveGitHubToken(token.trim());
    onTokenUpdated(token.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 1500);
  };

  const handleClearToken = () => {
    saveGitHubToken('');
    setToken('');
    onTokenUpdated('');
  };

  const handleExportBackup = () => {
    exportAllDataAsJSON(notebooks);
    setStatusMessage('Backup exported successfully as JSON');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importDataFromJSON(file);
      onNotebooksUpdated(imported);
      setStatusMessage(`Imported ${imported.length} notebook(s) successfully!`);
      loadStats();
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    }
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/storage/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebooks }),
      });
      await loadStats();
      setStatusMessage('Data synchronized to local disk storage!');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="settings-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden text-[#C9D1D9] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F0F6FC]">
                Local Workspace & Storage Settings
              </h3>
              <p className="text-xs text-[#8B949E] font-mono">
                Manage local disk persistence, backups, and API credentials
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex items-center border-b border-[#30363D] bg-[#0D1117] px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer font-mono ${
              activeTab === 'storage'
                ? 'border-[#58A6FF] text-[#58A6FF] bg-[#161B22]'
                : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Local Persistence & Storage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer font-mono ${
              activeTab === 'github'
                ? 'border-[#58A6FF] text-[#58A6FF] bg-[#161B22]'
                : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <Key className="w-4 h-4 text-[#D29922]" />
            <span>GitHub API Token</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-[#0D1117] overflow-y-auto flex-1">
          {statusMessage && (
            <div className="p-3 rounded-md bg-[#238636]/15 border border-[#238636]/30 text-xs text-[#3FB950] flex items-center gap-2 font-mono">
              <CheckCircle2 className="w-4 h-4 text-[#3FB950] shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* TAB 1: LOCAL STORAGE & PERSISTENCE */}
          {activeTab === 'storage' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Status Pill Card */}
              <div className="p-4 rounded-lg bg-[#161B22] border border-[#30363D] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#F0F6FC]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#3FB950] animate-pulse" />
                    <span>Local Persistence Active</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#238636]/20 border border-[#238636]/30 text-[#3FB950] font-mono">
                    Disk + IndexedDB
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs font-mono">
                  <div className="p-2.5 rounded bg-[#0D1117] border border-[#30363D]">
                    <div className="text-[10px] text-[#8B949E]">Saved Notebooks</div>
                    <div className="text-base font-bold text-[#F0F6FC] mt-0.5">
                      {stats?.totalNotebooks ?? notebooks.length}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1117] border border-[#30363D]">
                    <div className="text-[10px] text-[#8B949E]">Indexed Files</div>
                    <div className="text-base font-bold text-[#58A6FF] mt-0.5">
                      {stats?.totalFiles ?? notebooks.reduce((acc, n) => acc + (n.files?.length || 0), 0)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-[#0D1117] border border-[#30363D]">
                    <div className="text-[10px] text-[#8B949E]">Semantic Chunks</div>
                    <div className="text-base font-bold text-[#D29922] mt-0.5">
                      {stats?.totalChunks ?? notebooks.reduce((acc, n) => acc + (n.chunks?.length || 0), 0)}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[#8B949E] font-mono flex items-center justify-between border-t border-[#30363D] pt-2">
                  <span className="truncate max-w-[320px]">
                    Storage: <code>{stats?.storagePath || '.reponotebook_data/reponotebook.sqlite'}</code>
                  </span>
                  <span className="shrink-0 ml-2">
                    {stats?.diskUsageBytes ? `${Math.round(stats.diskUsageBytes / 1024)} KB` : 'SQLite DB'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#F0F6FC] font-mono">
                  Backup & Synchronization
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="p-3 rounded-lg border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] hover:border-[#58A6FF] text-left transition flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded bg-[#21262D] text-[#58A6FF] shrink-0">
                      <Download className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#F0F6FC] group-hover:text-[#58A6FF]">
                        Export Backup (.json)
                      </div>
                      <div className="text-[10px] text-[#8B949E] font-mono">
                        Download all notebooks & notes
                      </div>
                    </div>
                  </button>

                  <label className="p-3 rounded-lg border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] hover:border-[#58A6FF] text-left transition flex items-center gap-3 cursor-pointer group relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="p-2 rounded bg-[#21262D] text-[#3FB950] shrink-0">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#F0F6FC] group-hover:text-[#3FB950]">
                        Import Backup (.json)
                      </div>
                      <div className="text-[10px] text-[#8B949E] font-mono">
                        Restore notebooks from file
                      </div>
                    </div>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleForceSync}
                    disabled={isSyncing}
                    className="w-full py-2 px-3 rounded-lg border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] text-xs text-[#C9D1D9] font-mono flex items-center justify-center gap-2 cursor-pointer transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#58A6FF] ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Writing to Disk...' : 'Force Sync Active State to Disk'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GITHUB API TOKEN */}
          {activeTab === 'github' && (
            <form onSubmit={handleSaveToken} className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#F0F6FC]">
                  GitHub Personal Access Token (classic or fine-grained)
                </label>
                <input
                  id="settings-github-token-input"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                />
                <p className="text-[11px] text-[#8B949E] leading-relaxed font-mono">
                  Without a token, GitHub public API allows 60 requests/hour per IP. Adding a token elevates your quota to 5,000 requests/hour and enables indexing your private repositories.
                </p>
              </div>

              <div className="p-3 rounded-md bg-[#161B22] border border-[#30363D] flex items-start gap-2.5 text-xs text-[#8B949E] font-mono">
                <Shield className="w-4 h-4 text-[#3FB950] shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Tokens are stored securely in your local environment and passed only in requests to GitHub API endpoints.
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#30363D]">
                <a
                  href="https://github.com/settings/tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#58A6FF] hover:underline flex items-center gap-1 font-mono"
                >
                  <span>Generate token on GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex items-center gap-2">
                  {savedToken && (
                    <button
                      type="button"
                      onClick={handleClearToken}
                      className="px-2.5 py-1 text-xs text-[#F85149] hover:bg-[#21262D] rounded-md transition cursor-pointer"
                    >
                      Remove Token
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {saved ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{saved ? 'Saved!' : 'Save Token'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
