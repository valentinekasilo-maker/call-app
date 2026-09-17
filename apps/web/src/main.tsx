import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { CallProvider } from './context/CallContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <CallProvider deviceType="web">
          <App />
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
