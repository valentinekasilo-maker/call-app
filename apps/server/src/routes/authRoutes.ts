import { Router, Response } from 'express';
import { UserRepository } from '../repositories/userRepository';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';

const router = Router();

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 * Authentication is done via Supabase JWT in the Authorization header.
 *
 * Note: /register and /login have been removed — these are now handled
 * entirely client-side via the Supabase Auth SDK. The server only
 * needs to verify tokens and serve profile data.
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await UserRepository.findById(req.user.userId);
  if (!user) {
    res.status(404).json({ error: 'User profile not found. The profile may still be initializing.' });
    return;
  }

  // Enrich with email from the JWT (profiles table doesn't store email)
  res.json({
    user: {
      ...user,
      email: req.user.email,
    },
  });
});

export default router;
