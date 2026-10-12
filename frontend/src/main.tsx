import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Explicit extension: a legacy src/i18n.js stub would otherwise win module resolution
// and i18next would never be initialized.
import './i18n.ts'
import './lib/posthog'
import App from './App'

// Public seedless-wallet prototype for reviewers (/passkey), loaded on demand so it
// stays out of the main dashboard bundle.
const PasskeyLab = lazy(() => import('./components/PasskeyLab'))
const isPasskeyLab = window.location.pathname.replace(/\/+$/, '') === '/passkey'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPasskeyLab ? (
      <Suspense fallback={null}>
        <PasskeyLab />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)
