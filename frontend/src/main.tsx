import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Explicit extension: a legacy src/i18n.js stub would otherwise win module resolution
// and i18next would never be initialized.
import './i18n.ts'
import './lib/posthog'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
