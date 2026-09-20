/**
 * Automated test suite for the Shipcheck website rule engine.
 * Runs against mock website data — no network calls needed.
 */

import { describe, it, expect } from 'vitest';
import { websiteRules } from '../lib/website-rules.js';
import { redactSecret } from '../lib/redact.js';

// ── Mock Data ────────────────────────────────────────────────────────────────

const mockBundleWithKeys = {
  url: 'https://my-app.vercel.app/assets/index-abc123.js',
  content: `
    var config={apiUrl:"https://api.openai.com/v1"};
    var t="` + 'sk-' + 'proj-' + 'abcdefghijklmnopqrstuvwxyz1234567890ABCD' + `";
    var s="AIzaSyB9876543210zyxwvutsrqponmlkjihgfedcba";
    var stripe_key="` + 'sk_' + 'live_' + '51HG7abc123XYZ456def789ghi0jklmnopqrst' + `";
  `
};

const mockBundleWithSupabaseServiceRole = {
  url: 'https://my-app.vercel.app/assets/supabase-xyz.js',
  // This is a mock JWT. The payload decodes to something containing "service_role".
  // Payload: {"role":"service_role","iss":"supabase"}
  content: `var key="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ.signature123"`,
};

const mockBundleWithFirebaseConfig = {
  url: 'https://my-app.vercel.app/assets/firebase-init.js',
  content: `
    const firebaseConfig = {
      apiKey: "AIzaSyDummyKeyForFirebase12345678",
      authDomain: "my-app.firebaseapp.com",
      projectId: "my-app-12345",
      storageBucket: "my-app.appspot.com"
    };
  `
};

const mockCleanBundle = {
  url: 'https://my-app.vercel.app/assets/vendor-react.js',
  content: 'var React=function(){/* minified React code */}; export default React;'
};

function createMockData(overrides = {}) {
  return {
    url: 'https://my-app.vercel.app',
    html: '<html><head></head><body><div id="root"></div></body></html>',
    headers: {},
    bundles: [mockCleanBundle],
    sourceMapResults: [],
    probeResults: {},
    ...overrides,
  };
}

// ── Helper to run a specific rule ────────────────────────────────────────────

function runRule(ruleId, data) {
  const rule = websiteRules.find(r => r.id === ruleId);
  if (!rule) throw new Error(`Rule ${ruleId} not found`);
  return rule.test(data);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Website Rules — CRITICAL', () => {

  describe('BUNDLE_EXPOSED_KEY', () => {
    it('detects API keys in JS bundles', () => {
      const data = createMockData({ bundles: [mockBundleWithKeys] });
      const findings = runRule('BUNDLE_EXPOSED_KEY', data);
      expect(findings.length).toBeGreaterThanOrEqual(2); // Google AI + Stripe
    });

    it('returns no findings for clean bundles', () => {
      const data = createMockData({ bundles: [mockCleanBundle] });
      const findings = runRule('BUNDLE_EXPOSED_KEY', data);
      expect(findings).toHaveLength(0);
    });

    it('findings reference the bundle URL', () => {
      const data = createMockData({ bundles: [mockBundleWithKeys] });
      const findings = runRule('BUNDLE_EXPOSED_KEY', data);
      findings.forEach(f => {
        expect(f.file).toBe(mockBundleWithKeys.url);
      });
    });

    it('snippets can be redacted without exposing full keys', () => {
      const data = createMockData({ bundles: [mockBundleWithKeys] });
      const findings = runRule('BUNDLE_EXPOSED_KEY', data);
      findings.forEach(f => {
        const redacted = redactSecret(f.snippet);
        expect(redacted).toContain('••••••••');
        expect(redacted).not.toBe(f.snippet);
      });
    });
  });

  describe('BUNDLE_SUPABASE_SERVICE_ROLE', () => {
    it('detects service_role JWT in bundles', () => {
      const data = createMockData({ bundles: [mockBundleWithSupabaseServiceRole] });
      const findings = runRule('BUNDLE_SUPABASE_SERVICE_ROLE', data);
      expect(findings.length).toBeGreaterThanOrEqual(1);
    });

    it('ignores non-service_role JWTs', () => {
      const bundle = {
        url: 'https://app.com/main.js',
        // Payload: {"role":"anon","iss":"supabase"}
        content: `var k="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIn0.sig"`,
      };
      const data = createMockData({ bundles: [bundle] });
      const findings = runRule('BUNDLE_SUPABASE_SERVICE_ROLE', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('EXPOSED_ENV_FILE', () => {
    it('detects accessible .env file', () => {
      const data = createMockData({
        probeResults: { '/.env': { accessible: true, snippet: 'DATABASE_URL=postgres://...' } },
      });
      const findings = runRule('EXPOSED_ENV_FILE', data);
      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe('/.env');
    });

    it('no finding when .env is not accessible', () => {
      const data = createMockData({
        probeResults: { '/.env': { accessible: false } },
      });
      const findings = runRule('EXPOSED_ENV_FILE', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('EXPOSED_GIT', () => {
    it('detects accessible .git/config', () => {
      const data = createMockData({
        probeResults: { '/.git/config': { accessible: true, snippet: '[core]' } },
      });
      const findings = runRule('EXPOSED_GIT', data);
      expect(findings).toHaveLength(1);
    });
  });
});

describe('Website Rules — HIGH', () => {

  describe('SOURCE_MAP_EXPOSED', () => {
    it('detects accessible source maps', () => {
      const data = createMockData({
        sourceMapResults: [
          { url: 'https://app.com/main.js.map', accessible: true },
          { url: 'https://app.com/vendor.js.map', accessible: false },
        ],
      });
      const findings = runRule('SOURCE_MAP_EXPOSED', data);
      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe('https://app.com/main.js.map');
    });
  });

  describe('NO_HTTPS', () => {
    it('flags HTTP URLs', () => {
      const data = createMockData({ url: 'http://my-insecure-app.com' });
      const findings = runRule('NO_HTTPS', data);
      expect(findings).toHaveLength(1);
    });

    it('does not flag HTTPS URLs', () => {
      const data = createMockData({ url: 'https://my-secure-app.com' });
      const findings = runRule('NO_HTTPS', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('CORS_PERMISSIVE', () => {
    it('flags wildcard CORS', () => {
      const data = createMockData({
        headers: { 'access-control-allow-origin': '*' },
      });
      const findings = runRule('CORS_PERMISSIVE', data);
      expect(findings).toHaveLength(1);
    });
  });

  describe('DEBUG_ENDPOINTS', () => {
    it('flags accessible debug endpoints', () => {
      const data = createMockData({
        probeResults: {
          '/graphql': { accessible: true, snippet: '{"data":{"__schema":{...' },
          '/api/debug': { accessible: false },
        },
      });
      const findings = runRule('DEBUG_ENDPOINTS', data);
      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe('/graphql');
    });
  });
});

describe('Website Rules — MEDIUM', () => {

  describe('MISSING_CSP', () => {
    it('flags missing Content-Security-Policy', () => {
      const data = createMockData({ headers: {} });
      const findings = runRule('MISSING_CSP', data);
      expect(findings).toHaveLength(1);
    });

    it('no finding when CSP is present', () => {
      const data = createMockData({
        headers: { 'content-security-policy': "default-src 'self'" },
      });
      const findings = runRule('MISSING_CSP', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('MISSING_HSTS', () => {
    it('flags missing HSTS on HTTPS sites', () => {
      const data = createMockData({
        url: 'https://my-app.com',
        headers: {},
      });
      const findings = runRule('MISSING_HSTS', data);
      expect(findings).toHaveLength(1);
    });

    it('does not flag HTTP sites (HSTS is irrelevant)', () => {
      const data = createMockData({
        url: 'http://my-app.com',
        headers: {},
      });
      const findings = runRule('MISSING_HSTS', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('MISSING_X_FRAME_OPTIONS', () => {
    it('flags when both X-Frame-Options and CSP frame-ancestors are missing', () => {
      const data = createMockData({ headers: {} });
      const findings = runRule('MISSING_X_FRAME_OPTIONS', data);
      expect(findings).toHaveLength(1);
    });

    it('no finding when X-Frame-Options is present', () => {
      const data = createMockData({
        headers: { 'x-frame-options': 'DENY' },
      });
      const findings = runRule('MISSING_X_FRAME_OPTIONS', data);
      expect(findings).toHaveLength(0);
    });
  });

  describe('BUNDLE_FIREBASE_CONFIG', () => {
    it('detects Firebase config in bundles', () => {
      const data = createMockData({ bundles: [mockBundleWithFirebaseConfig] });
      const findings = runRule('BUNDLE_FIREBASE_CONFIG', data);
      expect(findings).toHaveLength(1);
    });

    it('no finding for bundles without Firebase config', () => {
      const data = createMockData({ bundles: [mockCleanBundle] });
      const findings = runRule('BUNDLE_FIREBASE_CONFIG', data);
      expect(findings).toHaveLength(0);
    });
  });
});

describe('Website Rules — all rules have fallback explanations', () => {
  it('every rule has a fallbackExplanation with required fields', () => {
    for (const rule of websiteRules) {
      expect(rule.fallbackExplanation, `Rule ${rule.id} missing fallbackExplanation`).toBeDefined();
      expect(rule.fallbackExplanation.what_it_means, `Rule ${rule.id} missing what_it_means`).toBeTruthy();
      expect(rule.fallbackExplanation.fix, `Rule ${rule.id} missing fix`).toBeTruthy();
      expect(rule.fallbackExplanation.effort, `Rule ${rule.id} missing effort`).toBeTruthy();
    }
  });
});
