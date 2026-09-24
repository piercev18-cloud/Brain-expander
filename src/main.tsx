import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Applied before first paint by the inline script in index.html; re-read here so a
// reload inside the app keeps the chosen theme.
try {
  const stored = localStorage.getItem('tn:theme')
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored
} catch {
  /* private mode */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
