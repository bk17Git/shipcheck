import React from 'react';
import { Globe, AlertCircle, Clock, RotateCcw, ShieldOff } from 'lucide-react';
import CardTilt from './CardTilt';

export default function ErrorState({ error, onRetry }) {
  let icon, title, message, advice;

  switch (error?.type) {
    case 'SITE_NOT_REACHABLE':
      icon = <Globe className="w-7 h-7 text-amber-400" />;
      title = "Target Website Unreachable";
      message = "Can't reach that site. Check the URL and make sure it's online.";
      advice = "Verify the target website responds over HTTP/HTTPS and is accessible from the public internet.";
      break;

    case 'REPO_NOT_FOUND':
    case 'BAD_URL':
      icon = <ShieldOff className="w-7 h-7 text-amber-400" />;
      title = "Repository Inaccessible or Bad URL";
      message = "Can't reach that repo. It needs to be public. Check the URL.";
      advice = "Shipcheck only scans public repositories. Ensure the repository exists and is set to public visibility.";
      break;

    case 'GITHUB_RATE_LIMITED':
      icon = <Clock className="w-7 h-7 text-amber-400" />;
      title = "GitHub Rate Limit Reached";
      message = "GitHub is throttling us. Try again in a few minutes.";
      advice = "Unauthenticated GitHub API calls are capped at 60/hr. Set a GITHUB_TOKEN on your server to raise limits to 5,000/hr.";
      break;

    default:
      icon = <AlertCircle className="w-7 h-7 text-slate-400" />;
      title = "Audit Interrupted";
      message = error?.message || error?.error || "An unexpected error occurred during the scan.";
      advice = "Please check your network connection and verify the target endpoint.";
  }

  return (
    <CardTilt maxTilt={3} scale={1.01} className="w-full max-w-md mx-auto my-10">
      <div className="p-7 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.08)] backdrop-blur-xl text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
          {icon}
        </div>

        <h3 className="text-lg font-bold text-slate-100 font-mono mb-2">
          {title}
        </h3>

        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          {message}
        </p>

        <p className="text-xs text-slate-500 mb-6 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          {advice}
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    </CardTilt>
  );
}
