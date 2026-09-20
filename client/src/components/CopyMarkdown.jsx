import React, { useState } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

export default function CopyMarkdown({ report }) {
  const [copied, setCopied] = useState(false);

  const generateMarkdown = () => {
    const date = new Date(report.scanned_at || Date.now()).toLocaleString();
    const counts = report.counts || {
      critical: report.findings.filter((f) => f.severity === 'critical').length,
      high: report.findings.filter((f) => f.severity === 'high').length,
      medium: report.findings.filter((f) => f.severity === 'medium').length,
    };

    let md = `# Shipcheck Security Report: ${report.repo || 'Repository'}\n`;
    md += `Scan Type: ${report.scan_type === 'website' ? 'Live Website Scan' : 'GitHub Repository Scan'}\n`;
    md += `Scanned at: ${date}\n`;
    md += `Files/Bundles Inspected: ${report.files_scanned || 0}\n\n`;

    md += `## Vulnerability Summary\n`;
    md += `- Critical: ${counts.critical}\n`;
    md += `- High: ${counts.high}\n`;
    md += `- Medium: ${counts.medium}\n\n`;

    md += `## Findings & Remediation Instructions for Coding Agent\n`;
    md += `Please review and systematically resolve each finding below. For critical key leaks, ensure secrets are rotated and removed from the client bundle.\n\n`;

    report.findings.forEach((f, index) => {
      md += `### ${index + 1}. [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `**File:** \`${f.file}${f.line > 0 ? `:${f.line}` : ''}\`\n`;
      if (f.snippet_redacted) {
        md += `**Snippet:** \`${f.snippet_redacted}\`\n`;
      }
      md += `**Impact:** ${f.what_it_means}\n`;
      md += `**Fix Instructions:** ${f.fix}\n`;
      md += `**Estimated Effort:** ${f.effort}\n\n`;
    });

    return md;
  };

  const handleCopy = async () => {
    try {
      const md = generateMarkdown();
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error('Failed to copy markdown report', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-medium transition-all duration-200 shadow-md ${
        copied
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Report Copied as Markdown!</span>
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Copy for AI Coding Agent</span>
        </>
      )}
    </button>
  );
}
