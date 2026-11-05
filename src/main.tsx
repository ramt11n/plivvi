import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import WorkspaceRecovery from './components/WorkspaceRecovery';
import './styles.css';
import './reader/reader.css';
import './theme.css';
import './product.css';
import './brand.css';
import './features.css';
import './notebooks/notebooks.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceRecovery>
      <App />
    </WorkspaceRecovery>
  </React.StrictMode>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).catch(() => {}));
}

import './experience.css';
import './showcase.css';
