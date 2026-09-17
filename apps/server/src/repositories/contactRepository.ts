/**
 * ContactRepository — Supabase implementation
 *
 * Manages contacts in the Supabase `contacts` table.
 * The contacts table uses UUID references (user_id, contact_user_id).
 * Externally-facing methods accept/return App IDs for UI compatibility.
 *
 * The service_role admin client bypasses RLS for all server-side operations.
 */
import { getSupabaseAdmin } from '../db/supabaseAdmin';
import { Contact } from '@callapp/shared';

interface ContactRow {
  id: string;
  user_id: string;
  contact_user_id: string;
  created_at: string;
  contact_profile?: {
    display_name: string;
    app_id: string;
  } | null;
}

function mapRowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    userId: row.user_id,
    contactAppId: row.contact_profile?.app_id ?? '',
    contactName: row.contact_profile?.display_name ?? 'Unknown',
    createdAt: row.created_at,
  };
}

/**
 * Resolve a 10-digit App ID to a Supabase user UUID.
 */
async function resolveAppIdToUserId(appId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('app_id', appId)
    .single();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

export class ContactRepository {
  /**
   * Get all contacts for a user (identified by their Supabase UUID).
   * Returns contacts with App IDs and names from the joined profiles.
   */
  static async getByUserId(userId: string): Promise<Contact[]> {
    const admin = getSupabaseAdmin();

    const { data, error } = await admin
      .from('contacts')
      .select(`
        id,
        user_id,
        contact_user_id,
        created_at,
        contact_profile:profiles!contacts_contact_user_id_fkey(display_name, app_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    return (data as unknown as ContactRow[]).map(mapRowToContact);
  }

  /**
   * Add a contact. Resolves the contactAppId to a UUID internally.
   * Returns the existing contact if already added (upsert semantics).
   */
  static async addContact(
    userId: string,
    contactAppId: string,
    _contactName?: string // name is sourced from profiles, not stored separately
  ): Promise<Contact> {
    const admin = getSupabaseAdmin();

    const contactUserId = await resolveAppIdToUserId(contactAppId);
    if (!contactUserId) {
      throw new Error(`User with App ID ${contactAppId} does not exist`);
    }

    // Check for existing contact
    const { data: existing } = await admin
      .from('contacts')
      .select('id, user_id, contact_user_id, created_at')
      .eq('user_id', userId)
      .eq('contact_user_id', contactUserId)
      .single();

    if (existing) {
      // Already exists — return enriched version
      const contacts = await this.getByUserId(userId);
      const found = contacts.find(c => c.contactAppId === contactAppId);
      if (found) return found;
    }

    // Insert new contact
    const { data, error } = await admin
      .from('contacts')
      .insert({
        user_id: userId,
        contact_user_id: contactUserId,
      })
      .select(`
        id,
        user_id,
        contact_user_id,
        created_at,
        contact_profile:profiles!contacts_contact_user_id_fkey(display_name, app_id)
      `)
      .single();

    if (error || !data) {
      throw new Error(`Failed to add contact: ${error?.message}`);
    }

    return mapRowToContact(data as unknown as ContactRow);
  }

  /**
   * Remove a contact by contact record ID (not the contact user's UUID).
   * Verifies that the requesting user owns the contact row.
   */
  static async removeContact(userId: string, contactId: string): Promise<boolean> {
    const admin = getSupabaseAdmin();

    const { error, count } = await admin
      .from('contacts')
      .delete({ count: 'exact' })
      .eq('id', contactId)
      .eq('user_id', userId);

    if (error) {
      console.error('[ContactRepository] removeContact error:', error.message);
      return false;
    }

    return (count ?? 0) > 0;
  }
}
