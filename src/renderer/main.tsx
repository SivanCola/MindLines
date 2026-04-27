import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="应用遇到错误" retryLabel="重试" className="root-error-boundary">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
