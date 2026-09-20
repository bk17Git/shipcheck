// server/lib/website-rules.js

export const websiteRules = [
  {
    id: 'BUNDLE_EXPOSED_KEY',
    severity: 'critical',
    title: 'Exposed API Key in Client JavaScript',
    test: (data) => {
      const findings = [];
      const patterns = [
        { name: 'OpenAI', regex: /sk-(?!ant-)[A-Za-z0-9]{20,}/g },
        { name: 'Anthropic', regex: /sk-ant-[A-Za-z0-9-]{20,}/g },
        { name: 'Google AI', regex: /AIza[0-9A-Za-z_-]{35}/g },
        { name: 'Stripe Live', regex: /(?:sk_live_|rk_live_)[A-Za-z0-9]{20,}/g },
        { name: 'AWS', regex: /AKIA[0-9A-Z]{16}/g }
      ];

      for (const bundle of data.bundles || []) {
        for (const { name, regex } of patterns) {
          let match;
          while ((match = regex.exec(bundle.content)) !== null) {
            findings.push({
              file: bundle.url,
              line: 0,
              snippet: match[0]
            });
          }
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'An API key was found in your deployed JavaScript. Anyone viewing your site can open browser DevTools and copy this key.',
      fix: 'Rotate this key now — it is already compromised. Move the code that uses this key to a backend server or serverless function.',
      effort: 'Medium'
    }
  },
  {
    id: 'BUNDLE_SUPABASE_SERVICE_ROLE',
    severity: 'critical',
    title: 'Exposed Supabase Service Role Key',
    test: (data) => {
      const findings = [];
      const jwtRegex = /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;

      for (const bundle of data.bundles || []) {
        let match;
        while ((match = jwtRegex.exec(bundle.content)) !== null) {
          try {
            const payloadBase64 = match[0].split('.')[1];
            // Decode base64url
            const payloadString = Buffer.from(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
            if (payloadString.includes('"service_role"')) {
              findings.push({
                file: bundle.url,
                line: 0,
                snippet: match[0]
              });
            }
          } catch (e) {
            // Ignore decoding errors
          }
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'A Supabase service_role JWT was found in your deployed JavaScript. This key bypasses Row Level Security and gives full admin access to your database.',
      fix: 'Rotate this key now — it is already compromised. Only use the anon key in client-side code.',
      effort: 'Medium'
    }
  },
  {
    id: 'EXPOSED_ENV_FILE',
    severity: 'critical',
    title: 'Environment File Exposed',
    test: (data) => {
      const findings = [];
      if (data.probeResults && data.probeResults['/.env'] && data.probeResults['/.env'].accessible) {
        findings.push({
          file: '/.env',
          line: 1,
          snippet: data.probeResults['/.env'].snippet || 'Environment file accessible'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'The .env file is being served by the web server and anyone can read all secrets.',
      fix: 'Configure your web server (Nginx, Apache, etc.) to deny access to hidden files (files starting with a dot), or move the .env file outside the public document root.',
      effort: 'Low'
    }
  },
  {
    id: 'EXPOSED_GIT',
    severity: 'critical',
    title: 'Git Repository Exposed',
    test: (data) => {
      const findings = [];
      if (data.probeResults && data.probeResults['/.git/config'] && data.probeResults['/.git/config'].accessible) {
        findings.push({
          file: '/.git/config',
          line: 1,
          snippet: data.probeResults['/.git/config'].snippet || 'Git config accessible'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'The entire git history including all secrets ever committed can be reconstructed because the .git directory is publicly accessible.',
      fix: 'Configure your web server to deny access to the .git directory, or ensure it is not deployed to the public document root.',
      effort: 'Low'
    }
  },
  {
    id: 'SOURCE_MAP_EXPOSED',
    severity: 'high',
    title: 'Source Maps Exposed',
    test: (data) => {
      const findings = [];
      for (const map of data.sourceMapResults || []) {
        if (map.accessible) {
          findings.push({
            file: map.url,
            line: 1,
            snippet: 'Source map file accessible'
          });
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Source maps expose the full original source code to anyone who knows to look. This can reveal business logic, comments, and potentially hardcoded secrets.',
      fix: 'Disable source map generation in production builds, or configure your web server to restrict access to .map files.',
      effort: 'Low'
    }
  },
  {
    id: 'BUNDLE_GENERIC_SECRET',
    severity: 'high',
    title: 'Potential Hardcoded Secret',
    test: (data) => {
      const findings = [];
      const regex = /(?:key|secret|token|password|api_key|apiKey|API_KEY)['"\s:=]+['"]([A-Za-z0-9_\-\/+]{20,})['"]/gi;
      
      for (const bundle of data.bundles || []) {
        let match;
        while ((match = regex.exec(bundle.content)) !== null) {
          if (!match[1].startsWith('AIza')) {
            findings.push({
              file: bundle.url,
              line: 0,
              snippet: match[0]
            });
          }
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'A high-entropy string resembling a secret or password was found in your client-side JavaScript.',
      fix: 'Review the identified string. If it is a secret, rotate it and move its usage to a backend server.',
      effort: 'Medium'
    }
  },
  {
    id: 'NO_HTTPS',
    severity: 'high',
    title: 'Insecure Protocol (HTTP)',
    test: (data) => {
      const findings = [];
      if (data.url && data.url.startsWith('http://')) {
        findings.push({
          file: 'URL',
          line: 1,
          snippet: data.url
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Without HTTPS, anyone on the same network (coffee shop, airport) can intercept all data sent between the user and the website.',
      fix: 'Enable HTTPS on your web server and redirect all HTTP traffic to HTTPS.',
      effort: 'Low'
    }
  },
  {
    id: 'CORS_PERMISSIVE',
    severity: 'high',
    title: 'Permissive CORS Policy',
    test: (data) => {
      const findings = [];
      if (data.headers && data.headers['access-control-allow-origin'] === '*') {
        findings.push({
          file: 'Headers',
          line: 1,
          snippet: 'access-control-allow-origin: *'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'The CORS policy allows any website to make requests to the API on behalf of users, potentially exposing sensitive data.',
      fix: 'Restrict the Access-Control-Allow-Origin header to specific trusted domains.',
      effort: 'Low'
    }
  },
  {
    id: 'DEBUG_ENDPOINTS',
    severity: 'high',
    title: 'Exposed Debug/Development Endpoints',
    test: (data) => {
      const findings = [];
      const debugPaths = ['/graphql', '/api/debug', '/_debug', '/phpinfo.php'];
      if (data.probeResults) {
        for (const path of debugPaths) {
          if (data.probeResults[path] && data.probeResults[path].accessible) {
            findings.push({
              file: path,
              line: 1,
              snippet: data.probeResults[path].snippet || 'Debug endpoint accessible'
            });
          }
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Debug or development endpoints are accessible in production. These can leak sensitive system information or allow unauthorized actions.',
      fix: 'Disable debug endpoints in production environments or restrict access to them.',
      effort: 'Low'
    }
  },
  {
    id: 'MISSING_CSP',
    severity: 'medium',
    title: 'Missing Content Security Policy',
    test: (data) => {
      const findings = [];
      if (data.headers && !data.headers['content-security-policy']) {
        findings.push({
          file: 'Headers',
          line: 1,
          snippet: 'Missing Content-Security-Policy header'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Without CSP, if an attacker finds an XSS vulnerability, there\'s nothing stopping them from loading malicious scripts from external domains.',
      fix: 'Implement a Content-Security-Policy header to restrict the sources from which scripts, styles, and other resources can be loaded.',
      effort: 'High'
    }
  },
  {
    id: 'MISSING_HSTS',
    severity: 'medium',
    title: 'Missing HTTP Strict Transport Security',
    test: (data) => {
      const findings = [];
      if (data.headers && !data.headers['strict-transport-security'] && data.url && data.url.startsWith('https://')) {
        findings.push({
          file: 'Headers',
          line: 1,
          snippet: 'Missing Strict-Transport-Security header'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'The site does not enforce HTTPS connections, making users vulnerable to downgrade attacks if they initially connect via HTTP.',
      fix: 'Add the Strict-Transport-Security header to all responses over HTTPS.',
      effort: 'Low'
    }
  },
  {
    id: 'MISSING_X_FRAME_OPTIONS',
    severity: 'medium',
    title: 'Missing X-Frame-Options',
    test: (data) => {
      const findings = [];
      const hasXFrameOptions = data.headers && data.headers['x-frame-options'];
      const hasCSPFrameAncestors = data.headers && data.headers['content-security-policy'] && data.headers['content-security-policy'].includes('frame-ancestors');
      
      if (!hasXFrameOptions && !hasCSPFrameAncestors) {
        findings.push({
          file: 'Headers',
          line: 1,
          snippet: 'Missing X-Frame-Options or CSP frame-ancestors'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Clickjacking risk — attackers can embed the app in an invisible iframe to trick users into clicking buttons they didn\'t intend to.',
      fix: 'Add the X-Frame-Options header (e.g., DENY or SAMEORIGIN) or the CSP frame-ancestors directive.',
      effort: 'Low'
    }
  },
  {
    id: 'MISSING_X_CONTENT_TYPE',
    severity: 'medium',
    title: 'Missing X-Content-Type-Options',
    test: (data) => {
      const findings = [];
      if (data.headers && !data.headers['x-content-type-options']) {
        findings.push({
          file: 'Headers',
          line: 1,
          snippet: 'Missing X-Content-Type-Options header'
        });
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Browsers may try to guess the MIME type of a response, which can lead to XSS if a file containing malicious script is served with a non-executable MIME type.',
      fix: 'Add the X-Content-Type-Options: nosniff header to all responses.',
      effort: 'Low'
    }
  },
  {
    id: 'BUNDLE_FIREBASE_CONFIG',
    severity: 'medium',
    title: 'Firebase Config Discovered',
    test: (data) => {
      const findings = [];
      for (const bundle of data.bundles || []) {
        if (bundle.content.includes('apiKey') && bundle.content.includes('authDomain') && bundle.content.includes('projectId')) {
          findings.push({
            file: bundle.url,
            line: 0,
            snippet: 'Firebase configuration object'
          });
        }
      }
      return findings;
    },
    fallbackExplanation: {
      what_it_means: 'Firebase client config is public by design, but make sure Firestore/Storage rules are locked down. This is informational.',
      fix: 'Verify that your Firebase Security Rules (Firestore, Storage, Realtime Database) are correctly configured to prevent unauthorized read/write access.',
      effort: 'Medium'
    }
  }
];
