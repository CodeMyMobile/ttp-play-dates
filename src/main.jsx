import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import InvitationPage from './InvitationPage.jsx'

const path = window.location.pathname
let element = <App />

// Handle base paths like "/ttp-play-dates" when detecting invite links
const invitePrefix = `${import.meta.env.BASE_URL}invites/`
if (path.startsWith(invitePrefix)) {
  const token = path.slice(invitePrefix.length)
  element = <InvitationPage token={token} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {element}
  </StrictMode>,
)
