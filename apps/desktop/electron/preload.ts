import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  showIncomingPopup: (payload: { callId: string; callerName: string; callerAppId: string }) => {
    ipcRenderer.send('show-incoming-popup', payload);
  },
  closeIncomingPopup: () => {
    ipcRenderer.send('close-incoming-popup');
  },
  onPopupAction: (callback: (action: 'accept' | 'reject', payload: any) => void) => {
    const handler = (_event: any, data: { action: 'accept' | 'reject'; payload: any }) => {
      callback(data.action, data.payload);
    };
    ipcRenderer.on('popup-action-triggered', handler);
    return () => {
      ipcRenderer.removeListener('popup-action-triggered', handler);
    };
  },
  acceptFromPopup: (payload: any) => {
    ipcRenderer.send('popup-accept-call', payload);
  },
  rejectFromPopup: (payload: any) => {
    ipcRenderer.send('popup-reject-call', payload);
  },
  getPopupData: () => {
    return ipcRenderer.sendSync('get-popup-data');
  },
});
