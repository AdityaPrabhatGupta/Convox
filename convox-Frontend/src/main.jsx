import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './css/notifications.css'
import { ChatRequestProvider } from './context/ChatRequestContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChatRequestProvider>
      <App />
    </ChatRequestProvider>
  </React.StrictMode>
)
