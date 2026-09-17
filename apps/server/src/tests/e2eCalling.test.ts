/**
 * PHASE 12: End-to-End Multi-Client Calling Flow Verification
 *
 * After Supabase migration, users are created via Supabase Auth (client SDK).
 * This test suite simulates the full signaling flow using pre-configured
 * test user tokens.
 *
 * To run these tests against a real Supabase instance:
 *
 *  1. Create two test accounts in Supabase Auth
 *  2. Sign them in to get access_tokens
 *  3. Set environment variables:
 *       TEST_USER_A_TOKEN=<supabase_access_token>
 *       TEST_USER_A_APP_ID=<10-digit-app-id>
 *       TEST_USER_A_NAME=<display_name>
 *       TEST_USER_B_TOKEN=<supabase_access_token>
 *       TEST_USER_B_APP_ID=<10-digit-app-id>
 *       TEST_USER_B_NAME=<display_name>
 *
 * If those variables are not set, the test suite is skipped gracefully.
 *
 * The WebRTC signaling logic (offer/answer/ICE relay) is tested in full.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { startServer, server } from '../server';
import { PresenceManager } from '../presence/presenceManager';
import { CallRepository } from '../repositories/callRepository';

const TEST_TOKEN_A = process.env.TEST_USER_A_TOKEN ?? '';
const TEST_APP_ID_A = process.env.TEST_USER_A_APP_ID ?? '';
const TEST_NAME_A = process.env.TEST_USER_A_NAME ?? 'Valence';
const TEST_TOKEN_B = process.env.TEST_USER_B_TOKEN ?? '';
const TEST_APP_ID_B = process.env.TEST_USER_B_APP_ID ?? '';
const TEST_NAME_B = process.env.TEST_USER_B_NAME ?? 'John';

const SKIP_E2E = !TEST_TOKEN_A || !TEST_APP_ID_A || !TEST_TOKEN_B || !TEST_APP_ID_B;

describe('PHASE 12: End-to-End Multi-Client Calling Flow Verification', () => {
  let socketWebA: ClientSocketType;
  let socketDesktopB: ClientSocketType;
  let activeCallId = '';

  const serverPort = 5055;
  const serverUrl = `http://localhost:${serverPort}`;

  before(async () => {
    if (SKIP_E2E) {
      console.log(
        '[E2E Test] Skipping: TEST_USER_A_TOKEN, TEST_USER_A_APP_ID, TEST_USER_B_TOKEN, TEST_USER_B_APP_ID not set.\n' +
        '           Set these env vars to run full E2E tests against a real Supabase instance.\n' +
        '           These tests require a running signaling server with valid Supabase credentials.'
      );
      // Do NOT start the server — it requires Supabase credentials
      return;
    }

    // Start test server on dedicated port (requires SUPABASE_* env vars)
    await startServer(serverPort);
  });

  after(() => {
    socketWebA?.disconnect();
    socketDesktopB?.disconnect();
    if (server?.listening) {
      server.close();
    }
  });


  it('1. Web Client A and Desktop Client B connect & authenticate with signaling server', async () => {
    if (SKIP_E2E) {
      console.log('  [SKIP] E2E test requires real Supabase tokens');
      return;
    }

    socketWebA = ClientSocket(serverUrl, {
      auth: { token: TEST_TOKEN_A, deviceType: 'web' },
      transports: ['websocket'],
    });

    socketDesktopB = ClientSocket(serverUrl, {
      auth: { token: TEST_TOKEN_B, deviceType: 'desktop' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        socketWebA.on('connect', resolve);
        socketWebA.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        socketDesktopB.on('connect', resolve);
        socketDesktopB.on('connect_error', reject);
      }),
    ]);

    assert.ok(socketWebA.connected, 'Web Client A must be connected');
    assert.ok(socketDesktopB.connected, 'Desktop Client B must be connected');

    // Verify online presence
    assert.strictEqual(PresenceManager.isUserOnline(TEST_APP_ID_A), true);
    assert.strictEqual(PresenceManager.isUserOnline(TEST_APP_ID_B), true);
  });

  it('2. Web Client A calls Desktop Client B (Valid App ID & Online Check)', async () => {
    if (SKIP_E2E || !socketWebA?.connected) {
      console.log('  [SKIP] Requires connected sockets from test 1');
      return;
    }

    const incomingPromise = new Promise<{ callId: string; callerName: string; callerAppId: string }>(resolve => {
      socketDesktopB.once('call:incoming', data => resolve(data));
    });

    const ringingPromise = new Promise<{ callId: string; targetName: string }>(resolve => {
      socketWebA.once('call:ringing', data => resolve(data));
    });

    // User A dials User B's 10-digit App ID
    const initiateResult = await new Promise<any>(resolve => {
      socketWebA.emit('call:initiate', { targetAppId: TEST_APP_ID_B }, resolve);
    });

    assert.strictEqual(initiateResult.success, true, 'Call initiation must succeed');
    assert.ok(initiateResult.callId, 'Call ID must be returned');
    activeCallId = initiateResult.callId;

    const incomingData = await incomingPromise;
    assert.strictEqual(incomingData.callerAppId, TEST_APP_ID_A);
    assert.strictEqual(incomingData.callerName, TEST_NAME_A);
    assert.strictEqual(incomingData.callId, initiateResult.callId);

    const ringingData = await ringingPromise;
    assert.strictEqual(ringingData.callId, initiateResult.callId);
    assert.strictEqual(ringingData.targetName, TEST_NAME_B);
  });

  it('3. Desktop Client B accepts call -> WebRTC signaling & in_call state verification', async () => {
    if (SKIP_E2E || !activeCallId) {
      console.log('  [SKIP] Requires active call from test 2');
      return;
    }

    const acceptedPromiseA = new Promise<any>(resolve => socketWebA.once('call:accepted', resolve));
    const acceptedPromiseB = new Promise<any>(resolve => socketDesktopB.once('call:accepted', resolve));

    // Desktop B accepts
    socketDesktopB.emit('call:accept', { callId: activeCallId });

    const [accA, accB] = await Promise.all([acceptedPromiseA, acceptedPromiseB]);

    assert.strictEqual(accA.callId, activeCallId);
    assert.strictEqual(accB.callId, activeCallId);
    assert.ok(accA.webrtcConfig.iceServers.length > 0, 'ICE Servers config must be provided');

    // Check in_call presence status
    assert.strictEqual(PresenceManager.isUserInCall(TEST_APP_ID_A), true);
    assert.strictEqual(PresenceManager.isUserInCall(TEST_APP_ID_B), true);

    // Simulate WebRTC SDP Offer / Answer and ICE Candidate relay
    const offerPayload = { callId: activeCallId, sdp: { type: 'offer' as const, sdp: 'v=0\r\no=alice 123 456 IN IP4 127.0.0.1' } };
    const answerPayload = { callId: activeCallId, sdp: { type: 'answer' as const, sdp: 'v=0\r\no=bob 789 012 IN IP4 127.0.0.1' } };
    const icePayload = { callId: activeCallId, candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host', sdpMid: 'audio', sdpMLineIndex: 0 } };

    const offerPromise = new Promise<any>(resolve => socketDesktopB.once('webrtc:offer', resolve));
    socketWebA.emit('webrtc:offer', offerPayload);
    const receivedOffer = await offerPromise;
    assert.strictEqual(receivedOffer.sdp.sdp, offerPayload.sdp.sdp);

    const answerPromise = new Promise<any>(resolve => socketWebA.once('webrtc:answer', resolve));
    socketDesktopB.emit('webrtc:answer', answerPayload);
    const receivedAnswer = await answerPromise;
    assert.strictEqual(receivedAnswer.sdp.sdp, answerPayload.sdp.sdp);

    const icePromise = new Promise<any>(resolve => socketDesktopB.once('webrtc:ice-candidate', resolve));
    socketWebA.emit('webrtc:ice-candidate', icePayload);
    const receivedIce = await icePromise;
    assert.strictEqual(receivedIce.candidate.candidate, icePayload.candidate.candidate);
  });

  it('4. Web Client A hangs up -> call completion, duration, and return to online presence', async () => {
    if (SKIP_E2E || !activeCallId) {
      console.log('  [SKIP] Requires active call from test 3');
      return;
    }

    const endedPromiseA = new Promise<any>(resolve => socketWebA.once('call:ended', resolve));
    const endedPromiseB = new Promise<any>(resolve => socketDesktopB.once('call:ended', resolve));

    socketWebA.emit('call:hangup', { callId: activeCallId });

    const [endA, endB] = await Promise.all([endedPromiseA, endedPromiseB]);
    assert.strictEqual(endA.callId, activeCallId);
    assert.strictEqual(endB.callId, activeCallId);

    // Wait a moment for async Supabase write to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify call record in Supabase
    const dbCall = await CallRepository.getById(activeCallId);
    assert.strictEqual(dbCall?.status, 'completed');

    // Both users return to idle online presence
    assert.strictEqual(PresenceManager.isUserInCall(TEST_APP_ID_A), false);
    assert.strictEqual(PresenceManager.isUserInCall(TEST_APP_ID_B), false);
    assert.strictEqual(PresenceManager.isUserOnline(TEST_APP_ID_A), true);
    assert.strictEqual(PresenceManager.isUserOnline(TEST_APP_ID_B), true);
  });

  it('5. Desktop Client B calls Web Client A and Web A rejects (Declined flow)', async () => {
    if (SKIP_E2E || !socketWebA?.connected) {
      console.log('  [SKIP] Requires connected sockets from test 1');
      return;
    }

    const incomingPromise = new Promise<any>(resolve => socketWebA.once('call:incoming', resolve));
    const initRes = await new Promise<any>(resolve => {
      socketDesktopB.emit('call:initiate', { targetAppId: TEST_APP_ID_A }, resolve);
    });

    assert.strictEqual(initRes.success, true);
    const declineCallId = initRes.callId;

    await incomingPromise;

    const declinedPromise = new Promise<any>(resolve => socketDesktopB.once('call:declined', resolve));
    socketWebA.emit('call:reject', { callId: declineCallId, reason: 'Busy in meeting' });

    const declinedData = await declinedPromise;
    assert.strictEqual(declinedData.callId, declineCallId);

    // Wait for Supabase async write
    await new Promise(resolve => setTimeout(resolve, 500));

    const dbCall = await CallRepository.getById(declineCallId);
    assert.strictEqual(dbCall?.status, 'declined');
  });

  it('6. Validation & Error Handling: Invalid App IDs, self calling, offline callee', async () => {
    if (SKIP_E2E || !socketWebA?.connected) {
      console.log('  [SKIP] Requires connected sockets from test 1');
      return;
    }

    // 1. Invalid App ID format
    const res1 = await new Promise<any>(resolve => {
      socketWebA.emit('call:initiate', { targetAppId: '12345' }, resolve);
    });
    assert.strictEqual(res1.success, false);
    assert.strictEqual(res1.error.code, 'INVALID_APP_ID');

    // 2. Call self
    const res2 = await new Promise<any>(resolve => {
      socketWebA.emit('call:initiate', { targetAppId: TEST_APP_ID_A }, resolve);
    });
    assert.strictEqual(res2.success, false);
    assert.strictEqual(res2.error.code, 'INVALID_APP_ID');

    // 3. User Not Found (valid format but non-existent App ID)
    const res3 = await new Promise<any>(resolve => {
      socketWebA.emit('call:initiate', { targetAppId: '0999999999' }, resolve);
    });
    assert.strictEqual(res3.success, false);
    assert.strictEqual(res3.error.code, 'USER_NOT_FOUND');
  });
});
