import express from 'express';
import { fetchRepo } from '../lib/github.js';
import { scanFiles } from '../lib/scanner.js';
import { explainFindings } from '../lib/gemini.js';
import { scanWebsite } from '../lib/website-scanner.js';

const router = express.Router();

function detectScanType(url) {
  if (url.includes('github.com')) return 'repo';
  return 'website';
}

router.post('/', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'Invalid URL', type: 'BAD_URL' });
  }

  const scanType = detectScanType(url);

  try {
    let findings, filesScanned, repoName, isTruncated = false;

    if (scanType === 'repo') {
      const repoData = await fetchRepo(url);
      const scanResult = scanFiles(repoData.files);
      findings = scanResult.findings;
      filesScanned = scanResult.filesScanned;
      repoName = `${repoData.owner}/${repoData.repo}`;
      isTruncated = repoData.truncated || false;
    } else {
      const siteData = await scanWebsite(url);
      findings = siteData.findings;
      filesScanned = siteData.bundlesScanned;
      repoName = url;
    }

    // 4. Hard cap before Gemini call:
    // Limit to top 20 findings (sorted critical -> high -> medium) and sanitize payload
    const MAX_GEMINI_FINDINGS = 20;
    const findingsForAI = findings.slice(0, MAX_GEMINI_FINDINGS).map(f => ({
      id: f.id,
      severity: f.severity,
      title: f.title,
      file: f.file,
      line: f.line,
      snippet_redacted: f.snippet_redacted ? String(f.snippet_redacted).slice(0, 200) : ''
    }));

    // Explain with Gemini (only sending sanitized, capped findings)
    const explanations = await explainFindings(findingsForAI);

    let aiEnhanced = false;
    let finalFindings;

    // 5 & 6. Merge explanations or use fallback
    if (explanations && Array.isArray(explanations)) {
      aiEnhanced = true;
      finalFindings = findings.map(finding => {
        const explanation = explanations.find(e => e.id === finding.id && e.file === finding.file);
        const fb = finding.fallbackExplanation || {};
        return {
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
          file: finding.file,
          line: finding.line,
          snippet_redacted: finding.snippet_redacted,
          what_it_means: explanation?.what_it_means || fb.what_it_means || 'Review this finding.',
          fix: explanation?.fix || fb.fix || 'Review the code manually.',
          effort: explanation?.effort || fb.effort || '15 minutes'
        };
      });
    } else {
      // Gemini failed — use static fallback explanations from each rule
      finalFindings = findings.map(finding => {
        const fb = finding.fallbackExplanation || {};
        return {
          id: finding.id,
          severity: finding.severity,
          title: finding.title,
          file: finding.file,
          line: finding.line,
          snippet_redacted: finding.snippet_redacted,
          what_it_means: fb.what_it_means || 'Review this finding.',
          fix: fb.fix || 'Review the code manually.',
          effort: fb.effort || '15 minutes'
        };
      });
    }

    // Calculate summary
    const summary = { critical: 0, high: 0, medium: 0 };
    finalFindings.forEach(f => {
      const sev = (f.severity || 'medium').toLowerCase();
      if (summary[sev] !== undefined) {
        summary[sev]++;
      }
    });

    // 7. Build and return response
    res.json({
      scan_type: scanType,
      repo: repoName,
      scanned_at: new Date().toISOString(),
      files_scanned: filesScanned,
      truncated: isTruncated,
      ai_enhanced: aiEnhanced,
      summary,
      findings: finalFindings
    });

  } catch (error) {
    if (error.type === 'SITE_NOT_REACHABLE') {
      return res.status(502).json({ error: "Can't reach that site. Check the URL and make sure it's online.", type: 'SITE_NOT_REACHABLE' });
    }
    if (error.type === 'REPO_NOT_FOUND') {
      return res.status(404).json({ error: "Can't reach that repo. It needs to be public. Check the URL.", type: 'REPO_NOT_FOUND' });
    }
    if (error.type === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'GitHub is throttling us. Try again in a few minutes.', type: 'GITHUB_RATE_LIMITED' });
    }
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Something went wrong fetching the repo.', type: 'FETCH_ERROR' });
  }
});

export default router;
