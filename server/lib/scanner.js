import { redactSecret } from './redact.js';
import { rules } from './rules.js';

/**
 * Scan a list of files against all configured security rules.
 * 
 * @param {Array<{path: string, content: string}>} files - The list of files to scan
 * @returns {{findings: Array<Object>, filesScanned: number}} Scan results
 */
export function scanFiles(files) {
  const findings = [];
  
  // Build context
  const allFiles = files.map(f => f.path);
  const gitignoreFile = files.find(f => f.path.endsWith('.gitignore'));
  const gitignoreContent = gitignoreFile ? gitignoreFile.content : null;
  
  const context = {
    allFiles,
    gitignoreContent
  };

  // Run rules against each file
  for (const file of files) {
    for (const rule of rules) {
      try {
        const matches = rule.test(file, context);
        if (matches && matches.length > 0) {
          for (const match of matches) {
            // Apply any severity overrides set by the rule (e.g. for client paths)
            const effectiveSeverity = match.severityOverride || rule.severity;
            
            findings.push({
              id: rule.id,
              severity: effectiveSeverity,
              title: rule.title,
              file: file.path,
              line: match.line,
              snippet_redacted: redactSecret(match.snippet),
              fallbackExplanation: rule.fallbackExplanation
            });
          }
        }
      } catch (err) {
        console.error(`Error running rule ${rule.id} on file ${file.path}:`, err);
      }
    }
  }

  // Sort findings by severity
  const severityScores = {
    critical: 3,
    high: 2,
    medium: 1
  };

  findings.sort((a, b) => {
    const scoreA = severityScores[a.severity] || 0;
    const scoreB = severityScores[b.severity] || 0;
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // descending order
    }
    // alphabetical id as secondary sort
    return a.id.localeCompare(b.id);
  });

  return {
    findings,
    filesScanned: files.length
  };
}
