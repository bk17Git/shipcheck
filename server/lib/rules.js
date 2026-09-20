/**
 * Core Rule Engine for Shipcheck
 * Defines all security rules to scan files against.
 */

// Helper to get line number from index
function getLineNumber(content, index) {
  return content.substring(0, index).split('\n').length;
}

// Helper to extract matches for a regex
function getRegexMatches(regex, file) {
  const matches = [];
  let match;
  // Reset regex if it has global flag
  if (regex.global) regex.lastIndex = 0;
  
  while ((match = regex.exec(file.content)) !== null) {
    matches.push({
      line: getLineNumber(file.content, match.index),
      snippet: match[0],
    });
    if (!regex.global) break;
  }
  return matches;
}

export const rules = [
  // ==========================================
  // CRITICAL — Exposed Secrets
  // ==========================================

  {
    id: "CLIENT_EXPOSED_ENV_SECRET",
    severity: "critical",
    title: "Client-Exposed Environment Secret",
    test(file, context) {
      const matches = [];
      const lines = file.content.split('\n');
      
      const isEnvFile = file.path.includes('.env');
      
      lines.forEach((line, i) => {
        if (isEnvFile) {
          // Check for assignments in .env file
          if (/^(VITE_|NEXT_PUBLIC_|REACT_APP_)[A-Z0-9_]+\s*=\s*.+/.test(line)) {
            // Rough check for secret-like values (length > 15, alphanumeric mix)
            const val = line.split('=')[1].trim();
            if (val.length >= 16 && /[0-9]/.test(val) && /[a-zA-Z]/.test(val)) {
              matches.push({ line: i + 1, snippet: line });
            }
          }
        } else {
          // Check for usages in code
          if (/(import\.meta\.env\.VITE_|process\.env\.NEXT_PUBLIC_|process\.env\.REACT_APP_)[A-Z0-9_]+/.test(line)) {
            // Look for URL usages or direct assignments that might expose it
            if (/fetch\(|axios|api|url/i.test(line)) {
              const match = line.match(/(import\.meta\.env\.VITE_|process\.env\.NEXT_PUBLIC_|process\.env\.REACT_APP_)[A-Z0-9_]+/);
              if (match) {
                matches.push({ line: i + 1, snippet: match[0] });
              }
            }
          }
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "Environment variables with prefixes like VITE_, NEXT_PUBLIC_, or REACT_APP_ are compiled directly into the browser bundle. Anyone who opens their browser dev tools can see these values.",
      fix: "Remove the prefix if this is a real secret, and only access it on the server side (e.g. in API routes). Proxy client requests through your own backend.",
      effort: "15 minutes"
    }
  },

  {
    id: "EXPOSED_PROVIDER_KEY",
    severity: "high", // Severity escalation logic in scanner or test
    title: "Exposed API Provider Key",
    test(file) {
      const patterns = [
        /(?<!sk-ant-)sk-[A-Za-z0-9]{20,}/g, // OpenAI (not Anthropic)
        /sk-ant-[A-Za-z0-9-]{20,}/g,         // Anthropic
        /AIza[0-9A-Za-z_-]{35}/g,            // Google AI
        /[sr]k_live_[A-Za-z0-9]{20,}/g,      // Stripe live
        /AKIA[0-9A-Z]{16}/g                  // AWS
      ];
      
      const matches = [];
      for (const pattern of patterns) {
        matches.push(...getRegexMatches(pattern, file));
      }
      
      // Upgrade severity to critical if in client paths
      const isClientPath = /^(src|app|components|pages|public)\//.test(file.path);
      if (isClientPath && matches.length > 0) {
        // We can attach a temporary severity override for the scanner to read
        matches.forEach(m => m.severityOverride = "critical");
      }
      
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "A hardcoded API key was found in your code. Attackers can use this key to impersonate you, access your data, and rack up massive bills on your account.",
      fix: "Rotate this key now — it is already compromised. Then, move it to an environment variable (.env) and read it via process.env.",
      effort: "15 minutes"
    }
  },

  {
    id: "EXPOSED_SUPABASE_SERVICE_ROLE",
    severity: "high",
    title: "Exposed Supabase Service Role Key",
    test(file) {
      const matches = [];
      const regex = /eyJ[a-zA-Z0-9_-]+\.(eyJ[a-zA-Z0-9_-]+)\.[a-zA-Z0-9_-]+/g;
      
      let match;
      while ((match = regex.exec(file.content)) !== null) {
        try {
          const payload = Buffer.from(match[1], 'base64').toString('utf8');
          if (payload.includes('service_role')) {
            const result = {
              line: getLineNumber(file.content, match.index),
              snippet: match[0],
            };
            const isClientPath = /^(src|app|components|pages|public)\//.test(file.path);
            if (isClientPath) result.severityOverride = "critical";
            matches.push(result);
          }
        } catch (e) {
          // Ignore decoding errors
        }
      }
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "A Supabase service_role key was found. This key bypasses all Row Level Security (RLS) policies and gives total admin access to your database.",
      fix: "Revoke this key immediately in your Supabase dashboard. Move it to an environment variable and only use it on your secure backend.",
      effort: "15 minutes"
    }
  },

  {
    id: "GENERIC_SECRET_ASSIGNMENT",
    severity: "high",
    title: "Generic Secret Assignment",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        const match = line.match(/(?:const|let|var)\s+[A-Za-z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Za-z0-9_]*\s*=\s*(['"\`])([a-zA-Z0-9_\-\+\/]{16,})\1/i);
        if (match) {
          const val = match[2];
          // Check for entropy: mix of cases and numbers
          if (/[a-z]/.test(val) && /[A-Z]/.test(val) && /[0-9]/.test(val)) {
             // Exclude provider keys handled above roughly
             if (!val.startsWith('sk-') && !val.startsWith('AIza') && !val.startsWith('AKIA')) {
                matches.push({ line: i + 1, snippet: match[0] });
             }
          }
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "A hardcoded secret or token was found. Hardcoded secrets in source control can be extracted by anyone with access to the repo.",
      fix: "Extract this value into your environment variables.",
      effort: "5 minutes"
    }
  },

  {
    id: "COMMITTED_ENV_FILE",
    severity: "critical",
    title: "Committed Environment File",
    test(file) {
      const filename = file.path.split('/').pop();
      if (/^\.env(\.[a-zA-Z0-9_-]+)?$/.test(filename) && !filename.endsWith('.example') && !filename.endsWith('.sample')) {
        return [{ line: 1, snippet: filename }];
      }
      return [];
    },
    fallbackExplanation: {
      what_it_means: "An environment file (.env) was committed to the repository. These files usually contain highly sensitive API keys and database credentials.",
      fix: "Remove the file from version control (git rm --cached .env), add it to .gitignore, and rotate all secrets inside it.",
      effort: "an hour"
    }
  },

  {
    id: "ENV_NOT_GITIGNORED",
    severity: "medium",
    title: "Environment Files Not Gitignored",
    test(file, context) {
      // Only run once per scan (we use the first file as a trigger, or the gitignore file itself)
      if (file.path !== context.allFiles[0] && !file.path.endsWith('.gitignore')) return [];
      
      // If we already ran it for this scan, skip (heuristic to prevent duplicates)
      if (context._envNotGitignoredRan) return [];
      
      context._envNotGitignoredRan = true;

      if (!context.gitignoreContent || !context.gitignoreContent.includes('.env')) {
        return [{ line: 1, snippet: '.gitignore missing .env' }];
      }
      
      return [];
    },
    fallbackExplanation: {
      what_it_means: "Your .gitignore file does not prevent .env files from being committed. This is a massive risk for accidentally leaking secrets.",
      fix: "Add '.env*' to your .gitignore file.",
      effort: "2 minutes"
    }
  },

  // ==========================================
  // CRITICAL — Open Data Access
  // ==========================================

  {
    id: "FIRESTORE_OPEN_RULES",
    severity: "critical",
    title: "Firestore Open Rules",
    test(file) {
      if (!file.path.endsWith('firestore.rules') && !file.path.endsWith('storage.rules')) return [];
      return getRegexMatches(/allow\s+(read|write|read,\s*write).*:\s*if\s+true/g, file);
    },
    fallbackExplanation: {
      what_it_means: "Your Firestore rules allow unauthenticated read and/or write access to anyone. Attackers can steal, modify, or delete your entire database.",
      fix: "Restrict access by changing 'if true' to check for authentication (e.g., 'if request.auth != null').",
      effort: "15 minutes"
    }
  },

  {
    id: "SUPABASE_MISSING_RLS",
    severity: "critical",
    title: "Supabase Missing Row Level Security",
    test(file) {
      if (!file.path.endsWith('.sql')) return [];
      
      const matches = [];
      const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi;
      let match;
      
      while ((match = createTableRegex.exec(file.content)) !== null) {
        const tableName = match[1];
        const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        if (!rlsRegex.test(file.content)) {
          matches.push({
            line: getLineNumber(file.content, match.index),
            snippet: match[0],
            extraContext: `Table ${tableName} is missing RLS.`
          });
        }
      }
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "A table was created without enabling Row Level Security (RLS). In Supabase, this means anyone using the anon key can read/write all data in this table.",
      fix: "Add an 'ALTER TABLE your_table ENABLE ROW LEVEL SECURITY' statement.",
      effort: "15 minutes"
    }
  },

  {
    id: "SUPABASE_OPEN_POLICY",
    severity: "critical",
    title: "Supabase Open Policy",
    test(file) {
      if (!file.path.endsWith('.sql')) return [];
      return getRegexMatches(/using\s*\(\s*true\s*\)/gi, file);
    },
    fallbackExplanation: {
      what_it_means: "A policy was found that uses 'using (true)'. This explicitly grants full access to anyone, bypassing security constraints.",
      fix: "Modify the policy to check auth.uid() or specific role requirements.",
      effort: "15 minutes"
    }
  },

  {
    id: "MONGODB_OPEN_ACCESS",
    severity: "critical",
    title: "MongoDB Open Access",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        // Match mongo URIs without auth
        if (/mongodb(?:\+srv)?:\/\/(?!.*:.*@)[a-zA-Z0-9.-]+/.test(line)) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
        // Match 0.0.0.0 or bindIpAll which opens port to world
        if (/(bindIp:\s*['"]?0\.0\.0\.0['"]?|bindIpAll:\s*true)/.test(line) && file.path.includes('mongod.conf')) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "Your database is accessible without credentials or exposed to the public internet.",
      fix: "Ensure your MongoDB connection string includes a username and password, and do not bind to 0.0.0.0 in production.",
      effort: "15 minutes"
    }
  },

  // ==========================================
  // HIGH — Unprotected Expensive Endpoints
  // ==========================================

  {
    id: "UNPROTECTED_LLM_ENDPOINT",
    severity: "high",
    title: "Unprotected LLM Endpoint",
    test(file) {
      if (!/\.(js|ts|mjs|jsx|tsx)$/.test(file.path)) return [];
      
      const content = file.content;
      const hasRoute = /(app|router)\.(post|get|put|delete|patch)\(|export\s+(async\s+)?function\s+(POST|GET|PUT|DELETE|PATCH)\s*\(/.test(content);
      const hasLLMCall = /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|openai\.chat|anthropic\.messages|model\.generateContent/.test(content);
      const hasAuth = /authenticate|requireAuth|isAuthenticated|verifyToken|authMiddleware|session|jwt/i.test(content);
      const hasRateLimit = /rateLimit|rateLimiter|rate-limit|throttle/i.test(content);
      
      if (hasRoute && hasLLMCall && !hasAuth && !hasRateLimit) {
        return [{ line: 1, snippet: "Unprotected LLM route detected in file" }];
      }
      return [];
    },
    fallbackExplanation: {
      what_it_means: "An endpoint that calls an LLM (OpenAI, Anthropic, etc.) was found without authentication or rate limiting. Attackers can spam this endpoint and cost you thousands of dollars.",
      fix: "Add an authentication middleware or a strict rate limiter to this route.",
      effort: "15 minutes"
    }
  },

  {
    id: "CORS_WILDCARD_MUTATION",
    severity: "high",
    title: "CORS Wildcard Mutation",
    test(file) {
      const content = file.content;
      const hasWildcardCors = /origin:\s*["']\*["']|cors\(\s*\)/.test(content);
      const hasMutation = /(app|router)\.(post|put|delete|patch)\(|api\.openai\.com|openai\.chat/.test(content);
      
      if (hasWildcardCors && hasMutation) {
        const matches = getRegexMatches(/origin:\s*["']\*["']|cors\(\s*\)/g, file);
        return matches;
      }
      return [];
    },
    fallbackExplanation: {
      what_it_means: "Your server accepts Cross-Origin Resource Sharing (CORS) requests from any domain ('*') on endpoints that modify data or cost money. Malicious websites can force users to make requests to your API.",
      fix: "Set the CORS 'origin' to your specific frontend domain(s) instead of '*'.",
      effort: "5 minutes"
    }
  },

  // ==========================================
  // HIGH — Injection
  // ==========================================

  {
    id: "SQL_INJECTION",
    severity: "high",
    title: "Potential SQL Injection",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        // Look for SQL keywords in template literals with interpolation or concat
        if (/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i.test(line)) {
          if (/`[^`]*\$\{[^}]+\}[^`]*`/.test(line) || /['"].*['"]\s*\+\s*[a-zA-Z_$]/.test(line)) {
            matches.push({ line: i + 1, snippet: line.trim() });
          }
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "You are constructing SQL queries by directly concatenating variables. An attacker can input malicious SQL (e.g. 'OR 1=1') to bypass auth or drop tables.",
      fix: "Use parameterized queries (e.g. `$1`, `?`) provided by your database driver instead of string interpolation.",
      effort: "15 minutes"
    }
  },

  {
    id: "XSS_DANGEROUS_HTML",
    severity: "high",
    title: "XSS via Dangerous HTML",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        // Look for dangerouslySetInnerHTML or v-html with a variable (not literal string)
        if (/dangerouslySetInnerHTML=\{\s*\{\s*__html\s*:\s*(?!['"`])[^}]+\}\s*\}/.test(line) || /v-html=["'](?!['"`])[^"']+["']/.test(line)) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "You are injecting raw HTML from a variable. If this variable contains user input, attackers can execute malicious JavaScript in other users' browsers (Cross-Site Scripting).",
      fix: "Sanitize the HTML using a library like DOMPurify before rendering it, or render it as text.",
      effort: "15 minutes"
    }
  },

  {
    id: "EVAL_NON_LITERAL",
    severity: "high",
    title: "Dangerous Eval",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        // Catch eval or new Function with variables
        if (/eval\(\s*(?!['"`])[^)]+\s*\)/.test(line) || /new\s+Function\(\s*(?!['"`])[^)]+\s*\)/.test(line)) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "You are using `eval()` or `new Function()` with dynamic inputs. Attackers can inject arbitrary JavaScript code that executes with your app's privileges.",
      fix: "Never use eval(). Find an alternative way to parse or evaluate the data (like JSON.parse).",
      effort: "15 minutes"
    }
  },

  {
    id: "SHELL_INJECTION",
    severity: "high",
    title: "Shell Command Injection",
    test(file) {
      const content = file.content;
      if (!/child_process/.test(content)) return [];
      
      const matches = [];
      const lines = content.split('\n');
      
      lines.forEach((line, i) => {
        if (/(exec|execSync|spawn|spawnSync)\s*\(\s*(`[^`]*\$\{[^}]+\}[^`]*`|[^,]+?\s*\+)/.test(line)) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "You are executing system commands using concatenated strings. Attackers can append their own commands (e.g. `; rm -rf /`) and hijack your server.",
      fix: "Use `execFile` or `spawn` with an array of arguments, never a single concatenated string.",
      effort: "15 minutes"
    }
  },

  // ==========================================
  // MEDIUM
  // ==========================================

  {
    id: "NO_RATE_LIMITING",
    severity: "medium",
    title: "Missing Rate Limiting",
    test(file) {
      const content = file.content;
      const isExpressEntry = /express\(\)/.test(content) && /\.listen\(/.test(content);
      
      if (isExpressEntry) {
        const hasRateLimit = /rateLimit|express-rate-limit|rate-limit|throttle/.test(content);
        if (!hasRateLimit) {
          return [{ line: 1, snippet: "express() app missing rate limiting" }];
        }
      }
      return [];
    },
    fallbackExplanation: {
      what_it_means: "Your Express application does not seem to have rate limiting configured. Attackers can brute force passwords or launch Denial of Service (DoS) attacks easily.",
      fix: "Install and configure `express-rate-limit` on your main app router.",
      effort: "5 minutes"
    }
  },

  {
    id: "STACK_TRACE_LEAK",
    severity: "medium",
    title: "Stack Trace Leak",
    test(file) {
      const matches = [];
      const lines = file.content.split('\n');
      
      lines.forEach((line, i) => {
        if (/res\.(json|send|status\([0-9]+\)\.json)\(.*(err|error)\.stack/.test(line)) {
          matches.push({ line: i + 1, snippet: line.trim() });
        }
      });
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "Your error handler is sending detailed stack traces to the client. This exposes your internal directory structure and dependencies to attackers.",
      fix: "Only send generic error messages in production. Keep stack traces in your server logs.",
      effort: "5 minutes"
    }
  },

  {
    id: "MISSING_HELMET",
    severity: "medium",
    title: "Missing Helmet",
    test(file) {
      const content = file.content;
      const isExpressEntry = /express\(\)/.test(content) && /\.listen\(/.test(content);
      
      if (isExpressEntry) {
        const hasHelmet = /helmet/.test(content);
        if (!hasHelmet) {
          return [{ line: 1, snippet: "express() app missing helmet middleware" }];
        }
      }
      return [];
    },
    fallbackExplanation: {
      what_it_means: "Your Express app is missing standard HTTP security headers provided by Helmet.",
      fix: "Install `helmet` and add `app.use(helmet())`.",
      effort: "2 minutes"
    }
  },

  {
    id: "CLIENT_ONLY_AUTH",
    severity: "medium",
    title: "Client-Only Authentication",
    test(file) {
      if (!/\.(jsx|tsx)$/.test(file.path)) return [];
      
      const matches = [];
      const content = file.content;
      
      if (/(Navigate|redirect|useAuth|isAuthenticated|PrivateRoute|ProtectedRoute|RequireAuth)/.test(content)) {
        matches.push({ line: 1, snippet: "Client-side auth pattern detected" });
      }
      return matches;
    },
    fallbackExplanation: {
      what_it_means: "You are using client-side routing logic for authentication. This hides UI elements but does NOT protect your data.",
      fix: "Ensure that all API endpoints that supply data to these protected routes also enforce authentication.",
      effort: "an hour"
    }
  }

];
