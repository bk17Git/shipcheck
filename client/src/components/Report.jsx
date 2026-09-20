import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, AlertOctagon, Info, FileText, CheckCircle, RefreshCw, Sparkles, Filter } from 'lucide-react';
import FindingCard from './FindingCard';
import CopyMarkdown from './CopyMarkdown';
import CleanBill from './CleanBill';
import CardTilt from './CardTilt';

export default function Report({ report, onReset }) {
  if (!report || !report.findings) return null;

  if (report.findings.length === 0) {
    return <CleanBill report={report} onReset={onReset} />;
  }

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'critical' | 'high' | 'medium'

  const counts = {
    critical: report.findings.filter(f => f.severity === 'critical').length,
    high: report.findings.filter(f => f.severity === 'high').length,
    medium: report.findings.filter(f => f.severity === 'medium').length,
  };

  const severityMap = { critical: 3, high: 2, medium: 1 };
  const sortedFindings = [...report.findings].sort((a, b) => {
    return severityMap[b.severity] - severityMap[a.severity];
  });

  const filteredFindings = sortedFindings.filter(f => {
    if (activeFilter === 'all') return true;
    return f.severity === activeFilter;
  });

  const isWebsite = report.scan_type === 'website';

  return (
    <div className="w-full max-w-4xl mx-auto my-8 animate-fadeIn">
      {/* Report Header Card */}
      <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {isWebsite ? 'Live Website Audit' : 'GitHub Repo Audit'}
              </span>
              <span className="text-xs font-mono text-slate-400">
                {new Date(report.scanned_at || Date.now()).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight font-mono break-all">
              {report.repo || 'Target App'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {isWebsite ? `Bundles Inspected: ${report.files_scanned || 0}` : `Files Scanned: ${report.files_scanned || 0}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <CopyMarkdown report={{ ...report, findings: sortedFindings, counts }} />
          </div>
        </div>

        {/* Notices */}
        {report.ai_enhanced === false && (
          <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <span>Explanations are generic — our AI service is currently running in offline fallback mode.</span>
          </div>
        )}

        {report.truncated && (
          <div className="mt-4 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Notice: This repository exceeded the 400 file threshold. The first 400 source files were scanned.</span>
          </div>
        )}

        {/* 3D KPI Strip */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6">
          <CardTilt maxTilt={4} scale={1.02}>
            <button
              onClick={() => setActiveFilter(activeFilter === 'critical' ? 'all' : 'critical')}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                activeFilter === 'critical'
                  ? 'bg-red-950/30 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                  : 'bg-slate-950/50 border-slate-800 hover:border-red-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Critical</span>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-red-400 mt-1">
                {counts.critical}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Immediate action</p>
            </button>
          </CardTilt>

          <CardTilt maxTilt={4} scale={1.02}>
            <button
              onClick={() => setActiveFilter(activeFilter === 'high' ? 'all' : 'high')}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                activeFilter === 'high'
                  ? 'bg-amber-950/30 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                  : 'bg-slate-950/50 border-slate-800 hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">High</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 mt-1">
                {counts.high}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">High financial/data risk</p>
            </button>
          </CardTilt>

          <CardTilt maxTilt={4} scale={1.02}>
            <button
              onClick={() => setActiveFilter(activeFilter === 'medium' ? 'all' : 'medium')}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                activeFilter === 'medium'
                  ? 'bg-indigo-950/30 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                  : 'bg-slate-950/50 border-slate-800 hover:border-indigo-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Medium</span>
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-indigo-300 mt-1">
                {counts.medium}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Hygiene & posture</p>
            </button>
          </CardTilt>
        </div>
      </div>

      {/* Filter Controls & Count */}
      <div className="flex items-center justify-between mb-4 px-1 text-xs text-slate-400 font-mono">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span>Showing {filteredFindings.length} of {sortedFindings.length} findings</span>
        </div>
        {activeFilter !== 'all' && (
          <button
            onClick={() => setActiveFilter('all')}
            className="text-indigo-400 hover:text-indigo-300 underline"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Findings List */}
      <div className="space-y-3 mb-10">
        {filteredFindings.map((finding, idx) => (
          <FindingCard key={idx} finding={finding} />
        ))}
      </div>

      {/* Footer / Agent CTA */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/60 to-indigo-950/20 border border-slate-800 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left">
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Ready to fix these with AI?</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Copy this markdown report and paste it into Claude Code, Cursor, or Antigravity to autofix.
          </p>
        </div>
        <CopyMarkdown report={{ ...report, findings: sortedFindings, counts }} />
      </div>
    </div>
  );
}
