import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/appUpdate'
import 'katex/dist/katex.min.css'
import './styles.css'
import { App } from './App'
import { requestPersistentStorage } from './lib/db'

requestPersistentStorage()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
