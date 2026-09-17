import { Request, Response, NextFunction } from 'express';
import { IdentityService } from '../identities/service';
import { AuthenticatedIdentity, ApiClientInfo } from '@callapp/shared';

// Extend Express Request interface to include identity
declare global {
  namespace Express {
    interface Request {
      identity?: AuthenticatedIdentity;
      apiClient?: ApiClientInfo;
    }
  }
}

/**
 * Middleware that authenticates incoming requests using a Calling Identity API Key (Bearer sk_live_...).
 * Resolves the API key to a COMPLETE CALLING IDENTITY.
 */
export async function requireApiAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let rawKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    rawKey = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    rawKey = apiKeyHeader.trim();
  }

  if (!rawKey) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing API Key. Please provide Authorization: Bearer <YOUR_API_KEY> or X-API-Key header.',
      },
    });
    return;
  }

  try {
    const identity = await IdentityService.verifyApiKey(rawKey);

    if (!identity) {
      res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'The provided API Key is invalid, inactive, or has been revoked.',
        },
      });
      return;
    }

    if (identity.status !== 'active') {
      res.status(403).json({
        error: {
          code: 'IDENTITY_INACTIVE',
          message: `This calling identity (${identity.name} - ${identity.appId}) is currently ${identity.status}.`,
        },
      });
      return;
    }

    req.identity = identity;
    // Set apiClient alias for backward compatibility with existing routes
    req.apiClient = {
      keyId: identity.credentialId,
      identityId: identity.id,
      appId: identity.appId,
      name: identity.name,
      accountType: identity.type,
      permissions: identity.permissions,
    };

    next();
  } catch (err: any) {
    console.error('[apiAuth] Authentication verification error:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during API authentication.',
      },
    });
  }
}

/**
 * Middleware factory to enforce specific calling permissions (e.g. 'call', 'receive_call', 'lookup', 'presence').
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const permissions = req.identity?.permissions || req.apiClient?.permissions || [];

    if (permissions.length === 0) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
      });
      return;
    }

    // Permission alias mapping for compatibility (e.g. 'calls:write' -> 'call', 'calls:read' -> 'call_history')
    const hasPerm =
      permissions.includes(permission) ||
      permissions.includes('*') ||
      (permission === 'calls:write' && permissions.includes('call')) ||
      (permission === 'calls:read' && (permissions.includes('call_history') || permissions.includes('call'))) ||
      (permission === 'devices:write' && permissions.includes('presence')) ||
      (permission === 'accounts:read' && permissions.includes('lookup')) ||
      (permission === 'accounts:write' && permissions.includes('manage_identity'));

    if (!hasPerm) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Your identity credential does not have the required permission: ${permission}`,
        },
      });
      return;
    }

    next();
  };
}
