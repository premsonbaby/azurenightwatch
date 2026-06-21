import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import 'reactflow/dist/style.css';
import './index.css';
import App from './App';
import { initAuth, getMsalInstance, isMsalEnabled } from './auth/authConfig';
import { resolveApiBaseUrl } from './config/apiBaseUrl';

const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

async function bootstrap() {
  await initAuth(apiBaseUrl);

  const msalInstance = getMsalInstance();
  const app = isMsalEnabled() && msalInstance
    ? (
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    )
    : <App />;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>{app}</StrictMode>,
  );
}

bootstrap();
