/**
 * Redact a secret value for safe display.
 * Shows first 4 + last 4 characters only.
 * NEVER log or return full secret values.
 * 
 * @param {string|null|undefined} value - The secret value to redact
 * @returns {string} - The redacted string
 */
export function redactSecret(value) {
  if (value === null || value === undefined) {
    return '••••••••';
  }
  
  const str = String(value);
  if (str.length <= 8) {
    return '••••••••';
  }
  
  return `${str.substring(0, 4)}••••••••${str.substring(str.length - 4)}`;
}
