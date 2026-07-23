import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installAssetCssVariables } from './assetUrl'
import { registerNighttraceServiceWorker } from './pwa'
import './styles.css'

installAssetCssVariables()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

registerNighttraceServiceWorker()
