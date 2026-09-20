import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import app from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// Serve client production build in standalone environments
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA catch-all: serve index.html for any non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/.netlify')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`Shipcheck server running on port ${PORT}`);
});
