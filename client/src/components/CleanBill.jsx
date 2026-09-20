import React from 'react';
import { ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import CardTilt from './CardTilt';

export default function CleanBill({ report, onReset }) {
  const fileCount = report?.files_scanned || 0;
  const isWebsite = report?.scan_type === 'website';

  const checkList = isWebsite
    ? [
        "Extracted & scanned all production JavaScript bundles",
        "Checked for client-compiled API keys (OpenAI, Stripe, Google AI, Supabase)",
        "Audited HTTP security headers (CSP, HSTS, X-Frame-Options, X-Content-Type)",
        "Probed for exposed source maps (.map) & sensitive files (.env, .git/config)",
        "Tested CORS origins and SSL/TLS transport layer"
      ]
    : [
        "Audited all repository source code against 20 AST security rules",
        "Checked for hardcoded provider keys and client-exposed VITE_/NEXT_PUBLIC env vars",
        "Verified database access policies (Firestore rules & Supabase RLS)",
        "Tested endpoints for unauthenticated LLM calls & wildcard CORS",
        "Scanned for SQL injection, XSS dangerous HTML, and eval() vectors",
        "Checked for baseline security middleware (Helmet & Rate limiting)"
      ];

  return (
    <CardTilt maxTilt={3} scale={1.01} className="w-full max-w-2xl mx-auto my-10">
      <div className="p-8 sm:p-10 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/90 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.12)] backdrop-blur-xl text-center">
        {/* Animated 3D Glowing Shield */}
        <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 shadow-inner">
            <ShieldCheck className="w-10 h-10 animate-float" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight font-mono">
          Clean Bill of Health
        </h2>

        <p className="text-sm text-slate-400 max-w-md mx-auto mt-2">
          Zero vulnerabilities detected across{' '}
          <span className="font-mono text-emerald-400 font-semibold">{fileCount}</span>{' '}
          {isWebsite ? 'JavaScript bundles' : 'source files'}.
        </p>

        {/* Breakdown of checks */}
        <div className="mt-8 p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-left">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            What was verified:
          </h4>
          <ul className="space-y-2.5">
            {checkList.map((check, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>{check}</span>
              </li>
            ))}
          </ul>
        </div>

        {onReset && (
          <div className="mt-8">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:text-white transition-all shadow-md"
            >
              <span>Scan Another Target</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </CardTilt>
  );
}
