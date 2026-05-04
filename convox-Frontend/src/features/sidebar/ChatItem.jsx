import { memo } from 'react';
import './ChatItem.css';
import { ConvoxLogo } from "../auth/AuthComponents.jsx";

/* Small inline pin icon */
function PinIcon() {
  return (
    <svg
      className="chat-item__pin-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Pinned"
    >
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}

function PreviewIcon({ kind }) {
  if (kind === "video-call") {
    return (
      <svg
        className="chat-item__preview-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    );
  }

  if (kind === "audio-call") {
    return (
      <svg
        className="chat-item__preview-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6.32 6.32l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }

  return null;
}

/**
 * memo() = only re-renders if props actually change.
 * Without memo, every keystroke re-renders ALL chat items.
 * With memo, only the item whose props changed re-renders.
 */
const ChatItem = memo(function ChatItem({
  chat,
  isActive,
  isFocused,
  isPinned,
  onClick,
  onContextMenu,
}) {
  return (
    <div
      className={[
        'chat-item',
        isActive  ? 'chat-item--active'  : '',
        isFocused ? 'chat-item--focused' : '',
        isPinned  ? 'chat-item--pinned'  : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onClick(chat)}
      onContextMenu={(event) => onContextMenu?.(event, chat)}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}   // managed by parent keyboard handler
    >
      {/* Avatar */}
      <div className={`chat-item__avatar chat-item__avatar--${chat.avatarVariant ?? 'primary'}`}>
        {chat.isBotChat ? (
          <span className="chat-item__avatar-logo" aria-hidden="true">
            <ConvoxLogo />
          </span>
        ) : chat.avatarUrl ? (
          <img src={chat.avatarUrl} alt={chat.name} className="chat-item__avatar-image" />
        ) : (
          chat.initials
        )}
        {chat.status === 'online' && (
          <span className="chat-item__status-dot" />
        )}
      </div>

      {/* Text content */}
      <div className="chat-item__body">
        <div className="chat-item__top">
          <span className="chat-item__name">{chat.name}</span>
          <div className="chat-item__top-right">
            {isPinned && <PinIcon />}
            <span className="chat-item__time">{chat.timestamp ?? ''}</span>
          </div>
        </div>
        <div className="chat-item__bottom">
          <span className={`chat-item__preview chat-item__preview--${chat.previewEmphasis ?? "neutral"}`}>
            <PreviewIcon kind={chat.previewKind} />
            <span className="chat-item__preview-text">{chat.preview}</span>
          </span>
          {chat.unread > 0 && (
            <span className="chat-item__badge">
              {chat.unread > 99 ? '99+' : chat.unread}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default ChatItem;
