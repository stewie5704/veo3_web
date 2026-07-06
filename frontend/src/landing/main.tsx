import React from 'react'
import ReactDOM from 'react-dom/client'
import Landing from '../pages/Landing'
import { I18nProvider } from '../i18n'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <Landing />
    </I18nProvider>
  </React.StrictMode>,
)
