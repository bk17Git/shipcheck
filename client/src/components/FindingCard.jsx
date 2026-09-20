import React, { useState } from 'react';
import { ChevronDown, AlertTriangle, AlertOctagon, Info, Clock, Copy, Check, Terminal } from 'lucide-react';
import CardTilt from './CardTilt';

export default function FindingCard({ finding, defaultExpanded }) {
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded !== undefined ? defaultExpanded : finding.severity === 'critical'
  );
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const handleCopySnippet = (e) => {
    e.stopPropagation();
    if (!finding.snippet_redacted) return;
    navigator.clipboard.writeText(finding.snippet_redacted);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const severityConfig = {
    critical: {
      badge: 'bg-red-500/15 text-red-400 border-red-500/30',
      border: 'border-l-red-500',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.12)]',
      icon: <AlertOctagon className="w-4 h-4 text-red-400" />,
      tag: 'Critical Risk',
    },
    high: {
      badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      border: 'border-l-amber-500',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
      tag: 'High Risk',
    },
    medium: {
      badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      border: 'border-l-indigo-500',
      glow: 'shadow-[0_0_20px_rgba(99,102,241,0.08)]',
      icon: <Info className="w-4 h-4 text-indigo-400" />,
      tag: 'Medium Risk',
    },
  };

  const config = severityConfig[finding.severity] || severityConfig.medium;

  return (
    <CardTilt maxTilt={2} scale={1.005} className="mb-4">
      <div
        className={`rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800/80 border-l-4 ${config.border} ${config.glow} overflow-hidden transition-all duration-300 hover:border-slate-700`}
      >
        {/* Card Header (Always visible) */}
        <div
          className="px-5 py-4 cursor-pointer flex items-start justify-between gap-3 hover:bg-slate-800/20 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${config.badge}`}>
                {config.icon}
                <span>{config.tag}</span>
              </span>
              <h3 className="text-base font-semibold text-slate-100 tracking-tight">
                {finding.title}
              </h3>
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-1">
              <span className="text-slate-500">File:</span>
              <span className="text-indigo-300/90 hover:underline">
                {finding.file}{finding.line > 0 ? `:${finding.line}` : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mt-1 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
            aria-label={isExpanded ? 'Collapse card' : 'Expand card'}
          >
            <ChevronDown
              className={`w-5 h-5 transform transition-transform duration-300 ${
                isExpanded ? 'rotate-180 text-indigo-400' : ''
              }`}
            />
          </button>
        </div>

        {/* Collapsible Body */}
        {isExpanded && (
          <div className="px-5 pb-5 pt-3 border-t border-slate-800/60 space-y-4">
            {/* What it means */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <span>What it means</span>
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed">
                {finding.what_it_means}
              </p>
            </div>

            {/* Redacted Snippet */}
            {finding.snippet_redacted && (
              <div className="rounded-xl bg-[#060810] border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/60 border-b border-slate-800/70 text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Matched Snippet (Redacted)</span>
                  </div>
                  <button
                    onClick={handleCopySnippet}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    {copiedSnippet ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-emerald-400/90 overflow-x-auto leading-relaxed selection:bg-indigo-500/40">
                  <code>{finding.snippet_redacted}</code>
                </pre>
              </div>
            )}

            {/* How to fix */}
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70">
              <h4 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1.5">
                Recommended Fix
              </h4>
              <p className="text-sm text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
                {finding.fix}
              </p>
            </div>

            {/* Effort Badge */}
            <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Estimated remediation effort:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-sans font-medium">
                  {finding.effort}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </CardTilt>
  );
}
