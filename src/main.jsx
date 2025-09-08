import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InvitationPage from './InvitationPage.jsx'

const path = window.location.pathname
let element = <App />

if (path.startsWith('/invites/')) {
  const token = path.split('/').pop()
  element = <InvitationPage token={token} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {element}
  </StrictMode>,
)
