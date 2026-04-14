import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useDebounce } from "../hooks/useDebounce.js";
import {
  clearNotification,
  useNotifications,
} from "../services/notificationStore.js";
import ChatItem from "./ChatItem";
import RequestsDrawer from "../components/RequestsDrawer.jsx";
import UserSearchModal from "../components/UserSearchModal.jsx";
import "./Sidebar.css";

function IconPlus() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function Avatar({ initials, variant = "primary", status = null }) {
  return (
    <div className={`avatar avatar--${variant}`}>
      {initials}
      {status && <span className={`status-dot status-dot--${status}`} />}
    </div>
  );
}

function getInitials(name) {
  if (!name) return "U";

  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}


function NoResults({ query }) {
  return (
    <div className="sidebar__empty">
      <span>Search</span>
      <p>
        No results for "<strong>{query}</strong>"
      </p>
      <small>Try a different name or keyword</small>
    </div>
  );
}

function SectionLabel({ label }) {
  return <div className="sidebar__section-label">{label}</div>;
}

export default function Sidebar({
  chats,
  currentUser,
  selectedChat,
  onSelectChat,
  onLogout,
}) {
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [focusedIndex, setFocused] = useState(-1);
  const listRef = useRef(null);
  const { unreadChats } = useNotifications();

  const debouncedQuery = useDebounce(query, 350);

  const hydratedChats = useMemo(
    () =>
      chats.map((chat) => {
        const unread = unreadChats[String(chat.id)];
        if (!unread) return chat;

        return {
          ...chat,
          unread: unread.count,
          preview: `${unread.lastSender}: ${unread.lastMessage}`,
          timestamp: unread.timestamp
            ? new Date(unread.timestamp).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })
            : chat.timestamp,
        };
      }),
    [chats, unreadChats],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) return hydratedChats;

    return hydratedChats.filter(
      (chat) =>
        chat.name.toLowerCase().includes(normalizedQuery) ||
        chat.preview.toLowerCase().includes(normalizedQuery),
    );
  }, [debouncedQuery, hydratedChats]);

  const isSearching = query.trim().length > 0;
  const directChats = isSearching ? [] : filtered.filter((chat) => chat.type === "direct");
  const groupChats = isSearching ? [] : filtered.filter((chat) => chat.type === "group");

  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll(".chat-item");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  const handleSearch = useCallback((event) => {
    setQuery(event.target.value);
    setFocused(-1);
  }, []);

  const handleSelect = useCallback(
    (chat) => {
      clearNotification(chat.id);
      onSelectChat?.(chat);
      setFocused(-1);
    },
    [onSelectChat],
  );

  const handleKeyDown = useCallback(
    (event) => {
      const max = filtered.length - 1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocused((index) => Math.min(index + 1, max));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocused((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter" && focusedIndex >= 0) {
        handleSelect(filtered[focusedIndex]);
      }
      if (event.key === "Escape") {
        setQuery("");
        setFocused(-1);
      }
    },
    [filtered, focusedIndex, handleSelect],
  );

  return (
    <aside className="sidebar">
      {showSearch && (
        <UserSearchModal onClose={() => setShowSearch(false)} />
      )}

      <div className="sidebar__header">
        <div className="sidebar__header-top">
          <div>
            <div className="sidebar__brand">Convox</div>
            <div className="sidebar__subtitle">Studio Chat</div>
          </div>
          <div className="sidebar__header-actions">
            <button
              onClick={() => setShowSearch(true)}
              title="Find People"
              type="button"
              className="sidebar__icon-btn"
            >
              🔍
            </button>
            <RequestsDrawer />
          </div>
        </div>

        <button className="sidebar__new-btn" type="button">
          <IconPlus /> New Chat
        </button>

        <div className="sidebar__search-wrap">
          <svg
            className="sidebar__search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>

          <input
            className="sidebar__search"
            type="text"
            placeholder="Search conversations..."
            value={query}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck="false"
            aria-label="Search chats"
          />

          {query && (
            <button
              className="sidebar__search-clear"
              onClick={() => {
                setQuery("");
                setFocused(-1);
              }}
              type="button"
              aria-label="Clear search"
            >
              x
            </button>
          )}
        </div>
      </div>

      <div className="sidebar__list" ref={listRef} role="listbox">
        {isSearching && filtered.length > 0 && (
          <>
            <SectionLabel
              label={`${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
            />
            {filtered.map((chat, index) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={selectedChat?.id === chat.id}
                isFocused={focusedIndex === index}
                onClick={handleSelect}
              />
            ))}
          </>
        )}

        {isSearching && filtered.length === 0 && <NoResults query={query} />}

        {!isSearching && (
          <>
            <SectionLabel label="Active Now" />
            {directChats.map((chat, index) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={selectedChat?.id === chat.id}
                isFocused={focusedIndex === index}
                onClick={handleSelect}
              />
            ))}

            {groupChats.length > 0 && (
              <>
                <SectionLabel label="Groups" />
                {groupChats.map((chat, index) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={selectedChat?.id === chat.id}
                    isFocused={focusedIndex === index + directChats.length}
                    onClick={handleSelect}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>

      <div className="sidebar__footer">
        <Avatar
          initials={getInitials(currentUser?.name)}
          variant="primary"
          status={null}
        />
        <div style={{ flex: 1 }}>
          <div className="sidebar__footer-name">{currentUser?.name || "Account"}</div>
          <div className="sidebar__footer-status">
            {currentUser?.email || "Signed in"}
          </div>
        </div>

        <button
          className="sidebar__logout-btn"
          onClick={onLogout}
          title="Logout"
          type="button"
        >
          <IconLogout />
        </button>
      </div>
    </aside>
  );
}
