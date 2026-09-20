// server/lib/website-scanner.js
import { websiteRules } from './website-rules.js';
import { redactSecret } from './redact.js';

/**
 * Normalizes a URL, prepending https:// if protocol is missing.
 * @param {string} url 
 * @returns {URL}
 */
function normalizeUrl(url) {
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = 'https://' + normalized;
  }
  return new URL(normalized);
}

/**
 * Scans a website for security vulnerabilities.
 * @param {string} targetUrl 
 */
export async function scanWebsite(targetUrl) {
  let parsedUrl;
  try {
    parsedUrl = normalizeUrl(targetUrl);
  } catch (err) {
    throw new Error('Invalid URL');
  }

  const url = parsedUrl.href;
  const baseUrl = parsedUrl.origin;
  
  let html = '';
  let headers = {};
  let finalUrl = url;

  // 1. Fetch the page
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'shipcheck'
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);
    
    finalUrl = response.url;
    // Lowercase headers
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    html = await response.text();
  } catch (err) {
    const error = new Error('Site not reachable');
    error.type = 'SITE_NOT_REACHABLE';
    throw error;
  }

  // 2. Extract JS bundle URLs from HTML
  const bundleUrls = new Set();
  const scriptRegex = /<(?:script|link)\s+[^>]*(?:src|href)=['"]([^'"]+\.m?js)['"][^>]*>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const resolvedUrl = new URL(match[1], finalUrl).href;
      bundleUrls.add(resolvedUrl);
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  
  // also handle modulepreload
  const preloadRegex = /<link\s+[^>]*rel=['"]modulepreload['"][^>]*href=['"]([^'"]+)['"][^>]*>/gi;
  while ((match = preloadRegex.exec(html)) !== null) {
    if (match[1].endsWith('.js') || match[1].endsWith('.mjs')) {
      try {
        const resolvedUrl = new URL(match[1], finalUrl).href;
        bundleUrls.add(resolvedUrl);
      } catch (e) {
        // Ignore invalid URLs
      }
    }
  }

  const urlsToFetch = Array.from(bundleUrls).slice(0, 20); // Cap at 20 bundles

  // 3. Fetch each JS bundle
  const bundles = [];
  const CONCURRENCY = 5;
  
  const fetchBundle = async (bundleUrl) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const res = await fetch(bundleUrl, {
        headers: { 'User-Agent': 'shipcheck' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!res.ok) return null;
      
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
         return null; // Skip > 2MB
      }
      
      const content = await res.text();
      if (content.length > 2 * 1024 * 1024) return null;

      return { url: bundleUrl, content };
    } catch (e) {
      return null;
    }
  };

  for (let i = 0; i < urlsToFetch.length; i += CONCURRENCY) {
    const chunk = urlsToFetch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(fetchBundle));
    for (const res of results) {
      if (res) bundles.push(res);
    }
  }

  // 4. Probe for source maps
  const sourceMapResults = [];
  for (let i = 0; i < urlsToFetch.length; i += CONCURRENCY) {
    const chunk = urlsToFetch.slice(i, i + CONCURRENCY);
    const mapResults = await Promise.all(chunk.map(async (bundleUrl) => {
      const mapUrl = bundleUrl + '.map';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(mapUrl, {
          method: 'HEAD',
          headers: { 'User-Agent': 'shipcheck' },
          signal: controller.signal
        });
        clearTimeout(timeout);
        return { url: mapUrl, accessible: res.status === 200 };
      } catch (e) {
        return { url: mapUrl, accessible: false };
      }
    }));
    sourceMapResults.push(...mapResults);
  }

  // 5. Probe for exposed files
  const probeResults = {};
  const probes = [
    { path: '/.env', method: 'GET' },
    { path: '/.git/config', method: 'GET' },
    { path: '/graphql', method: 'POST', body: JSON.stringify({ query: '{__schema{types{name}}}' }), headers: { 'Content-Type': 'application/json' } },
    { path: '/api/debug', method: 'GET' },
    { path: '/_debug', method: 'GET' },
    { path: '/phpinfo.php', method: 'GET' }
  ];

  for (const probe of probes) {
    try {
      const probeUrl = new URL(probe.path, baseUrl).href;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const options = {
        method: probe.method,
        headers: { 'User-Agent': 'shipcheck', ...(probe.headers || {}) },
        signal: controller.signal
      };
      if (probe.body) options.body = probe.body;
      
      const res = await fetch(probeUrl, options);
      clearTimeout(timeout);
      
      if (res.ok) {
        const text = await res.text();
        probeResults[probe.path] = {
          accessible: true,
          snippet: text.substring(0, 200)
        };
      } else {
        probeResults[probe.path] = { accessible: false };
      }
    } catch (e) {
      probeResults[probe.path] = { accessible: false };
    }
  }

  // 6. Run website rules
  const data = {
    url: finalUrl,
    html,
    headers,
    bundles,
    sourceMapResults,
    probeResults
  };

  const findings = [];
  for (const rule of websiteRules) {
    try {
      const ruleFindings = rule.test(data);
      for (const finding of ruleFindings) {
        findings.push({
          id: rule.id,
          severity: rule.severity,
          title: rule.title,
          file: finding.file,
          line: finding.line,
          snippet_redacted: redactSecret(finding.snippet),
          fallbackExplanation: rule.fallbackExplanation
        });
      }
    } catch (e) {
      // ignore rule errors
    }
  }

  // Sort by severity
  const severityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    url: finalUrl,
    findings,
    bundlesScanned: bundles.length,
    headersChecked: Object.keys(headers).length > 0
  };
}
