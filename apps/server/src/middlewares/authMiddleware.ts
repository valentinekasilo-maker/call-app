import { Request, Response, NextFunction } from 'express';
import { resolveTokenToPayload, TokenPayload } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Express middleware that verifies a Supabase JWT and fetches the user profile.
 * Attaches the resolved TokenPayload (userId, appId, name, email) to req.user.
 *
 * The token is the Supabase session.access_token sent by the frontend.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await resolveTokenToPayload(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
