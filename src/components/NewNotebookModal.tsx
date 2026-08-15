import React, { useState } from 'react';
import { POPULAR_REPOS } from '../sampleRepos';
import { IngestRepoParams, LocalScanResult } from '../types';
import { scanLocalDirectory } from '../services/api';
import {
  BookOpen,
  GitBranch,
  Key,
  Filter,
  Sparkles,
  X,
  AlertCircle,
  RefreshCw,
  Lock,
  FolderCode,
  UploadCloud,
  Github,
  CheckCircle2,
  HardDrive,
  FileCode,
} from 'lucide-react';

interface NewNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (params: IngestRepoParams) => Promise<void>;
  isLoading: boolean;
  savedToken: string;
}

export const NewNotebookModal: React.FC<NewNotebookModalProps> = ({
  isOpen,
  onClose,
  onIngest,
  isLoading,
  savedToken,
}) => {
  const [sourceType, setSourceType] = useState<'local' | 'upload' | 'github'>('local');

  // GitHub Tab State
  const [repoUrl, setRepoUrl] = useState('');
  const [ref, setRef] = useState('');
  const [githubToken, setGithubToken] = useState(savedToken);

  // Local Path Tab State
  const [localPath, setLocalPath] = useState('./');
  const [folderName, setFolderName] = useState('');
  const [pathFilter, setPathFilter] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<LocalScanResult | null>(null);

  // Upload Tab State
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [uploadFolderName, setUploadFolderName] = useState('');
  const [isReadingUpload, setIsReadingUpload] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<string>('');

  if (!isOpen) return null;

  // Scan local directory on demand
  const handleScanLocal = async () => {
    setError(null);
    setIsScanning(true);
    try {
      const res = await scanLocalDirectory(localPath.trim() || './');
      setScanResult(res);
      if (!folderName) {
        const parts = res.path.split(/[/\\\\]/).filter(Boolean);
        setFolderName(parts[parts.length - 1] || 'local-repo');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scan directory');
      setScanResult(null);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle local folder file picker
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsReadingUpload(true);
    setError(null);

    try {
      const loaded: Array<{ path: string; content: string }> = [];
      const rootFolder = files[0].webkitRelativePath?.split('/')[0] || 'uploaded-project';
      setUploadFolderName(rootFolder);

      for (let i = 0; i < Math.min(files.length, 120); i++) {
        const file = files[i];
        const relPath = file.webkitRelativePath || file.name;
        const lower = relPath.toLowerCase();

        // Skip binary and build dirs
        if (
          lower.includes('node_modules/') ||
          lower.includes('.git/') ||
          lower.includes('.next/') ||
          lower.includes('dist/') ||
          lower.includes('build/') ||
          lower.endsWith('.png') ||
          lower.endsWith('.jpg') ||
          lower.endsWith('.jpeg') ||
          lower.endsWith('.ico') ||
          lower.endsWith('.pdf') ||
          lower.endsWith('.zip') ||
          lower.endsWith('.lock')
        ) {
          continue;
        }

        if (file.size > 250000) continue; // Skip huge files

        try {
          const text = await file.text();
          loaded.push({ path: relPath, content: text });
        } catch {
          // ignore unreadable
        }
      }

      setUploadedFiles(loaded);
    } catch (err: any) {
      setError(`Failed to read files: ${err.message}`);
    } finally {
      setIsReadingUpload(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError(null);

    try {
      if (sourceType === 'local') {
        if (!localPath.trim()) {
          setError('Please enter a local directory path.');
          return;
        }
        setStepStatus('Scanning local filesystem & generating semantic index...');
        await onIngest({
          isLocal: true,
          localPath: localPath.trim(),
          folderName: folderName.trim() || undefined,
          pathFilter: pathFilter.trim() || undefined,
        });
      } else if (sourceType === 'upload') {
        if (uploadedFiles.length === 0) {
          setError('Please choose a folder or files to upload first.');
          return;
        }
        setStepStatus('Processing uploaded files & building local chunks...');
        await onIngest({
          isLocal: true,
          folderName: uploadFolderName.trim() || 'uploaded-project',
          uploadedFiles,
        });
      } else {
        if (!repoUrl.trim()) {
          setError('GitHub repository URL is required.');
          return;
        }
        setStepStatus('Fetching repository tree from GitHub...');
        await onIngest({
          repoUrl: repoUrl.trim(),
          ref: ref.trim() || undefined,
          githubToken: githubToken.trim() || undefined,
          pathFilter: pathFilter.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create notebook.');
    } finally {
      setStepStatus('');
    }
  };

  const handleSelectPopular = (url: string) => {
    setRepoUrl(url);
    setRef('');
    setPathFilter('');
  };

  return (
    <div
      id="new-notebook-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in"
      onClick={() => !isLoading && onClose()}
    >
      <div
        id="new-notebook-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden text-[#C9D1D9] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#58A6FF]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F0F6FC] flex items-center gap-2">
                <span>Create Single-Repository Notebook</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#238636]/20 border border-[#238636]/40 text-[#3FB950] font-mono">
                  Disk & IndexedDB Persisted
                </span>
              </h3>
              <p className="text-xs text-[#8B949E] font-mono">
                Index a local project or GitHub repository into an interactive research notebook
              </p>
            </div>
          </div>

          {!isLoading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Source Type Selector Tabs */}
        <div className="flex items-center border-b border-[#30363D] bg-[#0D1117] px-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSourceType('local');
              setError(null);
            }}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer font-mono ${
              sourceType === 'local'
                ? 'border-[#58A6FF] text-[#58A6FF] bg-[#161B22]'
                : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <FolderCode className="w-4 h-4" />
            <span>Local Directory Path</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceType('upload');
              setError(null);
            }}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer font-mono ${
              sourceType === 'upload'
                ? 'border-[#58A6FF] text-[#58A6FF] bg-[#161B22]'
                : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Local Folder</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSourceType('github');
              setError(null);
            }}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer font-mono ${
              sourceType === 'github'
                ? 'border-[#58A6FF] text-[#58A6FF] bg-[#161B22]'
                : 'border-transparent text-[#8B949E] hover:text-[#C9D1D9]'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub Repository</span>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#0D1117] overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-md bg-[#F85149]/15 border border-[#F85149]/30 text-xs text-[#FF7B72] flex items-start gap-2.5 font-mono">
              <AlertCircle className="w-4 h-4 text-[#F85149] shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {/* TAB 1: LOCAL DIRECTORY PATH */}
          {sourceType === 'local' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#F0F6FC] flex items-center justify-between">
                  <span>Local Filesystem Path <span className="text-[#F85149]">*</span></span>
                  <span className="text-[11px] text-[#8B949E] font-normal font-mono">Relative or absolute path</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="local-path-input"
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    placeholder="./ or /workspace or ./src"
                    required
                    disabled={isLoading}
                    className="flex-1 px-3.5 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  />
                  <button
                    type="button"
                    onClick={handleScanLocal}
                    disabled={isScanning || isLoading}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[#30363D] bg-[#21262D] hover:bg-[#30363D] text-[#C9D1D9] transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#58A6FF]" /> : <FolderCode className="w-3.5 h-3.5 text-[#58A6FF]" />}
                    <span>{isScanning ? 'Scanning...' : 'Scan Path'}</span>
                  </button>
                </div>
              </div>

              {/* Local Presets */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider flex items-center gap-1 font-mono">
                  <HardDrive className="w-3 h-3 text-[#58A6FF]" />
                  <span>Quick Local Paths</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPath('./');
                      setFolderName('current-project');
                    }}
                    className="px-2.5 py-1 text-xs rounded-md border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] text-[#C9D1D9] transition font-mono cursor-pointer"
                  >
                    Current Project (<code>./</code>)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocalPath('./src');
                      setFolderName('src-directory');
                    }}
                    className="px-2.5 py-1 text-xs rounded-md border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] text-[#C9D1D9] transition font-mono cursor-pointer"
                  >
                    Source Folder (<code>./src</code>)
                  </button>
                </div>
              </div>

              {/* Scan Results Preview Card */}
              {scanResult && (
                <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D] space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[#3FB950]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Ready to Index ({scanResult.totalFiles} files detected)</span>
                    </span>
                    <span className="text-[10px] text-[#8B949E]">{scanResult.detectedLanguages.join(', ')}</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-[#8B949E]">
                    {scanResult.previewFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="truncate text-[#C9D1D9]">{f.path}</span>
                        <span className="text-[10px] text-[#8B949E] shrink-0 font-mono">
                          {Math.round(f.size / 1024)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Local Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#30363D]">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-[#8B949E] font-mono">
                    Notebook Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="e.g. my-local-service"
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                    <Filter className="w-3 h-3" />
                    <span>Path Filter (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={pathFilter}
                    onChange={(e) => setPathFilter(e.target.value)}
                    placeholder="e.g. /src or /packages"
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD LOCAL FOLDER */}
          {sourceType === 'upload' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="border-2 border-dashed border-[#30363D] hover:border-[#58A6FF] rounded-xl p-6 text-center space-y-3 bg-[#161B22]/50 transition cursor-pointer relative">
                <input
                  type="file"
                  // @ts-ignore
                  webkitdirectory=""
                  directory=""
                  multiple
                  onChange={handleFolderUpload}
                  disabled={isLoading || isReadingUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="mx-auto w-10 h-10 rounded-full bg-[#21262D] border border-[#30363D] flex items-center justify-center text-[#58A6FF]">
                  {isReadingUpload ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#F0F6FC]">
                    Click or Drag & Drop a Repository Folder
                  </h4>
                  <p className="text-[11px] text-[#8B949E] font-mono mt-1">
                    Select any project directory from your computer to index locally
                  </p>
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="p-3 rounded-lg bg-[#161B22] border border-[#30363D] space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[#3FB950]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{uploadedFiles.length} files prepared from &apos;{uploadFolderName}&apos;</span>
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] text-[#8B949E]">
                    {uploadedFiles.slice(0, 10).map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 truncate text-[#C9D1D9]">
                        <FileCode className="w-3.5 h-3.5 text-[#58A6FF] shrink-0" />
                        <span className="truncate">{f.path}</span>
                      </div>
                    ))}
                    {uploadedFiles.length > 10 && (
                      <div className="text-[10px] text-[#8B949E]">...and {uploadedFiles.length - 10} more files</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GITHUB REMOTE REPOSITORY */}
          {sourceType === 'github' && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#F0F6FC]">
                  GitHub Repository URL <span className="text-[#F85149]">*</span>
                </label>
                <input
                  id="repo-url-input"
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/pmndrs/zustand or owner/repo"
                  required
                  disabled={isLoading}
                  className="w-full px-3.5 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                />
              </div>

              {/* 1-Click Popular Demo Repos */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider flex items-center gap-1 font-mono">
                  <Sparkles className="w-3 h-3 text-[#D29922]" />
                  <span>Or pick an open-source demo</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_REPOS.map((pop) => (
                    <button
                      key={pop.name}
                      type="button"
                      onClick={() => handleSelectPopular(pop.url)}
                      disabled={isLoading}
                      className="px-2.5 py-1 text-xs rounded-md border border-[#30363D] bg-[#161B22] hover:bg-[#21262D] hover:border-[#58A6FF] text-[#C9D1D9] transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span className="font-mono text-[11px] font-medium">{pop.name}</span>
                      <span className="text-[10px] text-[#58A6FF] font-mono">({pop.badge})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Advanced Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#30363D]">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                    <GitBranch className="w-3 h-3" />
                    <span>Branch / Tag (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="e.g. main, v2.0"
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                    <Filter className="w-3 h-3" />
                    <span>Path Filter (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={pathFilter}
                    onChange={(e) => setPathFilter(e.target.value)}
                    placeholder="e.g. /src"
                    disabled={isLoading}
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label className="block text-[11px] font-medium text-[#8B949E] flex items-center gap-1 font-mono">
                  <Key className="w-3 h-3 text-[#D29922]" />
                  <span>GitHub Token (Optional for private repos or 5,000 reqs/hr)</span>
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (optional)"
                  disabled={isLoading}
                  className="w-full px-3 py-1.5 text-xs font-mono rounded-md border border-[#30363D] bg-[#161B22] text-[#F0F6FC] placeholder:text-[#484F58] focus:outline-none focus:border-[#58A6FF]"
                />
              </div>
            </div>
          )}

          {/* Strict 1-Repo Constraint Reminder */}
          <div className="p-2.5 rounded-md bg-[#161B22] border border-[#30363D] flex items-center gap-2 text-[11px] text-[#8B949E] font-mono">
            <Lock className="w-3.5 h-3.5 text-[#58A6FF] shrink-0" />
            <span>
              Strict Grounding Constraint: Notebook responses are strictly bound to this single repository.
            </span>
          </div>

          {/* Loading status */}
          {isLoading && (
            <div className="p-3 rounded-md bg-[#388BFD]/15 border border-[#388BFD]/30 flex items-center gap-3 text-xs text-[#58A6FF] font-mono">
              <RefreshCw className="w-4 h-4 animate-spin text-[#58A6FF] shrink-0" />
              <span>{stepStatus || 'Ingesting repository files and building semantic index...'}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#30363D]">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-[#8B949E] hover:bg-[#21262D] hover:text-[#C9D1D9] rounded-md transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="start-ingest-btn"
              type="submit"
              disabled={
                isLoading ||
                (sourceType === 'local' && !localPath.trim()) ||
                (sourceType === 'upload' && uploadedFiles.length === 0) ||
                (sourceType === 'github' && !repoUrl.trim())
              }
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-[#238636] hover:bg-[#2EA043] disabled:opacity-50 text-white shadow-xs transition flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Indexing Project...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ingest & Create Notebook</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
