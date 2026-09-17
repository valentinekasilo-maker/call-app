import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  UserPresence,
  CallIncomingPayload,
  CallAcceptedPayload,
  CallDeclinedPayload,
  CallCancelledPayload,
  CallEndedPayload,
  CallErrorPayload,
  WebRTCOfferPayload,
  WebRTCAnswerPayload,
  WebRTCIceCandidatePayload,
  PresenceUpdatePayload,
} from '@callapp/shared';
import { WebRTCCallSession, CallConnectionState } from '@callapp/shared';
import { SoundManager } from '@callapp/shared';
import { CallNotificationManager } from '../utils/notifications';
import { useAuth } from './AuthContext';

export type CallUIState =
  | 'idle'
  | 'outgoing_ringing'
  | 'incoming_ringing'
  | 'active_call'
  | 'call_ending';

export interface ActiveCallInfo {
  callId: string;
  remoteAppId: string;
  remoteName: string;
  isIncoming: boolean;
  startedAt?: number;
  duration: number; // in seconds
  connectionState: CallConnectionState;
}

interface CallContextType {
  socket: Socket | null;
  isConnected: boolean;
  callState: CallUIState;
  activeCall: ActiveCallInfo | null;
  errorMessage: string | null;
  isMuted: boolean;
  localAudioLevel: number;
  presenceMap: Record<string, UserPresence>;
  unreadMissedCount: number;
  availableInputs: MediaDeviceInfo[];
  availableOutputs: MediaDeviceInfo[];
  selectedInputId: string;
  selectedOutputId: string;
  setSelectedInputId: (id: string) => void;
  setSelectedOutputId: (id: string) => void;
  initiateCall: (targetAppId: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  cancelCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  clearError: () => void;
  markMissedCallsViewed: () => void;
  queryPresence: (appIds: string[]) => void;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: ReactNode; deviceType?: 'web' | 'desktop' }> = ({
  children,
  deviceType = 'web',
}) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [callState, setCallState] = useState<CallUIState>('idle');
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [presenceMap, setPresenceMap] = useState<Record<string, UserPresence>>({});
  const [unreadMissedCount, setUnreadMissedCount] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('unread_missed_calls') || '0', 10);
    } catch (e) {
      return 0;
    }
  });

  const [availableInputs, setAvailableInputs] = useState<MediaDeviceInfo[]>([]);
  const [availableOutputs, setAvailableOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');

  const rtcSessionRef = useRef<WebRTCCallSession | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const durationTimerRef = useRef<any>(null);
  const incomingCallIdRef = useRef<string | null>(null);

  // Audio device enumeration
  useEffect(() => {
    const refreshDevices = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAvailableInputs(inputs);
        setAvailableOutputs(outputs);
        if (inputs.length > 0 && !selectedInputId) setSelectedInputId(inputs[0].deviceId);
        if (outputs.length > 0 && !selectedOutputId) setSelectedOutputId(outputs[0].deviceId);
      } catch (e) {
        console.warn('Device enumeration failed:', e);
      }
    };

    refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [selectedInputId, selectedOutputId]);

  // Request browser notification permission automatically on initial authenticated load
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Prompt once non-intrusively
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [user]);

  const cleanupCallSession = useCallback(() => {
    incomingCallIdRef.current = null;
    CallNotificationManager.clearNotification();
    SoundManager.stopAll();

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (rtcSessionRef.current) {
      rtcSessionRef.current.close();
      rtcSessionRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    // Electron popup cleanup if available
    if (typeof window !== 'undefined' && (window as any).electronAPI?.closeIncomingPopup) {
      (window as any).electronAPI.closeIncomingPopup();
    }

    setCallState('idle');
    setActiveCall(null);
    setIsMuted(false);
    setLocalAudioLevel(0);
  }, []);

  const acceptCall = useCallback(async () => {
    if (!socket || !activeCall) return;
    CallNotificationManager.clearNotification();
    SoundManager.stopRingtone();
    socket.emit('call:accept', { callId: activeCall.callId });
  }, [socket, activeCall]);

  const rejectCall = useCallback(() => {
    if (!socket || !activeCall) return;
    CallNotificationManager.clearNotification();
    SoundManager.stopRingtone();
    socket.emit('call:reject', { callId: activeCall.callId, reason: 'declined' });
    cleanupCallSession();
  }, [socket, activeCall, cleanupCallSession]);

  const cancelCall = useCallback(() => {
    if (!socket || !activeCall) return;
    CallNotificationManager.clearNotification();
    SoundManager.stopRingback();
    socket.emit('call:cancel', { callId: activeCall.callId });
    cleanupCallSession();
  }, [socket, activeCall, cleanupCallSession]);

  const endCall = useCallback(() => {
    if (!socket || !activeCall) return;
    CallNotificationManager.clearNotification();
    socket.emit('call:hangup', { callId: activeCall.callId });
    cleanupCallSession();
  }, [socket, activeCall, cleanupCallSession]);

  const markMissedCallsViewed = useCallback(() => {
    setUnreadMissedCount(0);
    try {
      localStorage.setItem('unread_missed_calls', '0');
    } catch (e) {}
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    return await CallNotificationManager.requestPermission();
  }, []);

  // Socket Connection Management
  useEffect(() => {
    if (!token || !user) {
      if (socket) socket.disconnect();
      return;
    }

    const signalingServerUrl = import.meta.env.VITE_SIGNALING_URL || undefined;
    const socketOptions = {
      auth: {
        token,
        deviceType,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    };

    const newSocket = signalingServerUrl
      ? io(signalingServerUrl, socketOptions)
      : io(socketOptions);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Presence update broadcast
    newSocket.on('presence:update', ({ appId, presence }: PresenceUpdatePayload) => {
      setPresenceMap(prev => ({ ...prev, [appId]: presence }));
    });

    // ──────────────────────────────────────────────────────────────
    // 1. INCOMING CALL EVENT (Ringtone + Notification + Modal)
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:incoming', (payload: CallIncomingPayload) => {
      // Idempotency: prevent multiple dialogs/rings for same call
      if (incomingCallIdRef.current === payload.callId) return;
      incomingCallIdRef.current = payload.callId;

      setCallState('incoming_ringing');
      setActiveCall({
        callId: payload.callId,
        remoteAppId: payload.callerAppId,
        remoteName: payload.callerName,
        isIncoming: true,
        duration: 0,
        connectionState: 'new',
      });

      // Start ringing audio loop
      SoundManager.playRingtone();

      // Show browser notification & flash background title
      CallNotificationManager.showIncomingCallNotification(
        payload.callId,
        payload.callerName,
        payload.callerAppId,
        () => acceptCall(),
        () => rejectCall()
      );

      // Windows Desktop Electron Popup bridge if running in Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI?.showIncomingPopup) {
        (window as any).electronAPI.showIncomingPopup({
          callId: payload.callId,
          callerAppId: payload.callerAppId,
          callerName: payload.callerName,
        });
      }
    });

    // ──────────────────────────────────────────────────────────────
    // 2. OUTGOING CALL RINGING
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:ringing', payload => {
      setCallState('outgoing_ringing');
      setActiveCall(prev => (prev ? { ...prev, remoteName: payload.targetName } : null));
      SoundManager.playRingback();
    });

    // ──────────────────────────────────────────────────────────────
    // 3. CALL ACCEPTED (WebRTC Audio Starts)
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:accepted', async (payload: CallAcceptedPayload) => {
      CallNotificationManager.clearNotification();
      SoundManager.playConnectedSound();
      setCallState('active_call');
      setActiveCall(prev =>
        prev
          ? {
              ...prev,
              remoteName: payload.receiverName || prev.remoteName,
              startedAt: Date.now(),
              connectionState: 'connecting',
            }
          : null
      );

      // Start duration counter
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      durationTimerRef.current = setInterval(() => {
        setActiveCall(prev => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);

      // Initialize WebRTC Session
      try {
        if (rtcSessionRef.current) {
          rtcSessionRef.current.close();
        }

        const session = new WebRTCCallSession(payload.webrtcConfig, {
          onConnectionStateChange: (state: CallConnectionState) => {
            setActiveCall(prev => (prev ? { ...prev, connectionState: state } : null));
          },
          onRemoteStream: (stream: MediaStream) => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
              remoteAudioRef.current.play().catch(e => console.warn('Audio play blocked:', e));
            }
          },
          onAudioLevel: (level: number) => {
            setLocalAudioLevel(level);
          },
          onIceCandidate: (candidate: RTCIceCandidateInit) => {
            newSocket.emit('webrtc:ice-candidate', { callId: payload.callId, candidate });
          },
        });

        rtcSessionRef.current = session;
        await session.initLocalStream(selectedInputId);

        // Caller creates initial offer
        if (activeCall && !activeCall.isIncoming) {
          const offer = await session.createOffer();
          newSocket.emit('webrtc:offer', { callId: payload.callId, sdp: offer });
        }
      } catch (err: any) {
        console.error('WebRTC initialization failed:', err);
        setErrorMessage('Failed to access microphone or establish audio connection.');
        cleanupCallSession();
      }
    });

    // ──────────────────────────────────────────────────────────────
    // 4. CALL DECLINED
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:declined', (payload: CallDeclinedPayload) => {
      CallNotificationManager.clearNotification();
      SoundManager.playEndedSound();
      setErrorMessage(payload.reason ? `Call declined: ${payload.reason}` : 'Call was declined.');
      cleanupCallSession();
    });

    // ──────────────────────────────────────────────────────────────
    // 5. CALL CANCELLED (Caller hung up before answer)
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:cancelled', (payload: CallCancelledPayload) => {
      CallNotificationManager.clearNotification();
      SoundManager.playEndedSound();
      setErrorMessage(payload.reason || 'Call was cancelled.');
      cleanupCallSession();
    });

    // ──────────────────────────────────────────────────────────────
    // 6. MISSED CALL (30s Ringing Timeout Expired)
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:missed', payload => {
      CallNotificationManager.clearNotification();
      SoundManager.stopRingtone();
      SoundManager.playEndedSound();

      // Trigger missed call browser notification
      CallNotificationManager.showMissedCallNotification(payload.callerName, payload.callerAppId);

      // Increment unread badge counter
      setUnreadMissedCount(prev => {
        const next = prev + 1;
        try {
          localStorage.setItem('unread_missed_calls', next.toString());
        } catch (e) {}
        return next;
      });

      setErrorMessage(`Missed call from ${payload.callerName}`);
      cleanupCallSession();
    });

    // ──────────────────────────────────────────────────────────────
    // 7. CALL ENDED
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:ended', (payload: CallEndedPayload) => {
      CallNotificationManager.clearNotification();
      SoundManager.playEndedSound();
      cleanupCallSession();
    });

    // ──────────────────────────────────────────────────────────────
    // 8. CALL ERROR
    // ──────────────────────────────────────────────────────────────
    newSocket.on('call:error', (payload: CallErrorPayload) => {
      CallNotificationManager.clearNotification();
      SoundManager.playEndedSound();
      setErrorMessage(payload.message || 'Call failed.');
      cleanupCallSession();
    });

    // ──────────────────────────────────────────────────────────────
    // WebRTC Signaling Handlers
    // ──────────────────────────────────────────────────────────────
    newSocket.on('webrtc:offer', async (payload: WebRTCOfferPayload) => {
      if (rtcSessionRef.current) {
        try {
          const answer = await rtcSessionRef.current.handleOfferAndCreateAnswer(payload.sdp);
          newSocket.emit('webrtc:answer', { callId: payload.callId, sdp: answer });
        } catch (e) {
          console.error('Error handling WebRTC offer:', e);
        }
      }
    });

    newSocket.on('webrtc:answer', async (payload: WebRTCAnswerPayload) => {
      if (rtcSessionRef.current) {
        try {
          await rtcSessionRef.current.handleAnswer(payload.sdp);
        } catch (e) {
          console.error('Error handling WebRTC answer:', e);
        }
      }
    });

    newSocket.on('webrtc:ice-candidate', async (payload: WebRTCIceCandidatePayload) => {
      if (rtcSessionRef.current) {
        try {
          await rtcSessionRef.current.addIceCandidate(payload.candidate);
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      cleanupCallSession();
    };
  }, [token, user, deviceType, cleanupCallSession, acceptCall, rejectCall]);

  const initiateCall = async (targetAppId: string) => {
    if (!socket || !isConnected) {
      setErrorMessage('Phone is not connected to network.');
      return;
    }

    if (callState !== 'idle') {
      setErrorMessage('Another call is already in progress.');
      return;
    }

    setCallState('outgoing_ringing');
    setActiveCall({
      callId: '',
      remoteAppId: targetAppId,
      remoteName: 'Calling...',
      isIncoming: false,
      duration: 0,
      connectionState: 'new',
    });

    SoundManager.playRingback();

    socket.emit('call:initiate', { targetAppId }, (res: any) => {
      if (!res.success) {
        SoundManager.playEndedSound();
        setErrorMessage(res.error?.message || 'Call failed.');
        cleanupCallSession();
      } else {
        setActiveCall(prev => (prev ? { ...prev, callId: res.callId } : null));
      }
    });
  };

  const toggleMute = () => {
    if (rtcSessionRef.current) {
      const nextMuted = !isMuted;
      rtcSessionRef.current.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  };

  const clearError = () => {
    setErrorMessage(null);
  };

  const queryPresence = (appIds: string[]) => {
    if (socket && isConnected && appIds.length > 0) {
      socket.emit('presence:query', { appIds }, (res: any) => {
        if (res?.statuses) {
          setPresenceMap(prev => ({ ...prev, ...res.statuses }));
        }
      });
    }
  };

  return (
    <CallContext.Provider
      value={{
        socket,
        isConnected,
        callState,
        activeCall,
        errorMessage,
        isMuted,
        localAudioLevel,
        presenceMap,
        unreadMissedCount,
        availableInputs,
        availableOutputs,
        selectedInputId,
        selectedOutputId,
        setSelectedInputId,
        setSelectedOutputId,
        initiateCall,
        acceptCall,
        rejectCall,
        cancelCall,
        endCall,
        toggleMute,
        clearError,
        markMissedCallsViewed,
        queryPresence,
        requestNotificationPermission,
      }}
    >
      {children}
      {/* Hidden audio element for WebRTC Remote Stream Playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </CallContext.Provider>
  );
};

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
