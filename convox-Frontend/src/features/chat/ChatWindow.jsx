import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ChatWindow.css";
import "../sidebar/ProfileModal.css";
import { CallButton } from "../call/index.js";
import MessageInput from "./MessageInput.jsx";
import MediaMessage from "./MediaMessage.jsx";
import GroupInfoPanel from "./GroupInfoPanel.jsx";
import { ConvoxLogo } from "../auth/AuthComponents.jsx";
import { clearNotification } from "../../services/notificationStore.js";
import { fetchChats as fetchChatsApi, removeDirectChat } from "../../services/chatService.js";
import { blockUser } from "../../services/userService.js";
import {
  clearChatMessages,
  deleteMessageForEveryone,
  deleteMessageForMe,
  editMessage as editMessageApi,
  fetchMessages as fetchMessagesApi,
  forwardMessages as forwardMessagesApi,
  togglePinMessage as togglePinMessageApi,
  reactToMessage,
  sendMessage as sendMessageApi,
} from "../../services/messageService.js";
import { joinChat, leaveCurrentChat, subscribeToMessages, socket } from "../../services/socket.js";
import { sendAssistantMessage, askAboutChat } from "../../services/aiService.js";
import useAssistantChat from "../../hooks/useAssistantChat.js";
import SmartReplies from "./SmartReplies.jsx";

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const QUICK_REACTIONS = ["\u{1F44D}", "\u{2764}\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F525}"];
const CONTEXT_MENU_WIDTH = 220;
const CONTEXT_MENU_HEIGHT = 344;
const VIEWPORT_GUTTER = 12;
const clampMenuPosition = ({ x, y }) => ({
  x: Math.max(
    VIEWPORT_GUTTER,
    Math.min(window.innerWidth - CONTEXT_MENU_WIDTH - VIEWPORT_GUTTER, x),
  ),
  y: Math.max(
    VIEWPORT_GUTTER,
    Math.min(window.innerHeight - CONTEXT_MENU_HEIGHT - VIEWPORT_GUTTER, y),
  ),
});

function ReactionTriggerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.5a6.5 6.5 0 1 0 6.5 6.5" />
      <path d="M18 6h4" />
      <path d="M20 4v4" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9 14c.9 1 2.1 1.5 3 1.5s2.1-.5 3-1.5" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M8 4h8" />
      <path d="m9 4 1 6-3 4h10l-3-4 1-6" />
    </svg>
  );
}

function IconForward() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 7l5 5-5 5" />
      <path d="M20 12H9.5A5.5 5.5 0 0 0 4 17.5V19" />
    </svg>
  );
}

function IconForwarded() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 7-5 5 5 5" />
      <path d="m16 7 5 5-5 5" />
      <path d="M21 12H9" />
      <path d="M3 12h12" />
    </svg>
  );
}

function IconReply() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 10 4 15l5 5" />
      <path d="M5 15h8a7 7 0 0 0 7-7V5" />
    </svg>
  );
}

function IconPinnedBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v4" />
      <path d="M8.5 5h7" />
      <path d="m9.5 5 1 5.5-3 3.5h9l-3-3.5 1-5.5" />
    </svg>
  );
}

function IconSelect() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="m8.5 12 2.2 2.2L15.8 9" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.05" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function IconClearChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </svg>
  );
}

function IconRemoveFriend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function IconBlock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M7 7l10 10" />
    </svg>
  );
}

const mediaPreviewText = {
  image: "Sent an image",
  video: "Sent a video",
  audio: "Sent an audio clip",
  file: "Sent a file",
};

const getMessageText = (message) =>
  message.type && message.type !== "text"
    ? mediaPreviewText[message.type] || "Sent an attachment"
    : message.content || message.text || "";

const getInitials = (name = "") =>
  String(name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const buildReplyPreview = (message, currentUserId) => {
  if (!message) return null;
  const senderId = String(message.sender?._id || message.senderId || "");
  const type = message.type || "text";
  const text = message.isDeletedForEveryone
    ? "This message was deleted"
    : type !== "text"
      ? message.fileName || mediaPreviewText[type] || "Attachment"
      : message.content || message.text || "";

  return {
    id: String(message._id || message.id),
    senderId,
    senderName: message.sender?.name || message.senderName || "Unknown",
    isMine: senderId === String(currentUserId),
    text,
    type,
  };
};

const fmt = (message, currentUserId) => {
  const senderId = String(message.sender?._id || message.senderId || "");
  const senderName = message.sender?.name || message.senderName || "Unknown";
  return {
    id: String(message._id || message.id),
    senderId,
    senderName,
    senderInitials: senderName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
    senderProfilePic: message.sender?.profilePic || "",
    text: getMessageText(message),
    time: new Date(message.createdAt || message.sentAt || Date.now()).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    sentAt: new Date(message.createdAt || message.sentAt || Date.now()).getTime(),
    isMine: senderId === String(currentUserId),
    isPending: Boolean(message.isPending),
    hasError: Boolean(message.hasError),
    isDeletedForEveryone: Boolean(message.isDeletedForEveryone),
    isEdited: Boolean(message.editedAt),
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
    isPinned: Boolean(message.pinnedAt),
    forwardedFrom: isActuallyForwarded(message.forwardedFrom) ? message.forwardedFrom : null,
    replyTo: buildReplyPreview(message.replyTo, currentUserId),
    voiceUrl: message.voiceUrl || "",
    voiceDuration: Number(message.voiceDuration || 0),
    type: message.type || (message.voiceUrl ? "audio" : "text"),
    mediaUrl: message.mediaUrl || "",
    fileName: message.fileName || "",
    fileSize: Number(message.fileSize || 0),
    mimeType: message.mimeType || "audio/webm",
    isSystem: Boolean(message.isSystem),
    callMeta: message.callMeta || null,
    rawMessage: message,
  };
};


const dayLabel = (value) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (left, right) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  if (same(date, today)) return "Today";
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

const formatLastSeen = (value) => {
  if (!value) return "Last seen recently";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last seen recently";

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Last seen today at ${timeLabel}`;
  if (isYesterday) return `Last seen yesterday at ${timeLabel}`;

  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });

  return `Last seen ${dateLabel} at ${timeLabel}`;
};

const timeline = (messages) => {
  const items = [];
  let last = "";
  messages.forEach((message) => {
    const date = new Date(message.sentAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (key !== last) {
      items.push({ type: "divider", id: `divider-${key}`, label: dayLabel(message.sentAt) });
      last = key;
    }
    items.push({ type: "message", id: message.id, message });
  });
  return items;
};

const groupMessageReactions = (reactions = [], currentUserId = "") =>
  Object.entries(
    reactions.reduce((acc, reaction) => {
      const emoji = reaction.emoji;
      const reactionUserId = String(reaction.user?._id || reaction.user || "");

      if (!acc[emoji]) {
        acc[emoji] = {
          count: 0,
          mine: false,
          users: [],
        };
      }

      acc[emoji].count += 1;
      if (reactionUserId === String(currentUserId)) {
        acc[emoji].mine = true;
      }

      acc[emoji].users.push({
        id: reactionUserId,
        name: reaction.user?.name || "Unknown",
        avatarUrl: reaction.user?.profilePic || "",
        emoji,
        isMe: reactionUserId === String(currentUserId),
      });

      return acc;
    }, {}),
  );

const isActuallyForwarded = (forwardedFrom) =>
  Boolean(
    forwardedFrom &&
    (
      forwardedFrom.messageId ||
      (typeof forwardedFrom.senderName === "string" && forwardedFrom.senderName.trim())
    ),
  );

function Modal({ open, title, desc, confirmLabel, confirmTone = "default", note = "", includeDelete = false, deleteChat = false, onToggleDelete, onCancel, onConfirm, loading = false, confirmDisabled = false, children }) {
  if (!open) return null;
  return createPortal(
    <>
      <div className="cx-overlay-backdrop relationship-modal__backdrop" onClick={onCancel} />
      <div className="cx-overlay-shell relationship-modal-shell" role="dialog" aria-modal="true">
        <div className="rb__drawer rb__drawer--centered relationship-modal">
          <div className="relationship-modal__header">
            <div>
              <h3 className="relationship-modal__title">{title}</h3>
              <p className="relationship-modal__description">{desc}</p>
            </div>
            <button type="button" className="relationship-modal__close" onClick={onCancel} aria-label="Close dialog">x</button>
          </div>
          <div className="relationship-modal__body">
            {includeDelete && (
              <label className="relationship-modal__option">
                <input type="checkbox" checked={deleteChat} onChange={(e) => onToggleDelete?.(e.target.checked)} />
                <span>Also delete this chat history</span>
              </label>
            )}
            {children}
            {note && <div className="relationship-modal__note">{note}</div>}
          </div>
          <div className="relationship-modal__actions">
            <button type="button" className="relationship-modal__cancel" onClick={onCancel}>Cancel</button>
            <button type="button" className={`relationship-modal__confirm relationship-modal__confirm--${confirmTone}`} onClick={onConfirm} disabled={loading || confirmDisabled}>
              {loading ? "Please wait..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function ReactionDetailsSheet({
  open,
  message,
  currentUserId,
  activeFilter,
  position,
  onChangeFilter,
  onToggleReaction,
  onClose,
}) {
  if (!open || !message) return null;

  const groupedReactions = groupMessageReactions(message.reactions, currentUserId);
  const filters = [
    { id: "all", label: "All", count: message.reactions.length },
    ...groupedReactions.map(([emoji, info]) => ({
      id: emoji,
      label: emoji,
      count: info.count,
    })),
  ];
  const filteredUsers = activeFilter === "all"
    ? groupedReactions.flatMap(([, info]) => info.users)
    : groupedReactions.find(([emoji]) => emoji === activeFilter)?.[1]?.users || [];
  const sheetStyle = position
    ? {
      top: `${position.top}px`,
      left: `${position.left}px`,
      transformOrigin: position.transformOrigin || "top left",
    }
    : undefined;

  return createPortal(
    <>
      <button
        type="button"
        className="reaction-sheet__backdrop"
        aria-label="Close reactions"
        onClick={onClose}
      />
      <div className="reaction-sheet" role="dialog" aria-modal="true" aria-label="Message reactions" style={sheetStyle}>
        <div className="reaction-sheet__card rb-reaction-card">
          <div className="reaction-sheet__header">
            <div>
              <h3 className="reaction-sheet__title">Reactions</h3>
              <p className="reaction-sheet__subtitle">
                {message.reactions.length === 1 ? "1 reaction" : `${message.reactions.length} reactions`}
              </p>
            </div>
            <button type="button" className="reaction-sheet__close" onClick={onClose} aria-label="Close reactions">
              x
            </button>
          </div>

          <div className="reaction-sheet__filters" role="tablist" aria-label="Reaction filters">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter.id}
                className={`reaction-sheet__filter ${activeFilter === filter.id ? "reaction-sheet__filter--active" : ""}`}
                onClick={() => onChangeFilter(filter.id)}
              >
                <span>{filter.label}</span>
                <span className="reaction-sheet__filter-count">{filter.count}</span>
              </button>
            ))}
          </div>

          <div className="reaction-sheet__list">
            {filteredUsers.length ? (
              filteredUsers.map((entry) => (
                <button
                  key={`${entry.id}-${entry.emoji}`}
                  type="button"
                  className={`reaction-sheet__row ${entry.isMe ? "reaction-sheet__row--removable" : ""}`}
                  onClick={() => {
                    if (!entry.isMe) return;
                    onToggleReaction(message.id, entry.emoji);
                  }}
                >
                  <span className="reaction-sheet__avatar" aria-hidden="true">
                    {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : getInitials(entry.name)}
                  </span>
                  <div className="reaction-sheet__person">
                    <span className="reaction-sheet__identity">
                      <span className="reaction-sheet__name">{entry.isMe ? "You" : entry.name}</span>
                      <span className="reaction-sheet__hint">
                        {entry.isMe ? "Click to remove" : "Reacted to this message"}
                      </span>
                    </span>
                    <span className="reaction-sheet__emoji">{entry.emoji}</span>
                  </div>
                </button>
              ))
            ) : (
              <div className="reaction-sheet__empty">No reactions in this filter yet.</div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function DateDivider({ label }) {
  return <div className="date-divider"><span className="date-divider__text">{label}</span></div>;
}

function formatCallDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallLogBubble({ message }) {
  const { callMeta, isMine, time } = message;
  const callType = callMeta?.callType || "audio";
  const outcome = callMeta?.outcome || "ended";
  const duration = callMeta?.duration || 0;

  const isVideo = callType === "video";

  // Label mirrors WhatsApp: from the viewer's perspective
  const getLabel = () => {
    if (outcome === "ended") {
      return isMine ? "Outgoing call" : "Incoming call";
    }
    if (outcome === "missed") {
      return isMine ? "Call not answered" : "Missed call";
    }
    if (outcome === "declined") {
      return isMine ? "Call declined" : "Declined call";
    }
    return "Call";
  };

  const durationLabel = outcome === "ended" ? formatCallDuration(duration) : null;
  const isMissedOrDeclined = outcome === "missed" || outcome === "declined";
  const isSuccess = outcome === "ended";

  return (
    <div className="call-log-bubble">
      <div className={`call-log-bubble__pill ${
        isMissedOrDeclined ? "call-log-bubble__pill--missed" :
        isSuccess         ? "call-log-bubble__pill--success" : ""
      }`}>
        <span className="call-log-bubble__icon" aria-hidden="true">
          {isVideo ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.76a16 16 0 0 0 6.32 6.32l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          )}
        </span>
        <span className="call-log-bubble__label">{getLabel()}</span>
        {durationLabel && (
          <span className="call-log-bubble__duration">{durationLabel}</span>
        )}
        <span className="call-log-bubble__time">{time}</span>
      </div>
    </div>
  );
}

function MessageRow(props) {
  const {
    message,
    isLocalOnly,
    currentUserId,
    selectMode,
    selected,
    openMenuId,
    openMenuPosition,
    activeReactionId,
    onToggleSelect,
    onOpenMenu,
    onSetActiveReaction,
    onReact,
    onOpenReactionDetails,
    onReply,
    onCopy,
    onDeleteForMe,
    onDeleteForEveryone,
    onPinMessage,
    onForward,
    onJumpToMessage,
    onCloseOverlays,
    onOpenImage,
    isGroupChat,
    rowRef,
    highlighted,
    onLongPressStart,
    onLongPressCancel,
  } = props;
  const isReactionActive = activeReactionId === message.id;
  const isVoiceNote = Boolean(message.voiceUrl);
  const isMediaMessage = Boolean(message.type && message.type !== "text" && !isVoiceNote);
  const canReact = !message.isDeletedForEveryone && !message.isPending && !message.hasError && !isLocalOnly;
  const canForward = !message.isDeletedForEveryone && !isLocalOnly;
  const canReply = !message.isDeletedForEveryone;
  const canCopy = message.type === "text" && !message.isDeletedForEveryone && Boolean((message.text || "").trim());
  const canPin = !message.isDeletedForEveryone && !isLocalOnly;
  const canDeleteForEveryone = message.isMine && !message.isDeletedForEveryone && !isLocalOnly;
  const groupedReactions = groupMessageReactions(message.reactions, currentUserId);

  return (
    <div ref={rowRef} className={`msg-row ${message.isMine ? "msg-row--mine" : ""} ${selectMode ? "msg-row--selectable" : ""} ${selected ? "msg-row--selected" : ""} ${highlighted ? "msg-row--jumped" : ""}`} data-message-id={message.id}>
      {selectMode && <button type="button" className={`msg-checkbox ${selected ? "msg-checkbox--checked" : ""}`} onClick={() => onToggleSelect(message.id)}>{selected ? "✓" : ""}</button>}
      <div className={`msg-group ${message.isMine ? "msg-group--mine" : "msg-group--other"}`}>
        {!message.isMine && isGroupChat && <div className="msg-sender">{message.senderName}</div>}
        <div className="msg-bubble-row" style={{ display: "flex", alignItems: "flex-end", gap: "8px", flexDirection: message.isMine ? "row-reverse" : "row" }}>
          {!message.isMine && (
            <div className="msg-avatar">
              {message.sender?.isBot || message.isSystem ? (
                <ConvoxLogo />
              ) : message.senderProfilePic ? (
                <img src={message.senderProfilePic} alt={message.senderName} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                message.senderInitials
              )}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: message.isMine ? "flex-end" : "flex-start", maxWidth: "100%" }}>
            {message.forwardedFrom && (
              <div className="msg-forwarded">
                <IconForwarded />
                <span>Forwarded</span>
              </div>
            )}
            <div
              className={["msg-bubble", isVoiceNote ? "msg-bubble--voice" : "", message.isMine ? "msg-bubble--mine" : "msg-bubble--other", message.isPending ? "msg-bubble--pending" : "", message.hasError ? "msg-bubble--error" : "", message.isDeletedForEveryone ? "msg-bubble--deleted" : ""].filter(Boolean).join(" ")}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenMenu(message.id, { x: event.clientX, y: event.clientY });
              }}
              onTouchStart={() => onLongPressStart?.(message)}
              onTouchMove={onLongPressCancel}
              onTouchEnd={onLongPressCancel}
            >
          {isVoiceNote ? (
            <div className="msg-voice">
              {message.replyTo && (
                <button
                  type="button"
                  className="msg-reply-card"
                  onClick={(event) => {
                    event.stopPropagation();
                    onJumpToMessage?.(message.replyTo.id);
                  }}
                >
                  <span className="msg-reply-card__rail" />
                  <span className="msg-reply-card__body">
                    <span className="msg-reply-card__name">{message.replyTo.isMine ? "You" : message.replyTo.senderName}</span>
                    <span className="msg-reply-card__text">{message.replyTo.text || "Attachment"}</span>
                  </span>
                </button>
              )}
              <div
                className="msg-voice__player-wrap"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenMenu(message.id, { x: event.clientX, y: event.clientY });
                }}
              >
                <audio className="msg-voice__player" controls src={message.voiceUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
              <div className="msg-voice__meta-row">
                <span className="msg-voice__meta">
                  Voice note{message.voiceDuration ? ` • ${Math.floor(message.voiceDuration / 60)}:${String(message.voiceDuration % 60).padStart(2, "0")}` : ""}
                </span>
                <button
                  type="button"
                  className="msg-voice__menu-btn"
                  aria-label="Message options"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    onOpenMenu(message.id, { x: rect.right, y: rect.bottom + 8 });
                  }}
                >
                  ...
                </button>
              </div>
            </div>
          ) : (
            <>
              {message.replyTo && (
                <button
                  type="button"
                  className="msg-reply-card"
                  onClick={(event) => {
                    event.stopPropagation();
                    onJumpToMessage?.(message.replyTo.id);
                  }}
                >
                  <span className="msg-reply-card__rail" />
                  <span className="msg-reply-card__body">
                    <span className="msg-reply-card__name">{message.replyTo.isMine ? "You" : message.replyTo.senderName}</span>
                    <span className="msg-reply-card__text">{message.replyTo.text || "Attachment"}</span>
                  </span>
                </button>
              )}
              {message.isDeletedForEveryone ? (
                <span className="msg-bubble__text">This message was deleted</span>
              ) : isMediaMessage ? (
                <MediaMessage message={{ ...message, onOpenImage }} />
              ) : (
                <span className="msg-bubble__text">{message.text}</span>
              )}
            </>
          )}
          {message.isEdited && !message.isDeletedForEveryone && <span className="msg-edited-tag">edited</span>}
            </div>
          </div>
        </div>
        {message.isPinned && <div className="msg-pinned-tag">Pinned</div>}
        {groupedReactions.length > 0 && (
          <div className="msg-reactions">
            {groupedReactions.map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                className={`msg-reaction-pill ${info.mine ? "msg-reaction-pill--active" : ""}`}
                onClick={(event) => onOpenReactionDetails(message.id, emoji, event.currentTarget.getBoundingClientRect())}
              >
                <span>{emoji}</span><span className="msg-reaction-pill__count">{info.count}</span>
              </button>
            ))}
          </div>
        )}
        <div className={`msg-meta ${message.isMine ? "msg-meta--mine" : ""}`}>
          <div className={`msg-reaction-launcher ${message.isMine ? "msg-reaction-launcher--mine" : "msg-reaction-launcher--other"} ${isReactionActive ? "msg-reaction-launcher--open" : ""}`}>
            {canReact && (
              <button
                type="button"
                className="msg-quick-react msg-quick-react--emoji"
                onClick={(event) => {
                  event.stopPropagation();
                  if (isReactionActive) {
                    onSetActiveReaction("");
                    return;
                  }
                  onSetActiveReaction(message.id);
                }}
                aria-label="Open reactions"
                aria-expanded={isReactionActive}
              >
                <ReactionTriggerIcon />
              </button>
            )}
            {canReact && isReactionActive && (
              <div data-reaction-popover className={`msg-reaction-panel msg-reaction-panel--inline ${message.isMine ? "msg-reaction-panel--mine" : "msg-reaction-panel--other"}`}>
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="ctx-reaction-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReact(message.id, emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="msg-time">{message.hasError ? "Failed to send" : message.isPending ? "Sending..." : message.time}</span>
        </div>
        {openMenuId === message.id && (
          createPortal(
            <>
              <button
                type="button"
                className="ctx-menu-backdrop"
                aria-label="Close message menu"
                onClick={onCloseOverlays}
              />
              <div
                data-message-menu
                className="ctx-menu"
                style={{ top: `${openMenuPosition?.y ?? 0}px`, left: `${openMenuPosition?.x ?? 0}px` }}
              >
                {canReply && <button type="button" className="ctx-item" onClick={() => onReply(message.id)}><span className="ctx-item__icon"><IconReply /></span><span>Reply</span></button>}
                {canCopy && <button type="button" className="ctx-item" onClick={() => onCopy(message.id)}><span className="ctx-item__icon"><IconCopy /></span><span>Copy</span></button>}
                {canPin && <button type="button" className="ctx-item" onClick={() => onPinMessage(message.id)}><span className="ctx-item__icon"><IconPin /></span><span>{message.isPinned ? "Remove pin" : "Pin message"}</span></button>}
                {canForward && <button type="button" className="ctx-item" onClick={() => onForward([message.id])}><span className="ctx-item__icon"><IconForward /></span><span>Forward</span></button>}
                <button type="button" className="ctx-item" onClick={() => onToggleSelect(message.id)}><span className="ctx-item__icon"><IconSelect /></span><span>Select</span></button>
                <div className="ctx-divider" />
                <button type="button" className="ctx-item" onClick={() => onDeleteForMe(message.id)}><span className="ctx-item__icon"><IconTrash /></span><span>Delete for me</span></button>
                {canDeleteForEveryone && <button type="button" className="ctx-item ctx-item--danger" onClick={() => onDeleteForEveryone(message.id)}><span className="ctx-item__icon"><IconTrash /></span><span>Delete for everyone</span></button>}
              </div>
            </>,
            document.body,
          )
        )}
      </div>
    </div>
  );
}

export default function ChatWindow({
  chat,
  currentUserId,
  currentUserName,
  onVideoCall,
  onAudioCall,
  onMessageSent,
  onChatPreviewChanged,
  onChatRemoved,
  onGroupUpdated,
  onGroupLeft,
  onGroupDeleted,
  onBack,
}) {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [messagePagination, setMessagePagination] = useState({
    hasMore: false,
    nextCursor: null,
  });
  const [messageError, setMessageError] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [actionError, setActionError] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteChatOnAction, setDeleteChatOnAction] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [forwardTargets, setForwardTargets] = useState([]);
  const [selectedForwardChatIds, setSelectedForwardChatIds] = useState([]);
  const [openMessageMenu, setOpenMessageMenu] = useState({ id: "", x: 0, y: 0 });
  const [activeReactionMessageId, setActiveReactionMessageId] = useState("");
  const [reactionDetails, setReactionDetails] = useState({ messageId: "", filter: "all", position: null });
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingText, setEditingText] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [replyDraft, setReplyDraft] = useState(null);
  const [jumpedMessageId, setJumpedMessageId] = useState("");
  // Mobile bottom sheet state (long-press context menu)
  const [mobileSheet, setMobileSheet] = useState({ open: false, message: null });
  // Smart replies dismiss state
  const [smartRepliesDismissed, setSmartRepliesDismissed] = useState(false);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);
  const bottomRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const isBotChat = Boolean(chat?.isBotChat);
  const {
    status: assistantStatus,
    countdown,
    smartReplies,
    loadingSmartReplies,
    assistantTyping,
    summary,
    loadingSummary,
    setTyping,
    updateStatusFromResponse,
    requestSummary,
    clearSummary,
  } = useAssistantChat({ chatId: chat?.id, isBot: isBotChat, messages });
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [askQuery, setAskQuery] = useState("");
  const [askResult, setAskResult] = useState(null);
  const [isAsking, setIsAsking] = useState(false);
  const actionsRef = useRef(null);
  const messageNodeRefs = useRef(new Map());
  const jumpHighlightTimerRef = useRef(null);
  const messagesRef = useRef(messages);
  const isSendingRef = useRef(false);
  const preserveScrollStateRef = useRef(null);
  const isNearBottomRef = useRef(true);
  // Swipe-right-to-open-sidebar gesture refs
  const chatSwipeTouchStartX = useRef(0);
  const chatSwipeTouchStartY = useRef(0);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { isSendingRef.current = isSending; }, [isSending]);
  const isDirectChat = !chat?.isGroupChat && Boolean(chat?.otherUserId);
  const directChatStatusText = useMemo(() => {
    if (chat?.isGroupChat) {
      return chat?.memberCount === 1 ? "1 member" : `${chat?.memberCount ?? 0} members`;
    }

    return chat?.status === "online"
      ? "Active now"
      : formatLastSeen(chat?.lastSeen || chat?.lastActivityAt);
  }, [chat?.isGroupChat, chat?.lastActivityAt, chat?.lastSeen, chat?.memberCount, chat?.status]);
  const items = useMemo(() => timeline(messages), [messages]);
  const isLocalOnlyMessage = useCallback((messageId) => String(messageId).startsWith("voice-") || String(messageId).startsWith("temp-"), []);
  const selectedMessages = useMemo(
    () => messages.filter((message) => selectedMessageIds.includes(message.id)),
    [messages, selectedMessageIds],
  );

  const selectedMineRemoteIds = useMemo(
    () =>
      selectedMessages
        .filter((message) => message.isMine && !message.isDeletedForEveryone && !isLocalOnlyMessage(message.id))
        .map((message) => message.id),
    [isLocalOnlyMessage, selectedMessages],
  );
  const selectedForwardableIds = useMemo(
    () =>
      selectedMessages
        .filter((message) => !message.isDeletedForEveryone && !isLocalOnlyMessage(message.id))
        .map((message) => message.id),
    [isLocalOnlyMessage, selectedMessages],
  );
  const selectedSingleMessage = selectedMessages.length === 1 ? selectedMessages[0] : null;
  const imageMessages = useMemo(
    () =>
      messages.filter(
        (message) =>
          message.type === "image" &&
          !message.isDeletedForEveryone &&
          !message.hasError &&
          message.mediaUrl,
      ),
    [messages],
  );
  const pinnedMessages = useMemo(
    () =>
      [...messages]
        .filter((message) => message.isPinned && !message.isDeletedForEveryone)
        .sort((left, right) => right.sentAt - left.sentAt),
    [messages],
  );
  const activePinnedMessage = pinnedMessages[0] || null;
  const reactionDetailsMessage = useMemo(
    () => messages.find((message) => message.id === reactionDetails.messageId) || null,
    [messages, reactionDetails.messageId],
  );
  const lightboxIndex = useMemo(
    () => imageMessages.findIndex((message) => message.id === lightboxImage?.id),
    [imageMessages, lightboxImage],
  );
  const activeLightboxImage =
    lightboxIndex >= 0 ? imageMessages[lightboxIndex] : lightboxImage;
  const canShowPrevImage = lightboxIndex > 0;
  const canShowNextImage = lightboxIndex >= 0 && lightboxIndex < imageMessages.length - 1;

  const syncPreviewFromMessages = useCallback((nextMessages) => {
    const latestVisibleMessage = [...nextMessages]
      .reverse()
      .find((message) => !message.isDeletedForEveryone && !message.hasError);

    onChatPreviewChanged?.(
      chat?.id,
      latestVisibleMessage?.text || "No messages yet",
      latestVisibleMessage?.sentAt || null,
    );
  }, [chat?.id, onChatPreviewChanged]);

  useEffect(() => {
    syncPreviewFromMessages(messages);
  }, [messages, syncPreviewFromMessages]);

  const removeMessageLocally = useCallback((messageId) => {
    setMessages((prev) => {
      return prev.filter((message) => message.id !== messageId);
    });
    setSelectedMessageIds((prev) => prev.filter((id) => id !== messageId));
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
    setActiveReactionMessageId("");
    if (editingMessageId === messageId) {
      setEditingMessageId("");
      setEditingText("");
    }
  }, [editingMessageId]);

  const replaceMessage = useCallback((updatedMessage) => {
    const formatted = fmt(updatedMessage, currentUserId);
    setMessages((prev) => prev.map((entry) => (entry.id === formatted.id ? formatted : entry)));
  }, [currentUserId]);

  const closeFloatingLayers = useCallback(() => {
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
    setActiveReactionMessageId("");
  }, []);

  /* ── Mobile long-press handlers ── */
  const handleLongPressStart = useCallback((message) => {
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setMobileSheet({ open: true, message });
    }, 500);
  }, []);

  const handleLongPressCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const closeMobileSheet = useCallback(() => {
    setMobileSheet({ open: false, message: null });
  }, []);

  const closeReactionDetails = useCallback(() => {
    setReactionDetails({ messageId: "", filter: "all", position: null });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxImage(null);
    setLightboxZoom(1);
  }, []);

  const registerMessageNode = useCallback((messageId, node) => {
    if (node) {
      messageNodeRefs.current.set(messageId, node);
      return;
    }
    messageNodeRefs.current.delete(messageId);
  }, []);

  const jumpToMessage = useCallback((messageId) => {
    const target = messageNodeRefs.current.get(messageId);
    if (!target) {
      setActionError("That message is not visible in this chat anymore.");
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setJumpedMessageId(messageId);
    if (jumpHighlightTimerRef.current) {
      window.clearTimeout(jumpHighlightTimerRef.current);
    }
    jumpHighlightTimerRef.current = window.setTimeout(() => {
      setJumpedMessageId("");
      jumpHighlightTimerRef.current = null;
    }, 1400);
  }, []);

  const openLightboxImage = useCallback((message) => {
    setLightboxImage(message);
    setLightboxZoom(1);
  }, []);

  const showPrevImage = useCallback(() => {
    if (lightboxIndex <= 0) return;
    setLightboxImage(imageMessages[lightboxIndex - 1]);
    setLightboxZoom(1);
  }, [imageMessages, lightboxIndex]);

  const showNextImage = useCallback(() => {
    if (lightboxIndex < 0 || lightboxIndex >= imageMessages.length - 1) return;
    setLightboxImage(imageMessages[lightboxIndex + 1]);
    setLightboxZoom(1);
  }, [imageMessages, lightboxIndex]);

  useEffect(() => {
    setShowActions(false);
    setActionError("");
    setPendingAction("");
    setPendingDelete(null);
    setDeleteChatOnAction(false);
    setSelectMode(false);
    setSelectedMessageIds([]);
    closeFloatingLayers();
    setReactionDetails({ messageId: "", filter: "all" });
    setEditingMessageId("");
    setEditingText("");
    setLightboxImage(null);
    setLightboxZoom(1);
    setReplyDraft(null);
    setJumpedMessageId("");
    setLoadingOlderMessages(false);
    setMessagePagination({ hasMore: false, nextCursor: null });
    preserveScrollStateRef.current = null;
    isNearBottomRef.current = true;
  }, [chat?.id, closeFloatingLayers]);

  useEffect(() => () => {
    if (jumpHighlightTimerRef.current) {
      window.clearTimeout(jumpHighlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!lightboxImage) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setLightboxImage(null);
        setLightboxZoom(1);
      } else if (event.key === "ArrowLeft") {
        showPrevImage();
      } else if (event.key === "ArrowRight") {
        showNextImage();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage, showNextImage, showPrevImage]);

  useEffect(() => {
    if (!showActions) return undefined;
    const handleOutside = (event) => {
      if (!actionsRef.current?.contains(event.target)) setShowActions(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showActions]);

  useEffect(() => {
    if (!openMessageMenu.id && !activeReactionMessageId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeFloatingLayers();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeReactionMessageId, closeFloatingLayers, openMessageMenu.id]);

  useEffect(() => {
    if (!openMessageMenu.id && !activeReactionMessageId) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest?.("[data-message-menu]")) return;
      if (target.closest?.("[data-reaction-popover]")) return;
      if (target.closest?.(".msg-quick-react--emoji")) return;

      closeFloatingLayers();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeReactionMessageId, closeFloatingLayers, openMessageMenu.id]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!chat?.id) return;
      // Clear previous chat's messages immediately — prevents stale messages
      // from the old chat flashing briefly in the new chat while fetching
      setMessages([]);
      setLoadingMessages(true);
      setMessageError("");
      try {
        const { messages: loadedMessages, pagination } = await fetchMessagesApi(chat.id);
        if (active) {
          setMessages(loadedMessages.map((message) => fmt(message, currentUserId)));
          setMessagePagination({
            hasMore: Boolean(pagination?.hasMore),
            nextCursor: pagination?.nextCursor || null,
          });
        }
      } catch (error) {
        if (active) setMessageError(error.response?.data?.message || "Failed to load messages.");
      } finally {
        if (active) setLoadingMessages(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [chat?.id, currentUserId]);

  const loadOlderMessages = useCallback(async () => {
    if (!chat?.id || loadingMessages || loadingOlderMessages || !messagePagination.nextCursor) {
      return;
    }

    const container = messagesAreaRef.current;
    if (container) {
      preserveScrollStateRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }

    setLoadingOlderMessages(true);
    try {
      const { messages: olderMessages, pagination } = await fetchMessagesApi(chat.id, {
        before: messagePagination.nextCursor,
      });

      const formattedOlder = olderMessages.map((message) => fmt(message, currentUserId));
      setMessages((prev) => {
        const existingIds = new Set(prev.map((message) => message.id));
        const uniqueOlder = formattedOlder.filter((message) => !existingIds.has(message.id));
        return uniqueOlder.length ? [...uniqueOlder, ...prev] : prev;
      });
      setMessagePagination({
        hasMore: Boolean(pagination?.hasMore),
        nextCursor: pagination?.nextCursor || null,
      });
    } catch (error) {
      preserveScrollStateRef.current = null;
      setActionError(error.response?.data?.message || "Failed to load older messages.");
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [chat?.id, currentUserId, loadingMessages, loadingOlderMessages, messagePagination.nextCursor]);

  useEffect(() => {
    if (!chat?.id) return undefined;
    joinChat(chat.id);
    clearNotification(chat.id);
    const unsubscribe = subscribeToMessages((message) => {
      const chatId = String(message.chatId ?? message.chat?._id ?? "");
      if (chatId !== String(chat.id)) return;
      if (message.isSystem) {
        setTyping(false);
      }
      setMessages((prev) => {
        const incomingId = String(message._id ?? "");
        const formattedIncoming = fmt(message, currentUserId);

        if (incomingId && prev.some((entry) => entry.id === incomingId)) {
          return prev;
        }

        if (!message.isSystem && formattedIncoming.isMine) {
          const optimisticIndex = prev.findIndex(
            (entry) =>
              entry.isPending &&
              entry.isMine &&
              entry.text === formattedIncoming.text &&
              !entry.isDeletedForEveryone,
          );

          if (optimisticIndex !== -1) {
            const next = [...prev];
            next[optimisticIndex] = formattedIncoming;
            return next;
          }
        }

        return [...prev, formattedIncoming];
      });
    });

    const handleAssistantTyping = ({ chatId: incomingId }) => {
      if (String(incomingId) === String(chat.id)) setTyping(true);
    };
    const handleAssistantTypingStop = ({ chatId: incomingId }) => {
      if (String(incomingId) === String(chat.id)) setTyping(false);
    };

    socket.on("assistantTyping", handleAssistantTyping);
    socket.on("assistantTypingStop", handleAssistantTypingStop);

    return () => {
      socket.off("assistantTyping", handleAssistantTyping);
      socket.off("assistantTypingStop", handleAssistantTypingStop);
      unsubscribe();
      leaveCurrentChat();
    };
  }, [chat?.id, currentUserId, setTyping]);

  useEffect(() => {
    const container = messagesAreaRef.current;
    if (!container) return;

    if (preserveScrollStateRef.current) {
      const { scrollTop, scrollHeight } = preserveScrollStateRef.current;
      container.scrollTop = container.scrollHeight - scrollHeight + scrollTop;
      preserveScrollStateRef.current = null;
      return;
    }

    if (isNearBottomRef.current || loadingMessages) {
      bottomRef.current?.scrollIntoView({ behavior: loadingMessages ? "auto" : "smooth" });
    }
  }, [messages, loadingMessages]);

  const handleScroll = useCallback((event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.target;
    setIsScrolled(scrollTop > 10);
    isNearBottomRef.current = scrollHeight - (scrollTop + clientHeight) < 80;

    if (scrollTop < 80 && messagePagination.hasMore && !loadingOlderMessages && !loadingMessages) {
      loadOlderMessages();
    }
  }, [loadOlderMessages, loadingMessages, loadingOlderMessages, messagePagination.hasMore]);

  const handleSend = useCallback(async (text, replyToId) => {
    if (!chat?.id || !text.trim() || isSendingRef.current) return;

    if (isBotChat) {
      if (assistantStatus.limitReached) return;
      isSendingRef.current = true;

      const tempId = `temp-${Date.now()}`;
      const optimistic = fmt({
        id: tempId,
        senderId: currentUserId,
        senderName: currentUserName || "You",
        text,
        sentAt: Date.now(),
        isPending: true,
      }, currentUserId);

      setMessages((prev) => [...prev, optimistic]);
      setIsSending(true);
      setTyping(true);

      try {
        const result = await sendAssistantMessage(chat.id, text);
        const formatted = fmt(result.data, currentUserId);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId ? formatted : message,
          ),
        );
        updateStatusFromResponse(result);
      } catch (error) {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === tempId
              ? { ...message, isPending: false, hasError: true }
              : message,
          ),
        );
        if (error.response?.data?.limitReached) {
          updateStatusFromResponse(error.response.data);
        }
      } finally {
        setIsSending(false);
        isSendingRef.current = false;
        setTyping(false);
      }
      return;
    }

    isSendingRef.current = true;
    const tempId = `temp-${Date.now()}`;
    const replySource = replyToId ? messagesRef.current.find((message) => message.id === replyToId) : null;
    const optimistic = fmt({
      id: tempId,
      senderId: currentUserId,
      senderName: currentUserName || "You",
      text,
      sentAt: Date.now(),
      isPending: true,
      replyTo: replySource ? buildReplyPreview(replySource, currentUserId) : null,
    }, currentUserId);
    setMessages((prev) => [...prev, optimistic]);
    setIsSending(true);
    try {
      const saved = await sendMessageApi({ chatId: chat.id, content: text, replyTo: replyToId });
      const formatted = fmt(saved, currentUserId);
      setMessages((prev) => prev.map((message) => (message.id === tempId ? formatted : message)));
      onMessageSent?.(saved);
    } catch (error) {
      setMessages((prev) => prev.map((message) => (message.id === tempId ? { ...message, isPending: false, hasError: true } : message)));
      setActionError(error.response?.data?.message || "Could not send that message.");
    } finally {
      setIsSending(false);
      isSendingRef.current = false;
    }
  }, [
    assistantStatus.limitReached,
    chat?.id,
    currentUserId,
    currentUserName,
    isBotChat,
    onMessageSent,
    setTyping,
    updateStatusFromResponse,
  ]);

  const handleVoiceMessageSent = useCallback(({ url, duration, mimeType }, replyToId) => {
    if (!url) return;
    const replySource = replyToId ? messagesRef.current.find((message) => message.id === replyToId) : null;
    const voiceMessage = fmt({
      id: `voice-${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName || "You",
      text: "Voice note",
      sentAt: Date.now(),
      voiceUrl: url,
      voiceDuration: duration,
      mimeType,
      replyTo: replySource ? buildReplyPreview(replySource, currentUserId) : null,
    }, currentUserId);

    setMessages((prev) => [...prev, voiceMessage]);
  }, [currentUserId, currentUserName]);

  const handleMediaMessageSent = useCallback((savedMessage) => {
    if (!savedMessage?._id) return;

    const formatted = fmt(savedMessage, currentUserId);
    setMessages((prev) => {
      if (prev.some((message) => message.id === formatted.id)) {
        return prev;
      }
      return [...prev, formatted];
    });
    onMessageSent?.(savedMessage);
  }, [currentUserId, onMessageSent]);

  const handleReact = useCallback(async (messageId, emoji) => {
    const targetMessage = messagesRef.current.find((message) => message.id === messageId);
    if (!targetMessage || targetMessage.isDeletedForEveryone || targetMessage.isPending || targetMessage.hasError || isLocalOnlyMessage(messageId)) {
      return;
    }
    try {
      replaceMessage(await reactToMessage(messageId, emoji));
      closeFloatingLayers();
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not react to that message.");
    }
  }, [closeFloatingLayers, isLocalOnlyMessage, replaceMessage]);

  const handleOpenReactionDetails = useCallback((messageId, filter = "all", anchorRect = null) => {
    const targetMessage = messagesRef.current.find((message) => message.id === messageId);
    if (!targetMessage?.reactions?.length) return;
    const popupWidth = 460;
    const popupHeight = 300;
    const gutter = 16;
    const top = anchorRect
      ? Math.max(gutter, Math.min(window.innerHeight - popupHeight - gutter, anchorRect.top - popupHeight - 14))
      : Math.max(gutter, (window.innerHeight - popupHeight) / 2);
    const left = anchorRect
      ? Math.max(gutter, Math.min(window.innerWidth - popupWidth - gutter, anchorRect.left - popupWidth + anchorRect.width))
      : Math.max(gutter, (window.innerWidth - popupWidth) / 2);
    const transformOrigin = anchorRect && anchorRect.left > window.innerWidth / 2 ? "bottom right" : "bottom left";

    setReactionDetails({
      messageId,
      filter,
      position: {
        top,
        left,
        transformOrigin,
      },
    });
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
    setActiveReactionMessageId("");
  }, []);

  const toggleSelectedMessage = useCallback((messageId) => {
    setSelectedMessageIds((prev) => {
      const nextSelected = prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId];
      setSelectMode(nextSelected.length > 0);
      return nextSelected;
    });
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
  }, []);

  const handleReplyMessage = useCallback((messageId) => {
    const targetMessage = messagesRef.current.find((message) => message.id === messageId);
    if (!targetMessage || targetMessage.isDeletedForEveryone) return;

    setReplyDraft(buildReplyPreview(targetMessage, currentUserId));
    setSelectedMessageIds([]);
    setSelectMode(false);
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
    setActiveReactionMessageId("");
  }, [currentUserId]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessageId || !editingText.trim()) return;
    try {
      replaceMessage(await editMessageApi(editingMessageId, editingText));
      setEditingMessageId("");
      setEditingText("");
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not edit that message.");
    }
  }, [editingMessageId, editingText, replaceMessage]);

  const executeDeleteForMe = useCallback(async (messageId) => {
    if (isLocalOnlyMessage(messageId)) {
      removeMessageLocally(messageId);
      return;
    }
    try {
      await deleteMessageForMe(messageId);
      removeMessageLocally(messageId);
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not delete that message.");
    }
  }, [isLocalOnlyMessage, removeMessageLocally]);

  const executeDeleteForEveryone = useCallback(async (messageId) => {
    if (isLocalOnlyMessage(messageId)) {
      removeMessageLocally(messageId);
      return;
    }
    try {
      replaceMessage(await deleteMessageForEveryone(messageId));
      setOpenMessageMenu({ id: "", x: 0, y: 0 });
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not delete that message.");
    }
  }, [isLocalOnlyMessage, removeMessageLocally, replaceMessage]);

  const handleDeleteForMe = useCallback((messageId) => {
    setPendingDelete({ type: "single-me", messageIds: [messageId] });
    closeFloatingLayers();
  }, [closeFloatingLayers]);

  const handleCopyMessage = useCallback(async (messageId) => {
    const targetMessage = messagesRef.current.find((message) => message.id === messageId);
    const copyText = targetMessage?.text?.trim();
    if (!copyText) return;

    try {
      await navigator.clipboard.writeText(copyText);
      closeFloatingLayers();
      setActionError("Message copied.");
      window.setTimeout(() => {
        setActionError((current) => (current === "Message copied." ? "" : current));
      }, 1600);
    } catch {
      setActionError("Could not copy that message.");
    }
  }, [closeFloatingLayers]);

  const handleDeleteForEveryone = useCallback((messageId) => {
    setPendingDelete({ type: "single-everyone", messageIds: [messageId] });
    closeFloatingLayers();
  }, [closeFloatingLayers]);

  const handlePinMessage = useCallback(async (messageId) => {
    const targetMessage = messagesRef.current.find((message) => message.id === messageId);
    if (!targetMessage || targetMessage.isDeletedForEveryone || isLocalOnlyMessage(messageId)) {
      return;
    }
    try {
      const updated = await togglePinMessageApi(messageId);
      if (!updated) throw new Error("Pin update failed");
      replaceMessage(updated);
      closeFloatingLayers();
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not pin that message.");
    }
  }, [closeFloatingLayers, isLocalOnlyMessage, replaceMessage]);

  const openForwardModal = useCallback(async (messageIds) => {
    const forwardableMessageIds = messageIds.filter((id) => {
      const message = messagesRef.current.find((entry) => entry.id === id);
      return message && !message.isDeletedForEveryone && !isLocalOnlyMessage(id);
    });
    if (!forwardableMessageIds.length) {
      setActionError("Only sent and server-saved messages can be forwarded.");
      return;
    }
    try {
      const chats = await fetchChatsApi();
      const mappedTargets = chats.map((entry) => {
        const id = String(entry._id);
        const isCurrentChat = id === String(chat?.id);
        const users = Array.isArray(entry.users) ? entry.users : [];
        const otherUser = users.find((user) => String(user._id) !== String(currentUserId));
        const name = entry.isGroupChat
          ? entry.groupName || "Group Chat"
          : otherUser?.name || "Chat";

        return {
          id,
          name: isCurrentChat ? `${name} (this chat)` : name,
          isCurrentChat,
          avatarUrl: isCurrentChat ? chat?.avatarUrl || "" : otherUser?.profilePic || "",
          initials: isCurrentChat ? chat?.initials || getInitials(name) : getInitials(name),
        };
      });

      if (chat?.id && !mappedTargets.some((entry) => entry.id === String(chat.id))) {
        mappedTargets.unshift({
          id: String(chat.id),
          name: `${chat?.name || "This chat"} (this chat)`,
          isCurrentChat: true,
          avatarUrl: chat?.avatarUrl || "",
          initials: chat?.initials || getInitials(chat?.name || "Chat"),
        });
      }

      setForwardTargets(mappedTargets.sort((left, right) => Number(right.isCurrentChat) - Number(left.isCurrentChat)));
      setSelectedForwardChatIds([]);
      setSelectedMessageIds(forwardableMessageIds);
      setPendingAction("forward");
      setOpenMessageMenu({ id: "", x: 0, y: 0 });
    } catch {
      setActionError("Could not load chats for forwarding.");
    }
  }, [
    chat?.avatarUrl,
    chat?.id,
    chat?.initials,
    chat?.name,
    currentUserId,
    isLocalOnlyMessage,
  ]);

  const handleForward = useCallback(async () => {
    if (!selectedMessageIds.length || !selectedForwardChatIds.length) return;
    try {
      setActionLoading("forward");
      await forwardMessagesApi(selectedMessageIds, selectedForwardChatIds);
      setPendingAction("");
      setSelectedForwardChatIds([]);
      setSelectedMessageIds([]);
      setSelectMode(false);
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not forward those messages.");
    } finally {
      setActionLoading("");
    }
  }, [selectedForwardChatIds, selectedMessageIds]);

  const executeBulkDeleteForMe = useCallback(async () => {
    try {
      const remoteIds = selectedMessageIds.filter((id) => !isLocalOnlyMessage(id));
      await Promise.all(remoteIds.map((id) => deleteMessageForMe(id)));
      setMessages((prev) => prev.filter((message) => !selectedMessageIds.includes(message.id)));
      setSelectedMessageIds([]);
      setSelectMode(false);
      setOpenMessageMenu({ id: "", x: 0, y: 0 });
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not delete selected messages.");
    }
  }, [isLocalOnlyMessage, selectedMessageIds]);

  const executeBulkDeleteForEveryone = useCallback(async () => {
    if (!selectedMineRemoteIds.length) return;
    try {
      const updatedMessages = await Promise.all(
        selectedMineRemoteIds.map((id) => deleteMessageForEveryone(id)),
      );
      const updatesById = new Map(
        updatedMessages
          .filter(Boolean)
          .map((message) => [String(message._id || message.id), fmt(message, currentUserId)]),
      );
      setMessages((prev) => prev.map((message) => updatesById.get(message.id) || message));
      setSelectedMessageIds((prev) => prev.filter((id) => !selectedMineRemoteIds.includes(id)));
      setSelectMode(false);
      setOpenMessageMenu({ id: "", x: 0, y: 0 });
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not delete selected messages for everyone.");
    }
  }, [currentUserId, selectedMineRemoteIds]);

  const handleBulkDeleteForMe = useCallback(() => {
    if (!selectedMessageIds.length) return;
    setPendingDelete({ type: "bulk-me", messageIds: selectedMessageIds });
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
  }, [selectedMessageIds]);

  const handleBulkDeleteForEveryone = useCallback(() => {
    if (!selectedMineRemoteIds.length) return;
    setPendingDelete({ type: "bulk-everyone", messageIds: selectedMineRemoteIds });
    setOpenMessageMenu({ id: "", x: 0, y: 0 });
  }, [selectedMineRemoteIds]);

  const confirmPendingDelete = useCallback(async () => {
    if (!pendingDelete) return;

    try {
      setActionLoading("delete");

      if (pendingDelete.type === "single-me") {
        await executeDeleteForMe(pendingDelete.messageIds[0]);
      } else if (pendingDelete.type === "single-everyone") {
        await executeDeleteForEveryone(pendingDelete.messageIds[0]);
      } else if (pendingDelete.type === "bulk-me") {
        await executeBulkDeleteForMe();
      } else if (pendingDelete.type === "bulk-everyone") {
        await executeBulkDeleteForEveryone();
      }

      setPendingDelete(null);
    } finally {
      setActionLoading("");
    }
  }, [executeBulkDeleteForEveryone, executeBulkDeleteForMe, executeDeleteForEveryone, executeDeleteForMe, pendingDelete]);

  const handleRemoveFriend = useCallback(async () => {
    if (!chat?.id) return;
    try {
      setActionLoading("remove");
      await removeDirectChat(chat.id, { deleteChat: deleteChatOnAction });
      onChatRemoved?.(chat.id, { deleteChat: deleteChatOnAction, restrictionReason: "You removed this friend. Send and accept a new request to message again." });
      setPendingAction("");
      setDeleteChatOnAction(false);
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not remove this friend.");
    } finally {
      setActionLoading("");
    }
  }, [chat?.id, deleteChatOnAction, onChatRemoved]);

  const handleBlockUser = useCallback(async () => {
    if (!chat?.otherUserId) return;
    try {
      setActionLoading("block");
      await blockUser(chat.otherUserId, { deleteChat: deleteChatOnAction });
      onChatRemoved?.(chat.id, { deleteChat: deleteChatOnAction, restrictionReason: "You cannot message this user because one of you has blocked the other." });
      setPendingAction("");
      setDeleteChatOnAction(false);
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not block this user.");
    } finally {
      setActionLoading("");
    }
  }, [chat?.id, chat?.otherUserId, deleteChatOnAction, onChatRemoved]);

  const handleClearChat = useCallback(async () => {
    if (!chat?.id) return;
    try {
      setActionLoading("clear");
      await clearChatMessages(chat.id);
      setMessages([]);
      onChatPreviewChanged?.(chat.id, "No messages yet", null);
      setPendingAction("");
    } catch (error) {
      setActionError(error.response?.data?.message || "Could not clear this chat.");
    } finally {
      setActionLoading("");
    }
  }, [chat?.id, onChatPreviewChanged]);

  const handleOpenDetails = useCallback(() => {
    if (chat?.isGroupChat) {
      setShowGroupInfo(true);
      return;
    }

    setShowProfile(true);
  }, [chat?.isGroupChat]);

  return (
    <div
      className="chat-window"
      onTouchStart={(e) => {
        chatSwipeTouchStartX.current = e.touches[0].clientX;
        chatSwipeTouchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - chatSwipeTouchStartX.current;
        const dy = Math.abs(e.changedTouches[0].clientY - chatSwipeTouchStartY.current);
        // Swipe right ≥60px from left edge → open sidebar
        if (dx > 60 && dy < 80 && chatSwipeTouchStartX.current < 40) {
          onBack?.();
        }
      }}
    >
      {/* Instagram-style header */}
      <div className={`chat-header ig-header ${isScrolled ? "chat-header--scrolled" : ""}`}>
        <div className="ig-header__left">
          {onBack && (
            <button type="button" className="ig-header__back" onClick={onBack} aria-label="Back">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          <button
            type="button"
            className="ig-header__identity"
            onClick={handleOpenDetails}
            aria-label={chat?.isGroupChat ? "View group info" : "View profile"}
          >
            <div className="ig-header__avatar-ring">
              <div className="ig-header__avatar">
                {isBotChat ? <ConvoxLogo /> : chat?.avatarUrl ? <img src={chat.avatarUrl} alt={chat?.name ?? "Chat"} className="ig-header__avatar-img" /> : <span>{chat?.initials ?? "?"}</span>}
              </div>
            </div>
            <div className="ig-header__meta">
              <span className="ig-header__name">
                {chat?.name ?? "Conversation"}
                {isBotChat && <span className="assistant-badge">Assistant</span>}
              </span>
              <span className="ig-header__status">
                {!chat?.isGroupChat && chat?.status === "online" && <span className="ig-header__online-dot" />}
                {directChatStatusText}
              </span>
            </div>
          </button>
        </div>
        <div className="ig-header__actions" ref={actionsRef}>
          <CallButton
            onVideoCall={() => onVideoCall?.({
              targetUserId: chat?.otherUserId,
              targetUserName: chat?.name,
            })}
            onAudioCall={() => onAudioCall?.({
              targetUserId: chat?.otherUserId,
              targetUserName: chat?.name,
            })}
            disabled={!isDirectChat || isBotChat || !chat?.otherUserId}
          />
          <button
            type="button"
            className="ig-header__icon-btn"
            onClick={() => {
              requestSummary();
              setShowSummaryModal(true);
            }}
            aria-label="Summarize chat"
            title="Summarize this chat"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </button>
          <button type="button" className="ig-header__icon-btn" onClick={() => setShowActions(prev => !prev)} aria-expanded={showActions} aria-label="More options">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
          </button>
          {showActions && (
            <div className="chat-header__menu">
              {chat?.isGroupChat && (
                <button
                  type="button"
                  className="chat-header__menu-item"
                  onClick={() => {
                    setShowGroupInfo(true);
                    setShowActions(false);
                  }}
                >
                  <span className="chat-header__menu-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </span>
                  <span>Group Info</span>
                </button>
              )}
              <button type="button" className="chat-header__menu-item" onClick={() => { setShowAskModal(true); setShowActions(false); }}><span className="chat-header__menu-icon">✨</span><span>Ask AI</span></button>
              <button type="button" className="chat-header__menu-item" onClick={() => { setSelectMode(true); setShowActions(false); }}><span className="chat-header__menu-icon"><IconSelect /></span><span>Select Messages</span></button>
              <button type="button" className="chat-header__menu-item" onClick={() => { setPendingAction("clear-chat"); setShowActions(false); }}><span className="chat-header__menu-icon"><IconClearChat /></span><span>Clear Chat</span></button>
              {isDirectChat && !isBotChat && <>
                <div className="chat-header__menu-divider" />
                <button type="button" className="chat-header__menu-item" onClick={() => { setPendingAction("remove"); setDeleteChatOnAction(false); setShowActions(false); }}><span className="chat-header__menu-icon"><IconRemoveFriend /></span><span>Remove Friend</span></button>
                <button type="button" className="chat-header__menu-item chat-header__menu-item--danger" onClick={() => { setPendingAction("block"); setDeleteChatOnAction(false); setShowActions(false); }}><span className="chat-header__menu-icon"><IconBlock /></span><span>Block User</span></button>
              </>}
            </div>
          )}
        </div>
      </div>

      {activePinnedMessage && (
        <div className="chat-pinned-bar" role="status" aria-live="polite">
          <button
            type="button"
            className="chat-pinned-bar__jump"
            onClick={() => jumpToMessage(activePinnedMessage.id)}
            aria-label="Jump to pinned message"
          >
            <div className="chat-pinned-bar__accent" aria-hidden="true" />
            <div className="chat-pinned-bar__icon" aria-hidden="true"><IconPinnedBadge /></div>
            <div className="chat-pinned-bar__body">
              <div className="chat-pinned-bar__label">Pinned message</div>
              <div className="chat-pinned-bar__text">
                {activePinnedMessage.type === "text"
                  ? activePinnedMessage.text
                  : activePinnedMessage.fileName || activePinnedMessage.text || "Attachment"}
              </div>
            </div>
          </button>
          <button
            type="button"
            className="chat-pinned-bar__action"
            onClick={() => handlePinMessage(activePinnedMessage.id)}
          >
            <IconPin />
            <span>Unpin</span>
          </button>
        </div>
      )}

      {/* Inline search bar (opened from profile drawer) */}
      {showSearch && (
        <div className="ig-search-bar">
          <svg className="ig-search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input className="ig-search-bar__input" type="text" placeholder="Search in conversation\u2026" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
          {searchQuery && (
            <span className="ig-search-bar__count">
              {messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()) && !m.isDeletedForEveryone).length} result{messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()) && !m.isDeletedForEveryone).length !== 1 ? "s" : ""}
            </span>
          )}
          <button type="button" className="ig-search-bar__close" onClick={() => { setShowSearch(false); setSearchQuery(""); }} aria-label="Close search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Profile/info drawer */}
      {showProfile && createPortal(
        <>
          <div className="ig-profile-backdrop" onClick={() => setShowProfile(false)} />
          <div className="ig-profile-panel" role="dialog" aria-modal="true" aria-label="Chat info">
            <div className="ig-profile-panel__topbar">
              <button type="button" className="ig-profile-panel__close" onClick={() => setShowProfile(false)} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <span className="ig-profile-panel__topbar-title">Details</span>
            </div>
            <div className="ig-profile-panel__hero">
              <div className="ig-profile-panel__avatar-ring">
                <div className="ig-profile-panel__avatar">
                  {isBotChat ? <ConvoxLogo /> : chat?.avatarUrl ? <img src={chat.avatarUrl} alt={chat?.name} className="ig-profile-panel__avatar-img" /> : <span>{chat?.initials ?? "?"}</span>}
                </div>
              </div>
              <h2 className="ig-profile-panel__name">{chat?.name ?? "Conversation"}</h2>
              <p className={`ig-profile-panel__sub ${chat?.status === "online" ? "ig-profile-panel__sub--online" : "ig-profile-panel__sub--offline"}`}>{directChatStatusText}</p>
              <div className="ig-profile-panel__quick-actions">
                <button type="button" className="ig-profile-panel__quick-btn" onClick={() => { setShowProfile(false); setShowUserModal(true); }}>
                  <span className="ig-profile-panel__quick-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                  <span>Profile</span>
                </button>
                <button type="button" className="ig-profile-panel__quick-btn" onClick={() => { setShowProfile(false); setShowSearch(true); setSearchQuery(""); }}>
                  <span className="ig-profile-panel__quick-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></span>
                  <span>Search</span>
                </button>
              </div>
            </div>
            <div className="ig-profile-panel__sections">
              {chat?.bio && (
                <div className="ig-profile-panel__section">
                  <div className="ig-profile-panel__row">
                    <span className="ig-profile-panel__row-label">Bio</span>
                    <span className="ig-profile-panel__row-value">{chat.bio}</span>
                  </div>
                </div>
              )}
              {isDirectChat && !isBotChat && (
                <div className="ig-profile-panel__section ig-profile-panel__section--danger">
                  <button type="button" className="ig-profile-panel__action-row ig-profile-panel__action-row--remove" onClick={() => { setShowProfile(false); setPendingAction("remove"); setDeleteChatOnAction(false); }}>
                    <span className="ig-profile-panel__action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span>
                    Remove Friend
                  </button>
                  <button type="button" className="ig-profile-panel__action-row ig-profile-panel__action-row--block" onClick={() => { setShowProfile(false); setPendingAction("block"); setDeleteChatOnAction(false); }}>
                    <span className="ig-profile-panel__action-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></span>
                    Block User
                  </button>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      <GroupInfoPanel
        open={showGroupInfo}
        chat={chat}
        currentUserId={currentUserId}
        onClose={() => setShowGroupInfo(false)}
        onGroupUpdated={(updatedChat) => {
          setShowGroupInfo(false);
          onGroupUpdated?.(updatedChat);
        }}
        onGroupLeft={(chatId) => {
          setShowGroupInfo(false);
          onGroupLeft?.(chatId);
        }}
        onGroupDeleted={(chatId) => {
          setShowGroupInfo(false);
          onGroupDeleted?.(chatId);
        }}
      />

      {selectMode && (
        <div className="select-toolbar">
          <button
            type="button"
            className="sel-btn sel-btn--close"
            onClick={() => { setSelectMode(false); setSelectedMessageIds([]); }}
            aria-label="Close selection mode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <div className="sel-summary">
            <div className="sel-count">{selectedMessageIds.length === 1 ? "1 selected" : `${selectedMessageIds.length} selected`}</div>
          </div>
          <div className="sel-actions">
            <button
              type="button"
              className="sel-btn sel-btn--action sel-btn--icon sel-btn--reply"
              onClick={() => selectedSingleMessage && handleReplyMessage(selectedSingleMessage.id)}
              disabled={!selectedSingleMessage || selectedSingleMessage.isDeletedForEveryone}
              aria-label="Reply to selected message"
              title="Reply"
            >
              <IconReply />
            </button>
            <button type="button" className="sel-btn sel-btn--action sel-btn--icon sel-btn--forward" onClick={() => openForwardModal(selectedMessageIds)} disabled={!selectedForwardableIds.length} aria-label="Forward selected messages" title="Forward">
              <IconForward />
            </button>
            <button type="button" className="sel-btn sel-btn--action sel-btn--icon sel-btn--delete-me" onClick={handleBulkDeleteForMe} disabled={!selectedMessageIds.length} aria-label="Delete selected messages for me" title="Delete for me">
              <IconTrash />
            </button>
            <button type="button" className="sel-btn sel-btn--action sel-btn--danger sel-btn--icon" onClick={handleBulkDeleteForEveryone} disabled={!selectedMineRemoteIds.length} aria-label="Delete selected messages for everyone" title="Delete for everyone">
              <IconTrash />
            </button>
          </div>
        </div>
      )}

      {actionError && <div className="chat-window__banner chat-window__banner--error">{actionError}</div>}

      <div className="messages-area" onScroll={handleScroll} ref={messagesAreaRef}>
        {loadingMessages && <div className="chat-window__status">Loading messages...</div>}
        {!loadingMessages && loadingOlderMessages && (
          <div className="chat-window__status">Loading older messages...</div>
        )}
        {!loadingMessages && messageError && <div className="chat-window__status">{messageError}</div>}
        {!loadingMessages && !messageError && messages.length === 0 && <div className="chat-window__status">No messages yet. Start the conversation.</div>}
        {!loadingMessages && !messageError && showSearch && searchQuery && messages.filter(m => m.text.toLowerCase().includes(searchQuery.toLowerCase()) && !m.isDeletedForEveryone).length === 0 && (
          <div className="chat-window__status">No messages found for "{searchQuery}"</div>
        )}
        {!loadingMessages && !messageError && items
          .filter(item => {
            if (!showSearch || !searchQuery) return true;
            if (item.type === "divider") return false;
            // Call log bubbles have no text — exclude from search results
            if (item.message.type === "call_log") return false;
            return item.message.text.toLowerCase().includes(searchQuery.toLowerCase()) && !item.message.isDeletedForEveryone;
          })
          .map((item) => item.type === "divider" ? (
          <DateDivider key={item.id} label={item.label} />
        ) : item.message.type === "call_log" ? (
          <CallLogBubble key={item.id} message={item.message} />
        ) : editingMessageId === item.message.id ? (
          <div key={item.id} className="message-edit-box">
            <textarea className="message-edit-box__field" value={editingText} onChange={(e) => setEditingText(e.target.value)} />
            <div className="message-edit-box__actions">
              <button type="button" className="relationship-modal__cancel" onClick={() => { setEditingMessageId(""); setEditingText(""); }}>Cancel</button>
              <button type="button" className="relationship-modal__confirm" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        ) : (
          <MessageRow
            key={item.id}
            message={item.message}
            isGroupChat={chat?.isGroupChat}
            isLocalOnly={isLocalOnlyMessage(item.message.id)}
            currentUserId={currentUserId}
            selectMode={selectMode}
            selected={selectedMessageIds.includes(item.message.id)}
            openMenuId={openMessageMenu.id}
            openMenuPosition={openMessageMenu}
            activeReactionId={activeReactionMessageId}
            onToggleSelect={toggleSelectedMessage}
            onOpenMenu={(messageId, position) => {
              const nextPosition = clampMenuPosition(position);
              setOpenMessageMenu({ id: messageId, ...nextPosition });
              setActiveReactionMessageId("");
            }}
            onSetActiveReaction={setActiveReactionMessageId}
            onReact={handleReact}
            onOpenReactionDetails={handleOpenReactionDetails}
            onReply={handleReplyMessage}
            onCopy={handleCopyMessage}
            onDeleteForMe={handleDeleteForMe}
            onDeleteForEveryone={handleDeleteForEveryone}
            onPinMessage={handlePinMessage}
            onForward={openForwardModal}
            onJumpToMessage={jumpToMessage}
            onCloseOverlays={closeFloatingLayers}
            onOpenImage={openLightboxImage}
            rowRef={(node) => registerMessageNode(item.message.id, node)}
            highlighted={jumpedMessageId === item.message.id}
            onLongPressStart={handleLongPressStart}
            onLongPressCancel={handleLongPressCancel}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {isBotChat && assistantTyping && (
        <div className="assistant-typing">
          <span className="assistant-typing__dot" />
          <span className="assistant-typing__dot" />
          <span className="assistant-typing__dot" />
          <span className="assistant-typing__label">Convox Assistant is typing</span>
        </div>
      )}

      {!assistantStatus.limitReached && !smartRepliesDismissed && (
        <SmartReplies
          replies={smartReplies}
          loading={loadingSmartReplies}
          onSelect={(reply) => {
            handleSend(reply);
            setSmartRepliesDismissed(true);
          }}
          onDismiss={() => setSmartRepliesDismissed(true)}
        />
      )}

      {isBotChat && assistantStatus.warnUser && !assistantStatus.limitReached && (
        <div className="assistant-limit-warn">
          Only <strong>1 message</strong> left for today. Your quota refreshes
          in 24 hours.
        </div>
      )}

      {isBotChat && assistantStatus.limitReached && (
        <div className="assistant-quota-reached">
          <span className="assistant-quota-reached__icon">🚫</span>
          <div className="assistant-quota-reached__body">
            <p className="assistant-quota-reached__title">Daily quota reached</p>
            <p className="assistant-quota-reached__sub">
              You've used all <strong>10 messages</strong> for today.
              {countdown
                ? (
                  <>
                    {" "}
                    Quota refreshes in <strong>{countdown}</strong>.
                  </>
                )
                : " Your quota will refresh 24 hours after your first message in this window."}
            </p>
          </div>
        </div>
      )}

      <MessageInput
        onSend={handleSend}
        onMediaSent={handleMediaMessageSent}
        onVoiceSend={handleVoiceMessageSent}
        replyTo={replyDraft}
        onCancelReply={() => setReplyDraft(null)}
        isSending={isSending}
        disabled={chat?.canMessage === false || (isBotChat && assistantStatus.limitReached)}
        disabledMessage={
          isBotChat && assistantStatus.limitReached
            ? `Daily limit reached · Refreshes in ${countdown || "24h"}`
            : chat?.canMessage === false
              ? chat?.restrictionReason
              : ""
        }
        chatId={chat?.id || ""}
        isBotChat={isBotChat}
      />

      {activeLightboxImage && createPortal(
        <div className="media-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
          <button
            type="button"
            className="media-lightbox__backdrop"
            aria-label="Close image preview"
            onClick={closeLightbox}
          />
          <div className="media-lightbox__content">
            <div className="media-lightbox__topbar">
              <div className="media-lightbox__meta">
                <span className="media-lightbox__name">{activeLightboxImage.fileName || "Image"}</span>
                {lightboxIndex >= 0 && imageMessages.length > 1 ? (
                  <span className="media-lightbox__count">
                    {lightboxIndex + 1} / {imageMessages.length}
                  </span>
                ) : null}
              </div>
              <div className="media-lightbox__actions">
                <a
                  href={activeLightboxImage.mediaUrl}
                  download={activeLightboxImage.fileName || true}
                  className="media-lightbox__action"
                >
                  Download
                </a>
                <a
                  href={activeLightboxImage.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="media-lightbox__action"
                >
                  Open original
                </a>
                <button type="button" className="media-lightbox__close" onClick={closeLightbox} aria-label="Close image preview">
                  x
                </button>
              </div>
            </div>
            <div
              className="media-lightbox__frame"
              onWheel={(event) => {
                event.preventDefault();
                setLightboxZoom((current) => {
                  const next =
                    event.deltaY < 0 ? current + 0.12 : current - 0.12;
                  return Math.min(3, Math.max(0.8, Number(next.toFixed(2))));
                });
              }}
            >
              {canShowPrevImage && (
                <button
                  type="button"
                  className="media-lightbox__nav media-lightbox__nav--prev"
                  onClick={showPrevImage}
                  aria-label="Previous image"
                >
                  ‹
                </button>
              )}
              <img
                src={activeLightboxImage.mediaUrl}
                alt={activeLightboxImage.fileName || "Shared image"}
                className="media-lightbox__image"
                style={{ transform: `scale(${lightboxZoom})` }}
              />
              {canShowNextImage && (
                <button
                  type="button"
                  className="media-lightbox__nav media-lightbox__nav--next"
                  onClick={showNextImage}
                  aria-label="Next image"
                >
                  ›
                </button>
              )}
            </div>
            <div className="media-lightbox__footer">
              <span className="media-lightbox__hint">Scroll to zoom</span>
              {lightboxZoom !== 1 ? (
                <button
                  type="button"
                  className="media-lightbox__link"
                  onClick={() => setLightboxZoom(1)}
                >
                  Reset zoom
                </button>
              ) : null}
            </div>
          </div>
        </div>,
        document.body,
      )}

      <Modal open={pendingAction === "remove"} title={`Remove ${chat?.name || "this friend"}?`} desc="This removes the friendship link. You can keep the chat, but messaging will stay locked until a new request is accepted." confirmLabel="Remove Friend" includeDelete deleteChat={deleteChatOnAction} onToggleDelete={setDeleteChatOnAction} onCancel={() => setPendingAction("")} onConfirm={handleRemoveFriend} loading={actionLoading === "remove"} note="Keeping the chat preserves history, but neither side can message until you become friends again." />
      <Modal open={pendingAction === "block"} title={`Block ${chat?.name || "this user"}?`} desc="Blocking cuts off future interaction. You can keep the chat visible or delete the history too." confirmLabel="Block User" confirmTone="danger" includeDelete deleteChat={deleteChatOnAction} onToggleDelete={setDeleteChatOnAction} onCancel={() => setPendingAction("")} onConfirm={handleBlockUser} loading={actionLoading === "block"} note="If you keep the chat, the history remains but messaging stays unavailable." />
      <Modal open={pendingAction === "clear-chat"} title="Clear this chat?" desc="This removes all messages in the current chat." confirmLabel="Clear Chat" confirmTone="danger" onCancel={() => setPendingAction("")} onConfirm={handleClearChat} loading={actionLoading === "clear"} note="This action clears the conversation history." />
      <Modal
        open={Boolean(pendingDelete)}
        title={
          pendingDelete?.type === "single-everyone"
            ? "Delete this message for everyone?"
            : pendingDelete?.type === "bulk-everyone"
              ? `Delete ${pendingDelete?.messageIds?.length || 0} messages for everyone?`
              : pendingDelete?.type === "bulk-me"
                ? `Delete ${pendingDelete?.messageIds?.length || 0} messages for you?`
                : "Delete this message for you?"
        }
        desc={
          pendingDelete?.type === "single-everyone" || pendingDelete?.type === "bulk-everyone"
            ? "This cannot be undone. Everyone in this chat will see that the message was deleted."
            : "This cannot be undone. The selected message will be removed only from your view."
        }
        confirmLabel={
          pendingDelete?.type === "single-everyone" || pendingDelete?.type === "bulk-everyone"
            ? "Delete for Everyone"
            : "Delete for Me"
        }
        confirmTone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        loading={actionLoading === "delete"}
        note={
          pendingDelete?.type === "single-everyone" || pendingDelete?.type === "bulk-everyone"
            ? "The message bubble stays in the timeline as a deleted placeholder."
            : "Other people in the chat will still be able to see these messages."
        }
      />
      <Modal
        open={pendingAction === "forward"}
        title="Forward Messages"
        desc="Choose one or more chats to forward the selected messages."
        confirmLabel="Forward"
        onCancel={() => { setPendingAction(""); setSelectedForwardChatIds([]); }}
        onConfirm={handleForward}
        loading={actionLoading === "forward"}
        confirmDisabled={!selectedForwardChatIds.length || !forwardTargets.length}
        note={!forwardTargets.length ? "No chats are available to forward this message to." : ""}
      >
        <div className="forward-modal__list">
          {forwardTargets.length ? forwardTargets.map((entry) => (
            <label key={entry.id} className="forward-modal__item">
              <input type="checkbox" checked={selectedForwardChatIds.includes(entry.id)} onChange={() => setSelectedForwardChatIds((prev) => prev.includes(entry.id) ? prev.filter((id) => id !== entry.id) : [...prev, entry.id])} />
              <span className="forward-modal__avatar" aria-hidden="true">
                {entry.avatarUrl ? (
                  <img src={entry.avatarUrl} alt="" />
                ) : (
                  entry.initials
                )}
              </span>
              <span className="forward-modal__name">{entry.name}</span>
            </label>
          )) : (
            <div className="forward-modal__empty">No chats available</div>
          )}
        </div>
      </Modal>

      <ReactionDetailsSheet
        open={Boolean(reactionDetailsMessage)}
        message={reactionDetailsMessage}
        currentUserId={currentUserId}
        activeFilter={reactionDetails.filter}
        position={reactionDetails.position}
        onChangeFilter={(filter) => setReactionDetails((prev) => ({ ...prev, filter }))}
        onToggleReaction={handleReact}
        onClose={closeReactionDetails}
      />

      {showAskModal && createPortal(
        <>
          <div
            className="profile-modal__backdrop"
            onClick={() => {
              setShowAskModal(false);
              setAskResult(null);
              setAskQuery("");
            }}
          />
          <div className="profile-modal-wrapper" role="dialog" aria-modal="true">
            <div className="cx-overlay-shell profile-modal" style={{ width: "min(92vw, 480px)", flexShrink: 0 }}>
              <div className="profile-modal__header">
                <div>
                  <h3 className="profile-modal__title">Ask AI about this chat</h3>
                </div>
                <button
                  type="button"
                  className="profile-modal__close"
                  onClick={() => {
                    setShowAskModal(false);
                    setAskResult(null);
                    setAskQuery("");
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="profile-modal__form">
                <input
                  type="text"
                  className="profile-modal__input"
                  value={askQuery}
                  onChange={(e) => setAskQuery(e.target.value)}
                  placeholder="What do you want to know?"
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && askQuery.trim() && !isAsking) {
                      setIsAsking(true);
                      setAskResult(null);
                      const answer = await askAboutChat(chat?.id, askQuery);
                      setAskResult(answer || "I couldn't find an answer to that right now.");
                      setIsAsking(false);
                    }
                  }}
                />
                
                {isAsking && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#6b7280", fontSize: "14px", marginTop: "8px" }}>
                    <div className="assistant-typing" style={{ margin: 0 }}>
                      <span className="assistant-typing__dot" />
                      <span className="assistant-typing__dot" />
                      <span className="assistant-typing__dot" />
                    </div>
                    Thinking...
                  </div>
                )}
                
                {askResult && !isAsking && (
                  <div className="profile-modal__input profile-modal__input--readonly" style={{ marginTop: "12px", minHeight: "80px", whiteSpace: "pre-wrap" }}>
                    {askResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {showSummaryModal && createPortal(
        <>
          <div
            className="profile-modal__backdrop"
            onClick={() => {
              setShowSummaryModal(false);
              clearSummary();
            }}
          />
          <div className="profile-modal-wrapper" role="dialog" aria-modal="true">
            <div className="cx-overlay-shell profile-modal" style={{ width: "min(92vw, 480px)", flexShrink: 0 }}>
              <div className="profile-modal__header">
                <div>
                  <h3 className="profile-modal__title">Chat Summary</h3>
                  <p className="profile-modal__subtitle">AI-generated overview of recent messages</p>
                </div>
                <button
                  type="button"
                  className="profile-modal__close"
                  onClick={() => {
                    setShowSummaryModal(false);
                    clearSummary();
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="profile-modal__form">
                {loadingSummary ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#6b7280", fontSize: "14px", minHeight: "80px" }}>
                    <div className="assistant-typing" style={{ margin: 0 }}>
                      <span className="assistant-typing__dot" />
                      <span className="assistant-typing__dot" />
                      <span className="assistant-typing__dot" />
                    </div>
                    Generating summary...
                  </div>
                ) : (
                  <div className="profile-modal__input profile-modal__input--readonly" style={{ minHeight: "80px", whiteSpace: "pre-wrap" }}>
                    {summary}
                  </div>
                )}
              </div>
              <div className="profile-modal__actions" style={{ padding: "0 24px 20px" }}>
                <button
                  type="button"
                  className="profile-modal__ghost-btn"
                  onClick={() => {
                    setShowSummaryModal(false);
                    clearSummary();
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {showUserModal && createPortal(
        <>
          <div className="profile-modal__backdrop" onClick={() => setShowUserModal(false)} />
          <div className="profile-modal-wrapper" role="dialog" aria-modal="true">
            <div className="profile-modal" style={{ width: "min(92vw, 420px)", flexShrink: 0 }}>
              <div className="profile-modal__header">
                <div>
                  <h2 className="profile-modal__title">Profile Info</h2>
                </div>
                <button type="button" className="profile-modal__close" onClick={() => setShowUserModal(false)} aria-label="Close">✕</button>
              </div>
              
              <div className="profile-modal__form">
                <div className="profile-modal__avatar-row" style={{ justifyContent: "center", marginBottom: "8px" }}>
                  <div className="profile-modal__avatar" style={{ width: 100, height: 100 }}>
                    {chat?.avatarUrl ? <img src={chat.avatarUrl} alt={chat?.name} /> : <span>{chat?.initials ?? "?"}</span>}
                  </div>
                </div>
                
                <h3 style={{ margin: "0 0 16px", fontSize: '22px', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', textAlign: "center" }}>{chat?.name ?? "Conversation"}</h3>
                
                <label className="profile-modal__field">
                  <span className="profile-modal__label">Email</span>
                  <div className="profile-modal__input profile-modal__input--readonly">
                    {chat?.email || chat?.users?.find(u => String(u._id) !== String(currentUserId))?.email || chat?.otherUserEmail || "No email available"}
                  </div>
                </label>

                <label className="profile-modal__field">
                  <span className="profile-modal__label">Bio</span>
                  <div className="profile-modal__textarea profile-modal__input--readonly">
                    {chat?.bio || chat?.users?.find(u => String(u._id) !== String(currentUserId))?.bio || "No bio added."}
                  </div>
                </label>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Mobile bottom sheet (long-press context menu, Option B) ── */}
      {mobileSheet.open && mobileSheet.message && createPortal(
        <>
          <button
            type="button"
            className="msg-sheet-backdrop"
            aria-label="Close menu"
            onClick={closeMobileSheet}
          />
          <div className="msg-sheet" role="dialog" aria-modal="true" aria-label="Message options">
            <div className="msg-sheet__card">
              <div className="msg-sheet__handle" />

              {/* Message preview */}
              {!mobileSheet.message.isDeletedForEveryone && mobileSheet.message.text && (
                <div className="msg-sheet__preview">{mobileSheet.message.text}</div>
              )}

              {/* Quick reactions */}
              {!mobileSheet.message.isDeletedForEveryone && (
                <div className="msg-sheet__reactions">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button key={emoji} type="button" className="msg-sheet__react-btn"
                      onClick={() => { handleReact(mobileSheet.message.id, emoji); closeMobileSheet(); }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Action items */}
              {!mobileSheet.message.isDeletedForEveryone && (
                <button type="button" className="msg-sheet__item"
                  onClick={() => { handleReplyMessage(mobileSheet.message.id); closeMobileSheet(); }}>
                  <span className="msg-sheet__item__icon"><IconReply /></span>
                  <span>Reply</span>
                </button>
              )}
              {!mobileSheet.message.isDeletedForEveryone && mobileSheet.message.text && (
                <button type="button" className="msg-sheet__item"
                  onClick={() => { handleCopyMessage(mobileSheet.message.id); closeMobileSheet(); }}>
                  <span className="msg-sheet__item__icon"><IconCopy /></span>
                  <span>Copy</span>
                </button>
              )}
              {!mobileSheet.message.isDeletedForEveryone && !isLocalOnlyMessage(mobileSheet.message.id) && (
                <button type="button" className="msg-sheet__item"
                  onClick={() => { handlePinMessage(mobileSheet.message.id); closeMobileSheet(); }}>
                  <span className="msg-sheet__item__icon"><IconPin /></span>
                  <span>{mobileSheet.message.isPinned ? "Remove pin" : "Pin message"}</span>
                </button>
              )}
              {!mobileSheet.message.isDeletedForEveryone && !isLocalOnlyMessage(mobileSheet.message.id) && (
                <button type="button" className="msg-sheet__item"
                  onClick={() => { openForwardModal([mobileSheet.message.id]); closeMobileSheet(); }}>
                  <span className="msg-sheet__item__icon"><IconForward /></span>
                  <span>Forward</span>
                </button>
              )}
              <button type="button" className="msg-sheet__item"
                onClick={() => { toggleSelectedMessage(mobileSheet.message.id); closeMobileSheet(); }}>
                <span className="msg-sheet__item__icon"><IconSelect /></span>
                <span>Select</span>
              </button>

              <div className="msg-sheet__divider" />

              <button type="button" className="msg-sheet__item"
                onClick={() => { handleDeleteForMe(mobileSheet.message.id); closeMobileSheet(); }}>
                <span className="msg-sheet__item__icon"><IconTrash /></span>
                <span>Delete for me</span>
              </button>
              {mobileSheet.message.isMine && !mobileSheet.message.isDeletedForEveryone && !isLocalOnlyMessage(mobileSheet.message.id) && (
                <button type="button" className="msg-sheet__item msg-sheet__item--danger"
                  onClick={() => { handleDeleteForEveryone(mobileSheet.message.id); closeMobileSheet(); }}>
                  <span className="msg-sheet__item__icon"><IconTrash /></span>
                  <span>Delete for everyone</span>
                </button>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}

    </div>
  );
}
