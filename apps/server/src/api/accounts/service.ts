import { UserRepository } from '../../repositories/userRepository';
import { ApiAuthService, GeneratedApiKey } from '../auth/service';
import { getSupabaseAdmin } from '../../db/supabaseAdmin';

export interface AccountCreationResult {
  id: string;
  name: string;
  app_id: string;
  type: string;
  metadata: Record<string, any>;
  api_key: GeneratedApiKey;
  created_at: string;
}

export class AccountService {
  /**
   * Create an application calling account with a unique 10-digit App ID and initial API key.
   */
  static async createAccount(
    name: string,
    type: string = 'ai',
    metadata: Record<string, any> = {}
  ): Promise<AccountCreationResult> {
    const validTypes = ['human', 'ai', 'bot', 'service', 'device'];
    const normalizedType = validTypes.includes(type) ? type : 'ai';

    // 1. Create account in Supabase (triggers profile + unique 10-digit App ID generation)
    const user = await UserRepository.createApplicationAccount(name, normalizedType, metadata);

    // 2. Generate initial API Key for this new application account
    const apiKey = await ApiAuthService.generateApiKey(
      user.appId,
      `${name} Primary Key`,
      ['*'] // Full access for primary key
    );

    return {
      id: user.id,
      name: user.name,
      app_id: user.appId,
      type: user.accountType || normalizedType,
      metadata: user.metadata || metadata,
      api_key: apiKey,
      created_at: user.createdAt,
    };
  }

  /**
   * Assign an existing account to an application.
   */
  static async assignAccount(
    accountIdOrAppId: string,
    application: string
  ): Promise<{ success: boolean; app_id: string; message: string }> {
    const admin = getSupabaseAdmin();

    // Look up by UUID or App ID
    let user = await UserRepository.findById(accountIdOrAppId);
    if (!user) {
      user = await UserRepository.findByAppId(accountIdOrAppId);
    }

    if (!user) {
      throw new Error(`Account not found: ${accountIdOrAppId}`);
    }

    const currentMeta = user.metadata || {};
    const updatedMeta = { ...currentMeta, assigned_application: application, assigned_at: new Date().toISOString() };

    await admin
      .from('profiles')
      .update({ metadata: updatedMeta })
      .eq('id', user.id);

    return {
      success: true,
      app_id: user.appId,
      message: `Account ${user.appId} successfully assigned to application ${application}`,
    };
  }
}
