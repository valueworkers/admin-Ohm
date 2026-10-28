import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyAppearance, loadUserSettings } from './features/settings/store'

try {
  applyAppearance(loadUserSettings().appearance)
} catch {
  // ignore boot preference errors
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
