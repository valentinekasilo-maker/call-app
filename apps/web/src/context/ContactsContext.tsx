import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Contact, formatAppId, isValidAppId } from '@callapp/shared';
import { useAuth } from './AuthContext';

interface ContactsContextType {
  contacts: Contact[];
  contactsMap: Record<string, Contact>;
  isLoading: boolean;
  resolveContactDisplayName: (appId: string, fallbackName?: string) => string;
  isContactSaved: (appId: string) => boolean;
  getContact: (appId: string) => Contact | undefined;
  addContact: (contactAppId: string, contactName: string) => Promise<Contact>;
  deleteContact: (contactIdOrAppId: string) => Promise<void>;
  refreshContacts: () => Promise<void>;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

export const ContactsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const userAppId = user?.appId?.replace(/\D/g, '') || '';
  const STORAGE_KEY = `callapp_contacts_${userAppId}`;

  // 1. Initialize contacts synchronously from localStorage
  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (!userAppId) return [];
    try {
      const saved = localStorage.getItem(`callapp_contacts_${userAppId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 2. Build fast lookup map keyed by clean 10-digit App ID
  const contactsMap = useMemo(() => {
    const map: Record<string, Contact> = {};
    for (const c of contacts) {
      const clean = c.contactAppId?.replace(/\D/g, '');
      if (clean) {
        map[clean] = c;
      }
    }
    return map;
  }, [contacts]);

  // 3. Centralized Contact Display Name Resolver (Priority: 1. Saved Contact Name -> 2. Profile Name -> 3. App ID)
  const resolveContactDisplayName = useCallback(
    (appId: string, fallbackName?: string): string => {
      if (!appId) return fallbackName || 'User';
      const cleanId = appId.replace(/\D/g, '');

      // 1. Locally saved contact name
      const saved = contactsMap[cleanId];
      if (saved && saved.contactName && saved.contactName.trim()) {
        return saved.contactName.trim();
      }

      // 2. Existing profile/display name (if not generic "User" or placeholder)
      if (
        fallbackName &&
        fallbackName.trim() &&
        !fallbackName.toLowerCase().startsWith('user (') &&
        fallbackName.toLowerCase() !== 'user' &&
        fallbackName.toLowerCase() !== 'calling...'
      ) {
        return fallbackName.trim();
      }

      // 3. App ID formatted as fallback
      return formatAppId(cleanId);
    },
    [contactsMap]
  );

  const isContactSaved = useCallback(
    (appId: string): boolean => {
      const cleanId = appId?.replace(/\D/g, '');
      return !!(cleanId && contactsMap[cleanId]);
    },
    [contactsMap]
  );

  const getContact = useCallback(
    (appId: string): Contact | undefined => {
      const cleanId = appId?.replace(/\D/g, '');
      return cleanId ? contactsMap[cleanId] : undefined;
    },
    [contactsMap]
  );

  // Sync to localStorage
  const persistContacts = useCallback(
    (newContacts: Contact[]) => {
      if (userAppId) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
        } catch (e) {
          console.warn('[ContactsContext] Failed to save to localStorage:', e);
        }
      }
    },
    [userAppId, STORAGE_KEY]
  );

  // Refresh from API / Supabase
  const refreshContacts = useCallback(async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch('/api/contacts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: Contact[] = data.contacts || [];
        setContacts(list);
        persistContacts(list);
      }
    } catch (e) {
      console.warn('[ContactsContext] Failed to fetch contacts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [token, persistContacts]);

  // Load from server on auth token or account change
  useEffect(() => {
    if (userAppId) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          setContacts(JSON.parse(saved));
        }
      } catch {}
      refreshContacts();
    } else {
      setContacts([]);
    }
  }, [userAppId, token]);

  // Add Contact
  const addContact = useCallback(
    async (contactAppId: string, contactName: string): Promise<Contact> => {
      const cleanId = contactAppId.replace(/\D/g, '');
      const trimmedName = contactName.trim();

      if (!isValidAppId(cleanId)) {
        throw new Error('Please enter a valid 10-digit App ID');
      }
      if (!trimmedName) {
        throw new Error('Please enter a contact name');
      }
      if (cleanId === userAppId) {
        throw new Error('You cannot add yourself as a contact');
      }

      // Optimistic local contact object
      const tempContact: Contact = {
        id: `local_cnt_${Date.now()}`,
        userId: user?.id || '',
        contactAppId: cleanId,
        contactName: trimmedName,
        createdAt: new Date().toISOString(),
      };

      let finalContact = tempContact;
      if (token) {
        try {
          const res = await fetch('/api/contacts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              contactAppId: cleanId,
              contactName: trimmedName,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.contact) {
              finalContact = data.contact;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            if (errData.error && !errData.error.includes('already exists')) {
              throw new Error(errData.error);
            }
          }
        } catch (err: any) {
          console.warn('[ContactsContext] Server add error, keeping local:', err.message);
        }
      }

      setContacts(prev => {
        const filtered = prev.filter(c => c.contactAppId.replace(/\D/g, '') !== cleanId);
        const updated = [finalContact, ...filtered];
        persistContacts(updated);
        return updated;
      });

      return finalContact;
    },
    [userAppId, user?.id, token, persistContacts]
  );

  // Delete Contact
  const deleteContact = useCallback(
    async (contactIdOrAppId: string): Promise<void> => {
      const cleanId = contactIdOrAppId.replace(/\D/g, '');
      const found = contacts.find(
        c => c.id === contactIdOrAppId || c.contactAppId.replace(/\D/g, '') === cleanId
      );

      if (token && found && found.id && !found.id.startsWith('local_cnt_')) {
        try {
          await fetch(`/api/contacts/${found.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (e) {
          console.warn('[ContactsContext] Delete contact failed on server:', e);
        }
      }

      setContacts(prev => {
        const updated = prev.filter(
          c => c.id !== contactIdOrAppId && c.contactAppId.replace(/\D/g, '') !== cleanId
        );
        persistContacts(updated);
        return updated;
      });
    },
    [token, contacts, persistContacts]
  );

  return (
    <ContactsContext.Provider
      value={{
        contacts,
        contactsMap,
        isLoading,
        resolveContactDisplayName,
        isContactSaved,
        getContact,
        addContact,
        deleteContact,
        refreshContacts,
      }}
    >
      {children}
    </ContactsContext.Provider>
  );
};

export const useContacts = (): ContactsContextType => {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
};
