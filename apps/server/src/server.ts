import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { initDatabase } from './db/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import contactRoutes from './routes/contactRoutes';
import callRoutes from './routes/callRoutes';
import apiV1Router from './api';
import { setupSocketHandler } from './signaling/socketHandler';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Internet Call App Signaling Server',
    timestamp: new Date().toISOString(),
  });
});

// Client runtime configuration endpoint (Safe public configuration)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: config.supabaseUrl || 'https://lptsuupxamkbsltbbzaj.supabase.co',
    supabaseAnonKey:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      'sb_publishable_zeQ-yD7h0akTUEZfCjlFDQ_K2tKuX1U',
    stunServers: config.stunServers,
  });
});

// Existing REST Routes (Backwards Compatibility)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/calls', callRoutes);

// Developer Reusable Calling API Layer (v1)
app.use('/api/v1', apiV1Router);

// Serve Static Frontend Assets (Unified Render Deployment / Docker)
const webDistCandidates = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(__dirname, '../../../apps/web/dist'),
  path.resolve(__dirname, '../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
  path.resolve(process.cwd(), 'dist/web'),
];

const webDistPath = webDistCandidates.find(candidate => fs.existsSync(candidate));
if (webDistPath) {
  console.log(`📦 Serving static web client from: ${webDistPath}`);
  
  const serveIndexHtml = (req: express.Request, res: express.Response) => {
    try {
      let html = fs.readFileSync(path.join(webDistPath, 'index.html'), 'utf-8');
      const runtimeConfig = {
        supabaseUrl: config.supabaseUrl || 'https://lptsuupxamkbsltbbzaj.supabase.co',
        supabaseAnonKey:
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          'sb_publishable_zeQ-yD7h0akTUEZfCjlFDQ_K2tKuX1U',
      };
      const injectedScript = `<script>window.__APP_CONFIG__ = ${JSON.stringify(runtimeConfig)};</script>`;
      html = html.replace('</head>', `${injectedScript}</head>`);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (e) {
      res.sendFile(path.join(webDistPath, 'index.html'));
    }
  };

  app.use(express.static(webDistPath, { index: false }));
  app.get('/', serveIndexHtml);
  
  // SPA Fallback for client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    serveIndexHtml(req, res);
  });
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Bootstrap Server
export async function startServer(port: number = config.port): Promise<http.Server> {
  await initDatabase();
  setupSocketHandler(io);

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`====================================================`);
      console.log(`🚀 Call App Signaling & Auth Server is RUNNING`);
      console.log(`📡 URL: http://localhost:${port}`);
      console.log(`🗄️ Database: Supabase PostgreSQL`);
      console.log(`🌐 STUN Servers: ${config.stunServers.join(', ')}`);
      console.log(`====================================================`);
      resolve(server);
    });
  });
}

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.env.TSX_TEST === 'true' ||
  process.env.npm_lifecycle_event === 'test' ||
  process.argv.some(arg => arg.includes('--test'));

if (!isTestEnv) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app, server, io };

