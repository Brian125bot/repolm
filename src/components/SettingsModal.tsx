import React, { useState } from 'react';
import { Key, X, Check, Shield, ExternalLink } from 'lucide-react';
import { saveGitHubToken } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedToken: string;
  onTokenUpdated: (token: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  savedToken,
  onTokenUpdated,
}) => {
  const [token, setToken] = useState(savedToken);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveGitHubToken(token.trim());
    onTokenUpdated(token.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    saveGitHubToken('');
    setToken('');
    onTokenUpdated('');
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        id="settings-modal-content"
        className="bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-[#C9D1D9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#30363D] bg-[#161B22]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-[#21262D] border border-[#30363D] text-[#D29922]">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#F0F6FC]">
                GitHub API Settings
              </h3>
              <p className="text-xs text-[#8B949E] font-mono">
                Configure credentials for private repos and higher rate limits
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

        <form onSubmit={handleSave} className="p-5 space-y-4 bg-[#0D1117]">
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
              Tokens are stored securely in your local browser session and passed only in requests to GitHub API endpoints.
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
                  onClick={handleClear}
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
      </div>
    </div>
  );
};
