import React, { useState, useEffect } from 'react';
import { CheckCircle2, Loader2, Shield, Radio, Terminal } from 'lucide-react';

export default function ScanProgress({ scanType = 'repo' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setElapsed((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const repoSteps = [
    { label: "Connecting to GitHub & fetching file tree...", completedAt: 2.5, detail: "Enumerating blobs and filtering binary files" },
    { label: "Scanning files through 20 AST security rules...", completedAt: 6.5, detail: "Auditing exposed API keys, Firestore rules & injections" },
    { label: "Compiling plain-English security report...", completedAt: Infinity, detail: "Formulating risk explanations and remediation diffs" },
  ];

  const websiteSteps = [
    { label: "Fetching live website & extracting DOM scripts...", completedAt: 2.0, detail: "Inspecting <script> tags and modulepreloads" },
    { label: "Downloading & parsing production JS bundles...", completedAt: 4.5, detail: "Scanning client bundle for baked API keys and secrets" },
    { label: "Probing security headers & sensitive endpoints...", completedAt: 7.0, detail: "Auditing CSP, HSTS, .map source maps, and /.env probes" },
    { label: "Generating plain-English security report...", completedAt: Infinity, detail: "Finalizing risk ratings and fix steps" },
  ];

  const steps = scanType === 'website' ? websiteSteps : repoSteps;

  return (
    <div className="w-full max-w-xl mx-auto my-10 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-slate-800 shadow-2xl backdrop-blur-xl">
      {/* Top Telemetry Header */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-800/80 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Radio className="w-4 h-4 animate-pulse" />
            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <span>Security Audit in Progress</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {scanType.toUpperCase()}
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Elapsed: {elapsed.toFixed(1)}s
            </p>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span>live-stream</span>
        </div>
      </div>

      {/* Stepped Checklist */}
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = elapsed >= step.completedAt;
          const isPreviousCompleted = index === 0 || elapsed >= steps[index - 1].completedAt;
          const isActive = !isCompleted && isPreviousCompleted;

          return (
            <div
              key={index}
              className={`flex items-start gap-3.5 p-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-indigo-950/30 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                  : isCompleted
                  ? 'bg-slate-900/40 border border-slate-800/40 opacity-80'
                  : 'opacity-35'
              }`}
            >
              <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800/50 flex items-center justify-center text-[10px] text-slate-500 font-mono">
                    {index + 1}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${isActive ? 'text-indigo-200' : isCompleted ? 'text-slate-200' : 'text-slate-400'}`}>
                  {step.label}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800/60 text-center">
        <p className="text-xs text-slate-500">
          This usually takes 5 to 15 seconds depending on repository size.
        </p>
      </div>
    </div>
  );
}
