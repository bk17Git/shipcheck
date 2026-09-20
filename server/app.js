import dotenv from 'dotenv';
import path from 'path';

// Load .env from current directory or root project directory
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { scanRateLimit } from './lib/rateLimiter.js';
import scanRouter from './routes/scan.js';

const app = express();

// Enable trust proxy for accurate client IP resolution behind reverse proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(express.json());

// API Router
const apiRouter = express.Router();
apiRouter.use('/scan', scanRateLimit, scanRouter);
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Mount router on /api, Netlify function path, and root
app.use('/api', apiRouter);
app.use('/.netlify/functions/api', apiRouter);
app.use('/', apiRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
