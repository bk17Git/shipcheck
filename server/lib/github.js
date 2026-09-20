/**
 * @fileoverview GitHub integration module for fetching repository contents
 */

const EXCLUDED_DIRS = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '.nuxt/'];
const EXCLUDED_LOCKFILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'composer.lock', 'Gemfile.lock', 'Cargo.lock'];
const EXCLUDED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.avi', '.mov', '.pdf', '.zip', '.tar', '.gz'];

const MAX_FILE_SIZE = 500 * 1024; // 500KB per file
const MAX_FILES = 200;            // 200 files max
const MAX_TOTAL_REPO_BYTES = 10 * 1024 * 1024; // 10MB total repo content cap
const CONCURRENCY_LIMIT = 10;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Parses a GitHub URL to extract the owner and repository name.
 * @param {string} url - The GitHub repository URL.
 * @returns {{owner: string, repo: string}} Parsed owner and repo.
 * @throws {Error} If the URL is invalid.
 */
function parseGitHubUrl(url) {
  try {
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    
    const parsedUrl = new URL(cleanUrl);
    if (parsedUrl.hostname !== 'github.com' && parsedUrl.hostname !== 'www.github.com') {
      throw new Error('Not a GitHub URL');
    }
    
    let pathname = parsedUrl.pathname.replace(/^\//, '').replace(/\/$/, '');
    
    // Handle specific branch paths like /tree/main
    const treeMatch = pathname.match(/^(.*?)\/(.*?)\/tree\/(.*?)(?:\/|$)/);
    if (treeMatch) {
      return { owner: treeMatch[1], repo: treeMatch[2] };
    }
    
    if (pathname.endsWith('.git')) {
      pathname = pathname.slice(0, -4);
    }
    
    const parts = pathname.split('/');
    if (parts.length < 2) {
      throw new Error('Invalid GitHub repository URL format');
    }
    
    return { owner: parts[0], repo: parts[1] };
  } catch (err) {
    throw new Error('Invalid GitHub URL: ' + err.message);
  }
}

/**
 * Creates an AbortSignal with a timeout.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {AbortSignal} The abort signal.
 */
function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * Fetches the file tree of a GitHub repository and its contents.
 * @param {string} repoUrl - The URL of the GitHub repository.
 * @returns {Promise<{owner: string, repo: string, files: Array<{path: string, content: string}>, truncated: boolean, totalFiles: number}>}
 */
export async function fetchRepo(repoUrl) {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  
  const headers = {
    'User-Agent': 'shipcheck'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  let treeData;
  
  try {
    const response = await fetch(treeUrl, { 
      headers,
      signal: createTimeoutSignal(FETCH_TIMEOUT_MS)
    });
    
    if (response.status === 404) {
      const error = new Error(`Repository not found or is private: ${owner}/${repo}`);
      error.type = 'REPO_NOT_FOUND';
      throw error;
    }
    
    if (response.status === 403) {
      const error = new Error('GitHub API rate limit exceeded');
      error.type = 'RATE_LIMITED';
      throw error;
    }
    
    if (!response.ok) {
      const error = new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      error.type = 'FETCH_ERROR';
      throw error;
    }
    
    treeData = await response.json();
  } catch (err) {
    if (!err.type) {
      err.type = 'FETCH_ERROR';
    }
    throw err;
  }
  
  if (!treeData.tree || !Array.isArray(treeData.tree)) {
    const error = new Error('Invalid tree response from GitHub');
    error.type = 'FETCH_ERROR';
    throw error;
  }
  
  const scannableFiles = treeData.tree.filter(item => {
    if (item.type !== 'blob') return false;
    
    const path = item.path;
    
    // Skip excluded directories
    if (EXCLUDED_DIRS.some(dir => path.startsWith(dir))) {
      return false;
    }
    
    // Skip lockfiles
    const filename = path.split('/').pop();
    if (EXCLUDED_LOCKFILES.includes(filename)) {
      return false;
    }
    
    // Skip binary extensions
    if (EXCLUDED_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext))) {
      return false;
    }
    
    // Skip large files
    if (item.size && item.size > MAX_FILE_SIZE) {
      return false;
    }
    
    return true;
  });
  
  const totalFiles = scannableFiles.length;
  const truncated = totalFiles > MAX_FILES;
  const filesToFetch = scannableFiles.slice(0, MAX_FILES);
  
  const files = [];
  let totalBytesFetched = 0;
  let sizeTruncated = false;
  
  // Semaphore for concurrency control
  let activePromises = 0;
  const queue = [...filesToFetch];
  
  await new Promise(resolve => {
    if (queue.length === 0) {
      resolve();
      return;
    }
    
    const next = async () => {
      if (queue.length === 0 && activePromises === 0) {
        resolve();
        return;
      }
      
      while (activePromises < CONCURRENCY_LIMIT && queue.length > 0) {
        const item = queue.shift();
        activePromises++;
        
        fetchFileContent(item.path)
          .then(content => {
            if (content !== null) {
              if (totalBytesFetched + content.length <= MAX_TOTAL_REPO_BYTES) {
                totalBytesFetched += content.length;
                files.push({ path: item.path, content });
              } else {
                sizeTruncated = true;
              }
            }
          })
          .catch(() => {
            // Ignore individual file failures
          })
          .finally(() => {
            activePromises--;
            next();
          });
      }
    };
    
    next();
  });
  
  return {
    owner,
    repo,
    files,
    truncated: truncated || sizeTruncated,
    totalFiles
  };
  
  /**
   * Fetches the content of a single file.
   * @param {string} path - The file path in the repository.
   * @returns {Promise<string|null>} File content or null on error.
   */
  async function fetchFileContent(path) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path}`;
    try {
      const response = await fetch(rawUrl, {
        headers,
        signal: createTimeoutSignal(FETCH_TIMEOUT_MS)
      });
      
      if (!response.ok) {
        return null;
      }
      
      return await response.text();
    } catch (err) {
      return null;
    }
  }
}
