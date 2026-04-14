import { memo } from 'react';
import './ChatItem.css';

/**
 * memo() = only re-renders if props actually change.
 * Without memo, every keystroke re-renders ALL chat items.
 * With memo, only the item whose props changed re-renders.
 */
const ChatItem = memo(function ChatItem({
  chat,
  isActive,
  isFocused,
  onClick,
}) {
  return (
    <div
      className={[
        'chat-item',
        isActive  ? 'chat-item--active'  : '',
        isFocused ? 'chat-item--focused' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => onClick(chat)}
      role="option"
      aria-selected={isActive}
      tabIndex={-1}   // managed by parent keyboard handler
    >
      {/* Avatar */}
      <div className={`chat-item__avatar chat-item__avatar--${chat.avatarVariant ?? 'primary'}`}>
        {chat.initials}
        {chat.status === 'online' && (
          <span className="chat-item__status-dot" />
        )}
      </div>

      {/* Text content */}
      <div className="chat-item__body">
        <div className="chat-item__top">
          <span className="chat-item__name">{chat.name}</span>
          <span className="chat-item__time">{chat.timestamp ?? ''}</span>
        </div>
        <div className="chat-item__bottom">
          <span className="chat-item__preview">{chat.preview}</span>
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