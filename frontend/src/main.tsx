import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Capture ?ref= anywhere and save it for 30 days
const searchParams = new URLSearchParams(window.location.search)
const refParam = searchParams.get('ref')
if (refParam) {
  localStorage.setItem('veo_ref_code', refParam.trim())
  localStorage.setItem('veo_ref_time', Date.now().toString())
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
