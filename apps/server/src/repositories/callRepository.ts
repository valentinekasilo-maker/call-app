/**
 * CallRepository — Supabase implementation
 *
 * Manages call records in the Supabase `calls` table.
 * The calls table uses UUID foreign keys (caller_id, receiver_id) referencing profiles.
 * The signaling server passes App IDs, so we resolve them to UUIDs internally.
 *
 * The service_role admin client bypasses RLS, so these writes are trusted server operations.
 * Clients cannot insert/modify call records directly.
 */
import { getSupabaseAdmin } from '../db/supabaseAdmin';
import { CallRecord, CallStatus } from '@callapp/shared';

interface CallRow {
  id: string;
  caller_id: string;
  receiver_id: string;
  status: CallStatus;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface CallRowWithProfiles extends CallRow {
  caller: { display_name: string; app_id: string } | null;
  receiver: { display_name: string; app_id: string } | null;
}

function mapRowToRecord(row: CallRowWithProfiles): CallRecord {
  return {
    id: row.id,
    callerAppId: row.caller?.app_id ?? '',
    callerName: row.caller?.display_name ?? 'Unknown',
    receiverAppId: row.receiver?.app_id ?? '',
    receiverName: row.receiver?.display_name ?? 'Unknown',
    status: row.status,
    startedAt: row.started_at ?? row.created_at,
    answeredAt: row.answered_at ?? null,
    endedAt: row.ended_at ?? null,
    duration: row.duration_seconds ?? 0,
  };
}

/**
 * Resolve a 10-digit App ID to a Supabase profile UUID.
 * Returns null if not found.
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

export class CallRepository {
  /**
   * Create a new call record. Resolves App IDs to user UUIDs.
   * Called by CallManager when a call is initiated.
   */
  static async createCall(callerAppId: string, receiverAppId: string): Promise<CallRecord> {
    const admin = getSupabaseAdmin();

    const [callerId, receiverId] = await Promise.all([
      resolveAppIdToUserId(callerAppId),
      resolveAppIdToUserId(receiverAppId),
    ]);

    if (!callerId) throw new Error(`Caller with App ID ${callerAppId} not found`);
    if (!receiverId) throw new Error(`Receiver with App ID ${receiverAppId} not found`);

    const now = new Date().toISOString();

    const { data, error } = await admin
      .from('calls')
      .insert({
        caller_id: callerId,
        receiver_id: receiverId,
        status: 'ringing',
        started_at: now,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create call record: ${error?.message}`);
    }

    return {
      id: (data as CallRow).id,
      callerAppId,
      receiverAppId,
      status: 'ringing',
      startedAt: now,
      answeredAt: null,
      endedAt: null,
      duration: 0,
    };
  }

  /**
   * Fetch a call record by ID (with profile join for names + app IDs).
   */
  static async getById(id: string): Promise<CallRecord | null> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey(display_name, app_id),
        receiver:profiles!calls_receiver_id_fkey(display_name, app_id)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return mapRowToRecord(data as CallRowWithProfiles);
  }

  /**
   * Mark a ringing call as accepted and record the answered_at timestamp.
   */
  static async markAnswered(id: string): Promise<void> {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('calls')
      .update({
        status: 'accepted',
        answered_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'ringing');

    if (error) {
      console.error(`[CallRepository] markAnswered failed for ${id}:`, error.message);
    }
  }

  /**
   * End a call by updating its status, ended_at, and duration_seconds.
   */
  static async endCall(
    id: string,
    status: CallStatus,
    duration?: number
  ): Promise<CallRecord | null> {
    const admin = getSupabaseAdmin();

    const now = new Date().toISOString();

    // If duration not provided, try to compute from answered_at
    let finalDuration = duration ?? 0;
    if (!duration) {
      const existing = await this.getById(id);
      if (existing?.answeredAt) {
        const startMs = new Date(existing.answeredAt).getTime();
        const endMs = new Date(now).getTime();
        finalDuration = Math.max(0, Math.floor((endMs - startMs) / 1000));
      }
    }

    const { error } = await admin
      .from('calls')
      .update({
        status,
        ended_at: now,
        duration_seconds: finalDuration,
      })
      .eq('id', id);

    if (error) {
      console.error(`[CallRepository] endCall failed for ${id}:`, error.message);
      return null;
    }

    return this.getById(id);
  }

  /**
   * Get call history for a user identified by their App ID.
   * Returns the 50 most recent calls in descending order.
   */
  static async getHistoryForAppId(appId: string, limit: number = 50): Promise<CallRecord[]> {
    const admin = getSupabaseAdmin();

    // Resolve App ID to UUID first
    const userId = await resolveAppIdToUserId(appId);
    if (!userId) return [];

    const { data, error } = await admin
      .from('calls')
      .select(`
        *,
        caller:profiles!calls_caller_id_fkey(display_name, app_id),
        receiver:profiles!calls_receiver_id_fkey(display_name, app_id)
      `)
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return (data as CallRowWithProfiles[]).map(mapRowToRecord);
  }
}
