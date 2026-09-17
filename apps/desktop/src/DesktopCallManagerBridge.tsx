import React, { useEffect } from 'react';
import { useCall } from '../../web/src/context/CallContext';

export const DesktopCallManagerBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { callState, activeCall, acceptCall, rejectCall } = useCall();

  // Sync native Electron popup with incoming call
  useEffect(() => {
    if (!window.electronAPI) return;

    if (callState === 'incoming_ringing' && activeCall) {
      window.electronAPI.showIncomingPopup({
        callId: activeCall.callId,
        callerName: activeCall.remoteName,
        callerAppId: activeCall.remoteAppId,
      });
    } else {
      window.electronAPI.closeIncomingPopup();
    }
  }, [callState, activeCall]);

  // Listen for actions from native popup window
  useEffect(() => {
    if (!window.electronAPI?.onPopupAction) return;

    const unsubscribe = window.electronAPI.onPopupAction((action, _payload) => {
      if (action === 'accept') {
        acceptCall();
      } else if (action === 'reject') {
        rejectCall();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [acceptCall, rejectCall]);

  return <>{children}</>;
};
