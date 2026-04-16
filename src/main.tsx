import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import App from './App.tsx'

// Polyfill Buffer globally so @react-pdf/renderer's pdfkit code path works
// when we register custom fonts (DM Sans, Noto Sans Devanagari, etc.).
// Without this, font registration fails with "Buffer is not defined".
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
