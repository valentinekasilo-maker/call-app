import { CallManager } from '../../signaling/callManager';
import { CallRepository } from '../../repositories/callRepository';
import { CallRecord } from '@callapp/shared';

export class CallService {
  /**
   * Initiate a call between two App IDs via CallManager and Supabase.
   */
  static async initiateCall(callerAppId: string, targetAppId: string) {
    const result = await CallManager.initiateApiCall(callerAppId, targetAppId);
    return {
      call_id: result.callId,
      status: result.status,
      from: result.from,
      to: result.to,
    };
  }

  /**
   * Get a call by ID.
   */
  static async getCallById(callId: string, requesterAppId: string): Promise<CallRecord | null> {
    const record = await CallRepository.getById(callId);
    if (!record) return null;

    // Authorization check: requester must be caller or receiver
    if (record.callerAppId !== requesterAppId && record.receiverAppId !== requesterAppId) {
      throw new Error('UNAUTHORIZED_CALL_ACCESS');
    }

    return record;
  }

  /**
   * List recent call history for an App ID.
   */
  static async listCallsForAppId(appId: string, limit: number = 50): Promise<CallRecord[]> {
    return CallRepository.getHistoryForAppId(appId, limit);
  }

  /**
   * Accept an incoming ringing call.
   */
  static async acceptCall(callId: string, receiverAppId: string) {
    return CallManager.acceptApiCall(callId, receiverAppId);
  }

  /**
   * Decline an incoming ringing call.
   */
  static async declineCall(callId: string, receiverAppId: string, reason?: string) {
    return CallManager.declineApiCall(callId, receiverAppId, reason);
  }

  /**
   * End an active call.
   */
  static async endCall(callId: string, participantAppId: string, reason?: string) {
    return CallManager.endApiCall(callId, participantAppId, reason);
  }
}
