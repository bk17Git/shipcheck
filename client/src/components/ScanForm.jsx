import React from 'react';
import { Search, ArrowRight, Globe, Sparkles } from 'lucide-react';

const GithubIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export default function ScanForm({ url, onUrlChange, onScan, onShowExample, disabled }) {
  const isGithub = url.includes('github.com');
  const isWeb = url.startsWith('http://') || url.startsWith('https://');

  const setSampleRepo = () => {
    onUrlChange('github.com/vibe-builder/ai-chat-saas');
  };

  const setSampleWeb = () => {
    onUrlChange('https://vibe-showcase.vercel.app');
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-6 animate-fadeIn" style={{ animationDelay: '100ms' }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim() && !disabled) onScan();
        }}
        className="relative group p-[2px] rounded-2xl bg-gradient-to-b from-slate-700/50 via-slate-800/30 to-slate-900/50 shadow-2xl transition-all duration-300 focus-within:from-indigo-500/40 focus-within:via-indigo-600/20 focus-within:to-slate-900/50 focus-within:shadow-[0_0_40px_rgba(99,102,241,0.15)]"
      >
        <div className="flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-[14px] bg-[#0c0e18] backdrop-blur-xl">
          <div className="flex items-center gap-2.5 pl-3.5 pr-2 w-full sm:w-auto text-slate-400">
            {isGithub ? (
              <GithubIcon className="w-5 h-5 text-indigo-400" />
            ) : isWeb ? (
              <Globe className="w-5 h-5 text-indigo-400" />
            ) : (
              <Search className="w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            )}
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="github.com/owner/repo or https://your-app.com"
            disabled={disabled}
            className="flex-1 w-full bg-transparent px-2 py-3.5 text-sm sm:text-base font-mono text-slate-100 placeholder:text-slate-500 placeholder:font-sans focus:outline-none disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={disabled || !url.trim()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.97] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-200"
          >
            <span>Scan Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Quick Actions & Demo Links */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 px-2">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span className="text-slate-500 text-[11px]">Quick tests:</span>
          <button
            type="button"
            onClick={setSampleRepo}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 hover:text-slate-200 text-slate-400 transition-all font-mono text-[11px]"
          >
            <GithubIcon className="w-3 h-3" />
            ai-chat-saas
          </button>
          <button
            type="button"
            onClick={setSampleWeb}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 hover:text-slate-200 text-slate-400 transition-all font-mono text-[11px]"
          >
            <Globe className="w-3 h-3" />
            vibe-showcase.vercel.app
          </button>
        </div>

        {onShowExample && (
          <button
            type="button"
            onClick={onShowExample}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors group text-[11px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
            <span>See example report</span>
          </button>
        )}
      </div>
    </div>
  );
}
