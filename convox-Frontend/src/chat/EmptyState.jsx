// components/Chat/EmptyState.jsx
// Shown when no chat is selected

import './EmptyState.css';

function IconChat() {
  return (
    <svg
      className="empty-state__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state__icon-wrap">
        <IconChat />
      </div>
      <p className="empty-state__title">No conversation selected</p>
      <p className="empty-state__subtitle">
        Choose a chat from the sidebar, or start something new.
      </p>
    </div>
  );
}