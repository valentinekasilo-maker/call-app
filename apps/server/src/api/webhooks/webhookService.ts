import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { getSupabaseAdmin } from '../../db/supabaseAdmin';
import { WebhookEventPayload, CallStatus, AccountType } from '@callapp/shared';

export interface WebhookEndpointRecord {
  id: string;
  app_id: string;
  url: string;
  secret: string;
  events: string[];
  is_active: boolean;
  created_at: string;
}

export class WebhookService {
  /**
   * Register a new webhook endpoint.
   */
  static async registerEndpoint(
    appId: string,
    url: string,
    secret?: string,
    events: string[] = ['*']
  ): Promise<WebhookEndpointRecord> {
    const admin = getSupabaseAdmin();
    const webhookSecret = secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const { data, error } = await admin
      .from('webhook_endpoints')
      .insert({
        app_id: appId,
        url,
        secret: webhookSecret,
        events,
        is_active: true,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to register webhook endpoint: ${error?.message || 'Unknown error'}`);
    }

    return data as WebhookEndpointRecord;
  }

  /**
   * List webhook endpoints for an App ID.
   */
  static async listEndpoints(appId: string): Promise<WebhookEndpointRecord[]> {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('webhook_endpoints')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data as WebhookEndpointRecord[];
  }

  /**
   * Delete a webhook endpoint by ID (ensuring ownership by appId).
   */
  static async deleteEndpoint(id: string, appId: string): Promise<boolean> {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('webhook_endpoints')
      .delete()
      .eq('id', id)
      .eq('app_id', appId);

    return !error;
  }

  /**
   * Dispatch a call lifecycle event to all subscribed webhook endpoints.
   */
  static async dispatchCallEvent(
    event: WebhookEventPayload['event'],
    callInfo: {
      callId: string;
      callerAppId: string;
      callerName: string;
      callerType?: AccountType;
      receiverAppId: string;
      receiverName: string;
      receiverType?: AccountType;
      status: CallStatus;
      startedAt?: string;
      answeredAt?: string | null;
      endedAt?: string | null;
      duration?: number;
    }
  ): Promise<void> {
    try {
      const admin = getSupabaseAdmin();
      const targetAppIds = [callInfo.callerAppId, callInfo.receiverAppId];

      const { data: endpoints, error } = await admin
        .from('webhook_endpoints')
        .select('*')
        .in('app_id', targetAppIds)
        .eq('is_active', true);

      if (error || !endpoints || endpoints.length === 0) {
        return;
      }

      const timestamp = new Date().toISOString();
      const payload: WebhookEventPayload = {
        event,
        call_id: callInfo.callId,
        caller: {
          app_id: callInfo.callerAppId,
          name: callInfo.callerName,
          type: callInfo.callerType || 'human',
        },
        receiver: {
          app_id: callInfo.receiverAppId,
          name: callInfo.receiverName,
          type: callInfo.receiverType || 'human',
        },
        from: {
          app_id: callInfo.callerAppId,
          name: callInfo.callerName,
          account_type: callInfo.callerType || 'human',
        },
        to: {
          app_id: callInfo.receiverAppId,
          name: callInfo.receiverName,
          account_type: callInfo.receiverType || 'human',
        },
        status: callInfo.status,
        started_at: callInfo.startedAt,
        answered_at: callInfo.answeredAt,
        ended_at: callInfo.endedAt,
        duration: callInfo.duration,
        timestamp,
      };

      const payloadJson = JSON.stringify(payload);

      for (const endpoint of endpoints as WebhookEndpointRecord[]) {
        // Check if endpoint is subscribed to this event
        if (
          endpoint.events.includes('*') ||
          endpoint.events.includes(event)
        ) {
          this.sendWebhookHttp(endpoint.url, endpoint.secret, payloadJson, event, timestamp).catch(
            err => console.error(`[WebhookService] Failed delivery to ${endpoint.url}:`, err.message)
          );
        }
      }
    } catch (err: any) {
      console.error('[WebhookService] Error dispatching event:', err);
    }
  }

  /**
   * Send HTTP POST request with HMAC signature.
   */
  private static sendWebhookHttp(
    url: string,
    secret: string,
    body: string,
    event: string,
    timestamp: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new URL(url);
        const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'X-CallApp-Signature': `sha256=${signature}`,
            'X-CallApp-Event': event,
            'X-CallApp-Timestamp': timestamp,
            'User-Agent': 'CallApp-Webhook/1.0',
          },
          timeout: 5000,
        };

        const client = parsedUrl.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
          res.resume(); // consume response data to free up memory
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook endpoint responded with HTTP ${res.statusCode}`));
          }
        });

        req.on('error', (err) => reject(err));
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Webhook request timed out'));
        });

        req.write(body);
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
