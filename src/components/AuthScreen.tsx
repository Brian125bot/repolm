import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, ShieldCheck, Cloud, Sparkles, Code2, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export function AuthScreen() {
  const { signInWithGoogle, loading, error, clearError } = useAuth();

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col justify-between text-neutral-100 selection:bg-amber-500/30 selection:text-amber-200">
      {/* Background aesthetic grid & glow */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-blue-600/10 blur-[120px] pointer-events-none rounded-full" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">RepoNotebook</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Cloud Sync
              </span>
            </div>
            <p className="text-xs text-neutral-400">Grounded Code Intelligence & Research</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5 bg-neutral-800/80 px-3 py-1.5 rounded-full border border-neutral-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Zero-Trust Firestore Security
          </span>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md bg-neutral-800/90 backdrop-blur-xl border border-neutral-700/80 rounded-2xl p-8 shadow-2xl shadow-black/60">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl shadow-blue-500/25 mb-4 ring-1 ring-white/20">
              <Code2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to RepoNotebook</h1>
            <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
              Authenticate with your Google account to access your personal notebooks, notes, and research artifacts with persistent cloud sync.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-rose-200">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="text-neutral-400 hover:text-white text-xs font-semibold underline ml-2"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            id="google-signin-btn"
            onClick={signInWithGoogle}
            disabled={loading}
            className="w-full h-12 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm transition-all duration-150 flex items-center justify-center gap-3 shadow-lg shadow-white/10 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-neutral-700" />
                <span>Signing you in...</span>
              </>
            ) : (
              <>
                {/* Google SVG Logo */}
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="h-4 w-4 text-neutral-500 ml-auto" />
              </>
            )}
          </button>

          {/* Features list */}
          <div className="mt-8 pt-6 border-t border-neutral-700/60 space-y-3.5">
            <div className="flex items-center gap-3 text-xs text-neutral-300">
              <div className="h-6 w-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <Cloud className="h-3.5 w-3.5" />
              </div>
              <span><strong>Real-time Firestore Sync</strong> — Notebooks, notes, & artifacts saved to cloud</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-neutral-300">
              <div className="h-6 w-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <span><strong>Gemini 3.7 & 3.5 Models</strong> — Grounded multi-file reasoning with line citations</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-neutral-300">
              <div className="h-6 w-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <span><strong>Private & Secure</strong> — Data isolated strictly to your authenticated UID</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 px-6 text-center text-xs text-neutral-500">
        RepoNotebook &bull; Grounded Repository Research Workspace &bull; Powered by Firebase Firestore & Google Gemini
      </footer>
    </div>
  );
}
