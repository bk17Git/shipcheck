import React, { useState } from 'react';
import { Shield, Lock, Zap, Eye, GitBranch, Globe, Scan, ChevronDown } from 'lucide-react';
import ScanForm from './components/ScanForm';
import ScanProgress from './components/ScanProgress';
import Report from './components/Report';
import ErrorState from './components/ErrorState';
import { scanRepo } from './lib/api';

const EXAMPLE_REPORT = {
  scan_type: 'repo',
  repo: 'sample-user/ai-todo-app',
  scanned_at: new Date().toISOString(),
  files_scanned: 24,
  truncated: false,
  ai_enhanced: true,
  summary: { critical: 2, high: 2, medium: 1 },
  findings: [
    {
      id: 'CLIENT_EXPOSED_ENV_SECRET',
      severity: 'critical',
      title: 'Client-Exposed Environment Secret',
      file: 'src/App.jsx',
      line: 4,
      snippet_redacted: 'const API_KEY = import.meta.env.VITE_••••••••4f2c;',
      what_it_means: 'This API key is compiled directly into your client bundle. Anyone visiting your website can inspect network traffic or source code and steal it.',
      fix: 'Rotate this key now — it is already compromised. Deleting it from the repo is not enough, it\'s in the git history. Remove the VITE_ prefix and move all AI calls to a serverless function or backend API.',
      effort: '15 minutes'
    },
    {
      id: 'FIRESTORE_OPEN_RULES',
      severity: 'critical',
      title: 'Firestore Open Rules',
      file: 'firestore.rules',
      line: 5,
      snippet_redacted: 'allow read, write: if true;',
      what_it_means: 'Your database is publicly readable and writable by anyone on the internet without logging in. Attackers can wipe or download all your customer data.',
      fix: 'Update firestore.rules to require authentication: change `if true;` to `if request.auth != null;` and enforce user ownership of documents.',
      effort: '15 minutes'
    },
    {
      id: 'UNPROTECTED_LLM_ENDPOINT',
      severity: 'high',
      title: 'Unprotected LLM Endpoint',
      file: 'server/api/chat.js',
      line: 12,
      snippet_redacted: 'app.post("/api/chat", async (req, res) => { ... })',
      what_it_means: 'Anyone can loop this endpoint without logging in and spend your money on OpenAI/Gemini credits until your account limit is drained.',
      fix: 'Add authentication middleware before this route and set up a rate limiter like express-rate-limit to restrict requests per IP or user.',
      effort: '15 minutes'
    },
    {
      id: 'SQL_INJECTION',
      severity: 'high',
      title: 'Potential SQL Injection',
      file: 'server/db.js',
      line: 8,
      snippet_redacted: 'const query = `SELECT * FROM users WHERE email = \'••••••••\'`;',
      what_it_means: 'An attacker can input malicious characters into the email field to bypass login checks, extract passwords, or delete database tables.',
      fix: 'Use parameterized queries ($1, ?) instead of string templates. Example: pool.query("SELECT * FROM users WHERE email = $1", [email]).',
      effort: '15 minutes'
    },
    {
      id: 'MISSING_HELMET',
      severity: 'medium',
      title: 'Missing Security Headers (Helmet)',
      file: 'server/index.js',
      line: 1,
      snippet_redacted: 'express() app missing helmet middleware',
      what_it_means: 'Your server is missing baseline HTTP protection headers against clickjacking, MIME sniffing, and cross-site scripting.',
      fix: 'Run `npm install helmet` and add `app.use(helmet())` near the top of your Express app setup.',
      effort: '2 minutes'
    }
  ]
};

function App() {
  const [state, setState] = useState('idle');
  const [url, setUrl] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    if (!url.trim()) return;
    
    setState('scanning');
    setError(null);
    setReport(null);

    try {
      const result = await scanRepo(url);
      setReport(result);
      setState('report');
    } catch (err) {
      setError({
        type: err.type || 'UNKNOWN',
        message: err.message || err.error || 'An unexpected error occurred during the scan.',
      });
      setState('error');
    }
  };

  const handleRetry = () => {
    handleScan();
  };

  const handleShowExample = () => {
    setUrl('github.com/sample-user/ai-todo-app');
    setError(null);
    setReport(EXAMPLE_REPORT);
    setState('report');
  };

  const handleReset = () => {
    setUrl('');
    setReport(null);
    setError(null);
    setState('idle');
  };

  const currentScanType = url.includes('github.com') ? 'repo' : 'website';

  return (
    <div className="min-h-screen bg-[#08090f] text-slate-100 font-sans relative overflow-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Layered background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.08]"
        style={{
          backgroundImage: 'radial-gradient(#818cf8 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Top glow */}
      <div className="absolute -top-60 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent blur-[140px] pointer-events-none" />

      {/* Bottom accent glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-gradient-to-t from-indigo-900/10 to-transparent blur-[100px] pointer-events-none" />

      {/* Navigation */}
      <header className="relative z-20 border-b border-slate-800/60 bg-[#08090f]/80 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            onClick={handleReset} 
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 group-hover:scale-105 transition-all duration-200">
              <Shield className="w-[18px] h-[18px]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[15px] tracking-tight text-white font-mono">
                Shipcheck
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 font-sans font-medium">
                v2.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800/80">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="font-mono text-[11px]">34 Rules Active</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero data logged</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Animated Shield Icon */}
          <div className="relative mb-8">
            {/* Outer ring pulse */}
            <div className="absolute inset-0 -m-4 rounded-full border border-indigo-500/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite] opacity-40" />
            <div className="absolute inset-0 -m-2 rounded-full border border-indigo-500/10 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite_0.5s] opacity-30" />
            
            {/* Shield glow background */}
            <div className="absolute inset-0 -m-6 bg-indigo-500/10 rounded-full blur-2xl animate-pulse-slow" />
            
            {/* Main shield container */}
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-indigo-600/10 border border-indigo-500/30 flex items-center justify-center backdrop-blur-sm shadow-2xl shadow-indigo-500/20">
              <Shield className="w-9 h-9 text-indigo-400 animate-float" />
              
              {/* Scan line animation */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent animate-scan" />
              </div>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15]">
              <span className="text-slate-100">Ship with confidence.</span>
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
                Scan before you deploy.
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
              Paste a GitHub repo or live URL. We catch the secret leaks, open databases, 
              and unprotected AI routes that vibe-coded apps ship with.
            </p>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[
              { icon: GitBranch, label: 'GitHub Repos', color: 'text-emerald-400' },
              { icon: Globe, label: 'Live Websites', color: 'text-sky-400' },
              { icon: Eye, label: 'Secret Detection', color: 'text-red-400' },
              { icon: Zap, label: 'AI Explanations', color: 'text-amber-400' },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-300 font-medium hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-200 cursor-default"
              >
                <Icon className={`w-3 h-3 ${color}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Product Hunt Featured Badge */}
          <div className="mt-6 flex justify-center">
            <a
              href="https://www.producthunt.com/products/shipcheck-4?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-shipcheck-4"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform hover:scale-105 active:scale-95"
            >
              <img
                alt="Shipcheck - Pre-flight security scanner for vibe-coded apps | Product Hunt"
                width="250"
                height="54"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1256462&theme=dark&t=1789927837516"
                className="h-11 w-auto rounded-xl shadow-lg shadow-black/50 border border-slate-800/60 hover:border-indigo-500/40 transition-colors"
              />
            </a>
          </div>
        </div>

        {/* Input Bar */}
        <ScanForm 
          url={url} 
          onUrlChange={setUrl} 
          onScan={handleScan} 
          onShowExample={handleShowExample}
          disabled={state === 'scanning'} 
        />

        {/* Dynamic State Views */}
        {state === 'scanning' && (
          <ScanProgress scanType={currentScanType} />
        )}
        
        {state === 'report' && report && (
          <Report report={report} onReset={handleReset} />
        )}
        
        {state === 'error' && error && (
          <ErrorState error={error} onRetry={handleRetry} />
        )}

        {/* Scroll hint when idle */}
        {state === 'idle' && (
          <div className="mt-16 flex flex-col items-center gap-6 animate-fadeIn">
            {/* How it works */}
            <div className="w-full max-w-3xl">
              <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 mb-8">How it works</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    step: '01',
                    icon: Scan,
                    title: 'Paste your target',
                    desc: 'A public GitHub repo URL or any live website.',
                  },
                  {
                    step: '02',
                    icon: Shield,
                    title: '34 rules scan instantly',
                    desc: 'AST analysis, header audits, bundle inspection, secret detection.',
                  },
                  {
                    step: '03',
                    icon: Zap,
                    title: 'Get AI-powered fixes',
                    desc: 'Plain-English explanations with copy-paste remediation steps.',
                  },
                ].map(({ step, icon: Icon, title, desc }) => (
                  <div
                    key={step}
                    className="group relative p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-mono font-bold text-indigo-500/60">{step}</span>
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/15 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">{title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                No code stored
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                No accounts required
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-3 h-3" />
                All secrets redacted
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900/80 mt-20 py-8 text-center text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono">Shipcheck • Privacy-first ephemeral scanner • No accounts • No persistent data</p>
          <div className="flex items-center gap-4 text-slate-400">
            <button 
              onClick={handleShowExample} 
              className="hover:text-indigo-400 transition-colors font-medium"
            >
              Demo Report
            </button>
            <span className="text-slate-700">•</span>
            <span className="text-slate-500 font-mono">Redaction: 4••••4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
