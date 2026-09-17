import { Router, Response } from 'express';
import { ContactRepository } from '../repositories/contactRepository';
import { UserRepository } from '../repositories/userRepository';
import { requireAuth, AuthenticatedRequest } from '../middlewares/authMiddleware';
import { isValidAppId } from '@callapp/shared';
import { PresenceManager } from '../presence/presenceManager';

const router = Router();

/**
 * GET /api/contacts
 * Returns the authenticated user's contact list with presence status.
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const contacts = await ContactRepository.getByUserId(req.user.userId);
  const enriched = contacts.map(c => ({
    ...c,
    presence: PresenceManager.getPresence(c.contactAppId),
  }));
  res.json({ contacts: enriched });
});

/**
 * POST /api/contacts
 * Add a new contact by App ID. Verifies the target user exists.
 */
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { contactAppId, contactName } = req.body;
  if (!isValidAppId(contactAppId)) {
    res.status(400).json({ error: 'Invalid 10-digit App ID' });
    return;
  }

  if (contactAppId === req.user.appId) {
    res.status(400).json({ error: 'You cannot add yourself as a contact' });
    return;
  }

  // Verify target user exists
  const targetUser = await UserRepository.findByAppId(contactAppId);
  if (!targetUser) {
    res.status(404).json({ error: 'User with this App ID does not exist' });
    return;
  }

  try {
    const contact = await ContactRepository.addContact(
      req.user.userId,
      contactAppId,
      contactName
    );

    res.status(201).json({
      contact: {
        ...contact,
        presence: PresenceManager.getPresence(contactAppId),
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add contact' });
  }
});

/**
 * DELETE /api/contacts/:id
 * Remove a contact by contact record ID.
 */
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const success = await ContactRepository.removeContact(req.user.userId, req.params.id);
  res.json({ success });
});

export default router;
