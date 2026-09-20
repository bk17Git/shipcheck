/**
 * Automated test suite for the Shipcheck rule engine.
 * Runs against test-fixtures/ — a deliberately broken mini app.
 *
 * Required findings (from the spec):
 *   1. VITE_ Gemini key in .env           → critical (CLIENT_EXPOSED_ENV_SECRET)
 *   2. Committed .env file                → critical (COMMITTED_ENV_FILE)
 *   3. Firestore rules with `if true`     → critical (FIRESTORE_OPEN_RULES)
 *   4. Unauthed route calling LLM         → high     (UNPROTECTED_LLM_ENDPOINT)
 *   5. SQL string concatenation           → high     (SQL_INJECTION)
 *
 * Additional expected findings (bonus — scanner should also catch these):
 *   - EXPOSED_PROVIDER_KEY (AIza key + sk_live_ in .env)
 *   - NO_RATE_LIMITING / MISSING_HELMET on test-fixtures/server/index.js
 *   - ENV_NOT_GITIGNORED (no .gitignore in fixtures)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { scanFiles } from '../lib/scanner.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(import.meta.dirname, '..', '..', 'test-fixtures');

/**
 * Recursively read all files from the fixtures directory,
 * returning them in the { path, content } shape the scanner expects.
 * Paths are relative to the fixtures root (like a repo tree).
 */
function loadFixtureFiles(dir, baseDir = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(baseDir, full);
    if (entry === 'node_modules' || entry === '.git') continue;
    if (statSync(full).isDirectory()) {
      files.push(...loadFixtureFiles(full, baseDir));
    } else {
      files.push({
        path: rel,
        content: readFileSync(full, 'utf-8'),
      });
    }
  }
  return files;
}

// ── Load fixtures once ───────────────────────────────────────────────────────

const fixtureFiles = loadFixtureFiles(FIXTURES_DIR);

// ── Run scanner ──────────────────────────────────────────────────────────────

const { findings, filesScanned } = scanFiles(fixtureFiles);

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Rule Engine — test fixtures', () => {
  it('scanned all fixture files', () => {
    expect(filesScanned).toBeGreaterThanOrEqual(5);
  });

  it('produced at least 5 findings', () => {
    expect(findings.length).toBeGreaterThanOrEqual(5);
  });

  // ── Required finding 1: VITE_ key exposure ──

  describe('Finding 1: VITE_ key in .env', () => {
    const match = findings.find(
      (f) => f.id === 'CLIENT_EXPOSED_ENV_SECRET' && f.file === '.env'
    );

    it('is detected', () => {
      expect(match).toBeDefined();
    });

    it('is critical severity', () => {
      expect(match?.severity).toBe('critical');
    });
  });

  // ── Required finding 2: Committed .env file ──

  describe('Finding 2: Committed .env file', () => {
    const match = findings.find(
      (f) => f.id === 'COMMITTED_ENV_FILE' && f.file === '.env'
    );

    it('is detected', () => {
      expect(match).toBeDefined();
    });

    it('is critical severity', () => {
      expect(match?.severity).toBe('critical');
    });
  });

  // ── Required finding 3: Firestore open rules ──

  describe('Finding 3: Firestore open rules', () => {
    const match = findings.find(
      (f) =>
        f.id === 'FIRESTORE_OPEN_RULES' && f.file === 'firestore.rules'
    );

    it('is detected', () => {
      expect(match).toBeDefined();
    });

    it('is critical severity', () => {
      expect(match?.severity).toBe('critical');
    });
  });

  // ── Required finding 4: Unauthed LLM route ──

  describe('Finding 4: Unprotected LLM endpoint', () => {
    const match = findings.find(
      (f) =>
        f.id === 'UNPROTECTED_LLM_ENDPOINT' &&
        f.file === 'server/index.js'
    );

    it('is detected', () => {
      expect(match).toBeDefined();
    });

    it('is high severity', () => {
      expect(match?.severity).toBe('high');
    });
  });

  // ── Required finding 5: SQL injection ──

  describe('Finding 5: SQL injection', () => {
    const sqlFindings = findings.filter(
      (f) => f.id === 'SQL_INJECTION' && f.file === 'server/db.js'
    );

    it('is detected (at least one)', () => {
      expect(sqlFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('is high severity', () => {
      sqlFindings.forEach((f) => {
        expect(f.severity).toBe('high');
      });
    });

    it('finds both injection patterns (template literal + concat)', () => {
      // Line 7: template literal `SELECT ... ${userId}`
      // Line 13: string concat "SELECT ..." + name
      expect(sqlFindings.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Secret redaction ──

  describe('Secret redaction', () => {
    it('never contains full AIza key in any finding', () => {
      const fullKey = 'AIzaSyA1234567890abcdefghijklmnopqrst4f2c';
      for (const f of findings) {
        expect(f.snippet_redacted).not.toContain(fullKey);
      }
    });

    it('never contains full Stripe key in any finding', () => {
      const fullKey = 'sk_' + 'live_' + '51abc123def456ghi789jkl0';
      for (const f of findings) {
        expect(f.snippet_redacted).not.toContain(fullKey);
      }
    });

    it('redacted secrets show first4 + dots + last4 pattern', () => {
      // Find the EXPOSED_PROVIDER_KEY finding for the AIza key
      const keyFinding = findings.find(
        (f) => f.id === 'EXPOSED_PROVIDER_KEY' && f.snippet_redacted.startsWith('AIza')
      );
      if (keyFinding) {
        expect(keyFinding.snippet_redacted).toMatch(/^AIza••••••••.{4}$/);
      }
    });
  });

  // ── Severity ordering ──

  describe('Severity ordering', () => {
    it('findings are sorted by severity (critical first)', () => {
      const sevOrder = { critical: 3, high: 2, medium: 1 };
      for (let i = 1; i < findings.length; i++) {
        const prev = sevOrder[findings[i - 1].severity] || 0;
        const curr = sevOrder[findings[i].severity] || 0;
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  // ── Bonus findings (not required but expected) ──

  describe('Bonus: additional findings from fixtures', () => {
    it('detects exposed provider keys in .env (AIza, sk_live_)', () => {
      const providerKeys = findings.filter(
        (f) => f.id === 'EXPOSED_PROVIDER_KEY' && f.file === '.env'
      );
      expect(providerKeys.length).toBeGreaterThanOrEqual(1);
    });

    it('detects missing rate limiting on Express server', () => {
      const rl = findings.find(
        (f) =>
          f.id === 'NO_RATE_LIMITING' && f.file === 'server/index.js'
      );
      expect(rl).toBeDefined();
    });

    it('detects missing helmet on Express server', () => {
      const helmet = findings.find(
        (f) =>
          f.id === 'MISSING_HELMET' && f.file === 'server/index.js'
      );
      expect(helmet).toBeDefined();
    });
  });

  // ── Full findings dump (for debugging) ──

  describe('Debug: findings summary', () => {
    it('logs all findings', () => {
      console.log(`\\n  Total findings: ${findings.length}`);
      console.log(`  Files scanned: ${filesScanned}\\n`);
      for (const f of findings) {
        console.log(
          `  [${f.severity.toUpperCase()}] ${f.id} — ${f.file}:${f.line} — ${f.snippet_redacted}`
        );
      }
    });
  });
});
