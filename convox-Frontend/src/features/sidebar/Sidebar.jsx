import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDebounce } from "../../hooks/useDebounce.js";
import {
  addNotification,
  clearNotification,
  useNotifications,
} from "../../services/notificationStore.js";
import ChatItem from "./ChatItem.jsx";
import CreateGroupModal from "./CreateGroupModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import RequestsDrawer from "./RequestsDrawer.jsx";
import UserSearchModal from "./UserSearchModal.jsx";
import { ConvoxLogo } from "../auth/AuthComponents.jsx";
import "./Sidebar.css";

/* ─────────────────────────────────────────────────────────────
   Utility icon components
───────────────────────────────────────────────────────────── */
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function Avatar({ initials, imageSrc = "", variant = "primary", status = null }) {
  return (
    <div className={`avatar avatar--${variant}`}>
      {imageSrc ? <img src={imageSrc} alt="Profile" className="avatar__image" /> : initials}
      {status && <span className={`status-dot status-dot--${status}`} />}
    </div>
  );
}

function getInitials(name) {
  if (!name) return "U";
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function NoResults({ query }) {
  return (
    <div className="sidebar__empty">
      <span>Search</span>
      <p>No results for "<strong>{query}</strong>"</p>
      <small>Try a different name or keyword</small>
    </div>
  );
}

function SectionLabel({ label }) {
  return <div className="sidebar__section-label">{label}</div>;
}

/* ─────────────────────────────────────────────────────────────
   Context-menu icon set  (minimal, WhatsApp-style strokes)
   All use currentColor so they inherit the item's text colour
   including the red tint on danger items.
───────────────────────────────────────────────────────────── */
function IcoOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IcoUnread() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function IcoPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z" />
    </svg>
  );
}
function IcoForward() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}
function IcoSelect() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IcoFavourite() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function IcoClear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}
function IcoDelete() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   SidebarChatMenu
   ▸ Reuses the EXACT same CSS classes as the message context
     menu: ctx-menu, ctx-item, ctx-item--danger, ctx-divider,
     ctx-menu-backdrop
   ▸ Portalled to document.body so it is never clipped by the
     sidebar's overflow:hidden
   ▸ Closes on backdrop click or ESC key
   ▸ Viewport-aware positioning so it never overflows the screen
───────────────────────────────────────────────────────────── */
const MENU_ESTIMATED_HEIGHT = 348;
const MENU_ESTIMATED_WIDTH  = 232;

function SidebarChatMenu({
  open,
  position,
  chat,
  isPinned,
  isUnread,
  onMarkUnread,
  onMarkRead,
  onPin,
  onUnpin,
  onClearChat,
  onDeleteChat,
  onClose,
}) {
  /* Close on ESC */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !chat) return null;

  /* Clamp so menu never overflows the viewport */
  const x = Math.min(position.x, window.innerWidth  - MENU_ESTIMATED_WIDTH  - 8);
  const y = Math.min(position.y, window.innerHeight - MENU_ESTIMATED_HEIGHT - 8);

  return createPortal(
    <>
      {/* Invisible full-screen backdrop – closes on outside click */}
      <button
        type="button"
        className="ctx-menu-backdrop"
        aria-label="Close chat menu"
        onClick={onClose}
      />

      {/* ── Context menu ─────────────────────────────────── */}
      <div
        className="ctx-menu"
        style={{ top: `${y}px`, left: `${x}px` }}
        role="menu"
        aria-label={`Actions for ${chat.name}`}
      >
        {/* ── Group 1 : read state & pin ── */}
        <button type="button" className="ctx-item" role="menuitem"
          onClick={() => { isUnread ? onMarkRead(chat.id) : onMarkUnread(chat); onClose(); }}>
          <span className="ctx-item__icon"><IcoUnread /></span>
          <span>{isUnread ? "Mark as read" : "Mark as unread"}</span>
        </button>

        <button type="button" className="ctx-item" role="menuitem"
          onClick={() => { isPinned ? onUnpin(chat) : onPin(chat); onClose(); }}>
          <span className="ctx-item__icon"><IcoPin /></span>
          <span>{isPinned ? "Unpin chat" : "Pin chat"}</span>
        </button>

        <div className="ctx-divider" />

        {/* ── Group 2 : destructive ── */}
        <button type="button" className="ctx-item" role="menuitem"
          onClick={() => { onClearChat?.(chat); onClose(); }}>
          <span className="ctx-item__icon"><IcoClear /></span>
          <span>Clear chat</span>
        </button>

        <button type="button" className="ctx-item ctx-item--danger" role="menuitem"
          onClick={() => { onDeleteChat?.(chat); onClose(); }}>
          <span className="ctx-item__icon"><IcoDelete /></span>
          <span>Delete chat</span>
        </button>
      </div>
    </>,
    document.body,
  );
}

/* ─────────────────────────────────────────────────────────────
   Sidebar
───────────────────────────────────────────────────────────── */
export default function Sidebar({
  chats,
  currentUser,
  selectedChat,
  onSelectChat,
  onLogout,
  onChatAccepted,
  onProfileUpdated,
  onGroupCreated,
  onCloseMobile,
  mobileHidden,
}) {
  const [query, setQuery]           = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [focusedIndex, setFocused]  = useState(-1);
  const [pinnedChatIds, setPinnedChatIds] = useState(() => new Set());
  const [chatMenu, setChatMenu]     = useState({
    open: false, x: 0, y: 0, chat: null,
  });

  const listRef = useRef(null);
  // Swipe gesture tracking
  const swipeTouchStartX = useRef(0);
  const swipeTouchStartY = useRef(0);
  const { unreadChats } = useNotifications();
  const debouncedQuery  = useDebounce(query, 350);

  /* ── Hydrate chats with unread data + sort by recent activity ── */
  const hydratedChats = useMemo(() => {
    const withUnread = chats.map((chat) => {
      const unread = unreadChats[String(chat.id)];
      if (!unread) return chat;
      return {
        ...chat,
        unread: unread.count,
        preview: `${unread.lastSender}: ${unread.lastMessage}`,
        timestamp: unread.timestamp
          ? new Date(unread.timestamp).toLocaleTimeString([], {
              hour: "numeric", minute: "2-digit",
            })
          : chat.timestamp,
        lastActivityAt: unread.timestamp || chat.lastActivityAt,
      };
    });

    return withUnread.sort((l, r) => {
      // Pinned chats float to the top
      const lPin = pinnedChatIds.has(String(l.id)) ? 1 : 0;
      const rPin = pinnedChatIds.has(String(r.id)) ? 1 : 0;
      if (rPin !== lPin) return rPin - lPin;
      return new Date(r.lastActivityAt || 0).getTime() - new Date(l.lastActivityAt || 0).getTime();
    });
  }, [chats, unreadChats, pinnedChatIds]);

  const friendsList = useMemo(() => {
    return hydratedChats
      .filter((chat) => !chat.isGroupChat && !chat.isBotChat && chat.otherUserId)
      .map((chat) => chat.rawChat?.users?.find((u) => String(u._id) === String(chat.otherUserId)))
      .filter(Boolean);
  }, [hydratedChats]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return hydratedChats;
    return hydratedChats.filter(
      (c) => c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q),
    );
  }, [debouncedQuery, hydratedChats]);

  const isSearching = query.trim().length > 0;

  /* ── Scroll focused item into view ── */
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll(".chat-item");
    items[focusedIndex]?.scrollIntoView({ block: "nearest" });
  }, [focusedIndex]);

  /* ── Handlers ── */
  const closeMenu = useCallback(
    () => setChatMenu({ open: false, x: 0, y: 0, chat: null }),
    [],
  );

  const handleSearch = useCallback((e) => {
    setQuery(e.target.value);
    setFocused(-1);
  }, []);

  const handleSelect = useCallback(
    (chat) => {
      clearNotification(chat.id);
      onSelectChat?.(chat);
      setFocused(-1);
      closeMenu();
    },
    [onSelectChat, closeMenu],
  );

  /* Right-click → open context menu at cursor, clamped to viewport */
  const handleOpenChatMenu = useCallback((event, chat) => {
    event.preventDefault();
    const x = Math.min(event.clientX, window.innerWidth  - MENU_ESTIMATED_WIDTH  - 8);
    const y = Math.min(event.clientY, window.innerHeight - MENU_ESTIMATED_HEIGHT - 8);
    setChatMenu({ open: true, x, y, chat });
  }, []);

  /* ── Context menu action handlers ── */
  const handleMarkUnread = useCallback((chat) => {
    addNotification({
      chatId:    chat.id,
      senderId:  chat.otherUserId || chat.id,
      senderName: chat.name,
      preview:   chat.preview || "Unread chat",
      timestamp: chat.lastActivityAt || new Date().toISOString(),
    });
  }, []);

  const handleMarkRead = useCallback((chatId) => {
    clearNotification(chatId);
  }, []);

  const handlePin = useCallback((chat) => {
    setPinnedChatIds((prev) => {
      const next = new Set(prev);
      next.add(String(chat.id));
      return next;
    });
  }, []);

  const handleUnpin = useCallback((chat) => {
    setPinnedChatIds((prev) => {
      const next = new Set(prev);
      next.delete(String(chat.id));
      return next;
    });
  }, []);

  const handleForward = useCallback((_chat) => {
    // Placeholder — wire up to your forward modal when ready
    console.info("[Sidebar] Forward chat:", _chat.name);
  }, []);

  const handleSelect2 = useCallback((_chat) => {
    // Placeholder — wire up to your select mode when ready
    console.info("[Sidebar] Select chat:", _chat.name);
  }, []);

  const handleFavourite = useCallback((_chat) => {
    // Placeholder — wire up to favourites store when ready
    console.info("[Sidebar] Add to favourites:", _chat.name);
  }, []);

  const handleClearChat = useCallback((_chat) => {
    // Placeholder — wire up to clear-chat API when ready
    console.info("[Sidebar] Clear chat:", _chat.name);
  }, []);

  const handleDeleteChat = useCallback((_chat) => {
    // Placeholder — wire up to delete-chat API when ready
    console.info("[Sidebar] Delete chat:", _chat.name);
  }, []);

  /* ── Swipe-left-to-close gesture (mobile only) ── */
  const handleTouchStart = useCallback((e) => {
    swipeTouchStartX.current = e.touches[0].clientX;
    swipeTouchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const dx = e.changedTouches[0].clientX - swipeTouchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - swipeTouchStartY.current);
    // Swipe left ≥ 60px, and more horizontal than vertical
    if (dx < -60 && dy < 60) {
      onCloseMobile?.();
    }
  }, [onCloseMobile]);

  /* ── Keyboard navigation ── */
  const handleKeyDown = useCallback(
    (event) => {
      const max = filtered.length - 1;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocused((i) => Math.min(i + 1, max));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocused((i) => Math.max(i - 1, 0));
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

  /* ── Render ── */
  return (
    <aside
      className={`sidebar${mobileHidden ? " sidebar--mobile-hidden" : ""}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {showSearch && (
        <UserSearchModal
          onClose={() => setShowSearch(false)}
          onChatSelected={onChatAccepted}
        />
      )}

      <CreateGroupModal
        open={showCreateGroup}
        friends={friendsList}
        onClose={() => setShowCreateGroup(false)}
        onCreated={(chat) => {
          setShowCreateGroup(false);
          onGroupCreated?.(chat);
        }}
      />

      {showProfile && (
        <ProfileModal
          key={currentUser?._id || "profile-modal"}
          user={currentUser}
          onClose={() => setShowProfile(false)}
          onSaved={onProfileUpdated}
        />
      )}

      <div className="sidebar__header">
        <div className="sidebar__header-top">
          <div className="sidebar__brand-lockup">
            <div className="sidebar__brand-mark" aria-hidden="true">
              <ConvoxLogo />
            </div>
            <div className="sidebar__brand-copy">
              <div className="sidebar__brand">Convox</div>
              <div className="sidebar__subtitle">Studio Chat</div>
            </div>
          </div>
          <div className="sidebar__header-actions">
            <button
              onClick={() => setShowSearch(true)}
              title="Find People"
              type="button"
              className="sidebar__icon-btn"
              aria-label="Find People"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <RequestsDrawer onChatAccepted={onChatAccepted} />
            {/* Close button — visible only on mobile via CSS */}
            <button
              type="button"
              className="sidebar__close-btn"
              onClick={onCloseMobile}
              aria-label="Close menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <button
          className="sidebar__new-btn"
          type="button"
          onClick={() => setShowCreateGroup(true)}
          title="Create group"
        >
          <IconPlus /> New Group
        </button>

        <div className="sidebar__search-wrap">
          <svg className="sidebar__search-icon" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              onClick={() => { setQuery(""); setFocused(-1); }}
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
            <SectionLabel label="Recent Chats" />
            {filtered.map((chat, index) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={selectedChat?.id === chat.id}
                isFocused={focusedIndex === index}
                isPinned={pinnedChatIds.has(String(chat.id))}
                onClick={handleSelect}
                onContextMenu={handleOpenChatMenu}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Sidebar right-click context menu ── */}
      <SidebarChatMenu
        open={chatMenu.open}
        position={chatMenu}
        chat={chatMenu.chat}
        isPinned={Boolean(chatMenu.chat && pinnedChatIds.has(String(chatMenu.chat.id)))}
        isUnread={Boolean(chatMenu.chat && unreadChats[String(chatMenu.chat.id)])}
        onOpenChat={handleSelect}
        onMarkUnread={handleMarkUnread}
        onMarkRead={handleMarkRead}
        onPin={handlePin}
        onUnpin={handleUnpin}
        onForward={handleForward}
        onSelect={handleSelect2}
        onFavourite={handleFavourite}
        onClearChat={handleClearChat}
        onDeleteChat={handleDeleteChat}
        onClose={closeMenu}
      />

      <div className="sidebar__footer">
        <Avatar
          initials={getInitials(currentUser?.name)}
          imageSrc={currentUser?.profilePic || ""}
          variant="primary"
          status={null}
        />
        <div
          style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
          onClick={() => setShowProfile(true)}
          title="View profile"
        >
          <div className="sidebar__footer-name">{currentUser?.name || "Account"}</div>
          <div className="sidebar__footer-status">{currentUser?.bio || "Signed in"}</div>
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
