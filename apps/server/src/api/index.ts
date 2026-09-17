import { Router } from 'express';
import identityRoutes from './identities/routes';
import meRoutes from './me/routes';
import authRoutes from './auth/routes';
import accountRoutes from './accounts/routes';
import userRoutes from './users/routes';
import callRoutes from './calls/routes';
import deviceRoutes from './devices/routes';
import webhookRoutes from './webhooks/routes';
import { defaultApiRateLimit } from './middleware/rateLimit';

const apiV1Router = Router();

// Apply default sliding-window rate limit across /api/v1
apiV1Router.use(defaultApiRateLimit);

// Primary Identity & Verification Routes
apiV1Router.use('/identities', identityRoutes);
apiV1Router.use('/me', meRoutes);

// Calling & Signaling Routes
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/calls', callRoutes);
apiV1Router.use('/devices', deviceRoutes);
apiV1Router.use('/webhooks', webhookRoutes);

// Key & Account Utilities
apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/accounts', accountRoutes);

// API v1 Index Info
apiV1Router.get('/', (req, res) => {
  res.json({
    version: 'v1',
    name: 'CallApp Reusable Calling Identity API',
    status: 'operational',
    concept: 'API KEY = IDENTITY CREDENTIAL',
    documentation: '/docs/API.md',
    endpoints: {
      identities: '/api/v1/identities',
      me: '/api/v1/me',
      users: '/api/v1/users/:appId',
      calls: '/api/v1/calls',
      devices: '/api/v1/devices',
      webhooks: '/api/v1/webhooks',
    },
  });
});

export default apiV1Router;
