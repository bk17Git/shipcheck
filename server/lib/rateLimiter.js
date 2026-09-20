/**
 * @fileoverview In-memory IP-based rate limiter middleware for Express
 */

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_REQUESTS_PER_MINUTE = 2;

/**
 * @type {Map<string, number[]>} Map of IP addresses to arrays of request timestamps
 */
const ipRequests = new Map();

// Periodic cleanup of stale IPs to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequests.entries()) {
    // Filter out timestamps older than one hour
    const recentTimestamps = timestamps.filter(ts => now - ts < ONE_HOUR_MS);
    
    if (recentTimestamps.length === 0) {
      ipRequests.delete(ip);
    } else {
      ipRequests.set(ip, recentTimestamps);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Ensure interval doesn't prevent process from exiting
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

// Clear interval on process exit
process.on('exit', () => {
  clearInterval(cleanupInterval);
});

/**
 * Express middleware to rate limit scan requests.
 * Enforces:
 * 1. Burst limit: Max 2 scans per minute per IP
 * 2. Hourly limit: Max 5 scans per hour per IP (worst-case Gemini cost < $0.005/hr)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function scanRateLimit(req, res, next) {
  // Extract real client IP, respecting reverse proxies
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null)
    || req.ip
    || req.connection?.remoteAddress
    || 'unknown';

  const now = Date.now();
  let timestamps = ipRequests.get(ip) || [];
  
  // 1. Clean up timestamps older than 1 hour for this IP
  timestamps = timestamps.filter(ts => now - ts < ONE_HOUR_MS);

  // 2. Check burst limit (requests in the last 60 seconds)
  const minuteTimestamps = timestamps.filter(ts => now - ts < ONE_MINUTE_MS);
  if (minuteTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
    ipRequests.set(ip, timestamps);
    res.setHeader('Retry-After', '30');
    return res.status(429).json({
      error: 'Too many scan requests in a short time. Please wait 30 seconds before scanning again.',
      type: 'RATE_LIMITED'
    });
  }
  
  // 3. Check hourly limit
  if (timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    ipRequests.set(ip, timestamps); // Update with cleaned timestamps
    const oldest = timestamps[0];
    const resetTimeSec = Math.ceil((oldest + ONE_HOUR_MS - now) / 1000);
    res.setHeader('Retry-After', String(resetTimeSec));
    return res.status(429).json({
      error: 'Hourly rate limit exceeded. You can run up to 5 scans per hour.',
      type: 'RATE_LIMITED'
    });
  }
  
  // Set rate limit transparency headers
  res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS_PER_HOUR));
  res.setHeader('X-RateLimit-Remaining', String(MAX_REQUESTS_PER_HOUR - timestamps.length - 1));

  // Add current request timestamp
  timestamps.push(now);
  ipRequests.set(ip, timestamps);
  
  next();
}
