import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './global.css'
import './styles/notifications.css'
import './styles/assistant.css'
/* theme.css and polish.css removed — they used !important on every rule
   and silently overrode all component-level CSS (Sidebar.css, ChatWindow.css,
   MessageInput.css, etc.), making edits to those files have no visible effect.
   The component CSS files are now the sole source of truth. */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
