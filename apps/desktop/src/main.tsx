import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../../web/src/App';
import { ThemeProvider } from '../../web/src/context/ThemeContext';
import { AuthProvider } from '../../web/src/context/AuthContext';
import { CallProvider } from '../../web/src/context/CallContext';
import { DesktopCallManagerBridge } from './DesktopCallManagerBridge';
import { IncomingPopupView } from './IncomingPopupView';
import '../../web/src/index.css';
import './index.css';

const isPopup = window.location.hash.includes('popup');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      {isPopup ? (
        <IncomingPopupView />
      ) : (
        <AuthProvider>
          <CallProvider deviceType="desktop">
            <DesktopCallManagerBridge>
              <App />
            </DesktopCallManagerBridge>
          </CallProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  </React.StrictMode>
);
