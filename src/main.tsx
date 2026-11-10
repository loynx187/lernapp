import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/appUpdate'
import 'katex/dist/katex.min.css'
// Schriften für das Design „Bagel“ (werden erst geladen, wenn das Design sie verwendet)
import '@fontsource/bricolage-grotesque/latin-400.css'
import '@fontsource/bricolage-grotesque/latin-600.css'
import '@fontsource/bricolage-grotesque/latin-700.css'
import '@fontsource/bagel-fat-one/latin-400.css'
import './styles.css'
import { App } from './App'
import { requestPersistentStorage } from './lib/db'
import { initDisplay } from './lib/theme'

initDisplay()
requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
