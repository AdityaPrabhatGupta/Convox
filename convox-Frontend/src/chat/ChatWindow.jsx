import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import "./ChatWindow.css";
import MessageInput from "../input/MessageInput";
import { clearNotification } from "../services/notificationStore.js";
import {
  joinChat,
  leaveCurrentChat,
  subscribeToMessages,
  sendMessage as emitSocketMessage,
} from "../services/socket.js";
import {
  fetchMessages as fetchMessagesApi,
  sendMessage as sendMessageApi,
} from "../services/messageService.js";

function formatMessage(message, currentUserId) {
  const senderId = String(message.sender?._id || message.senderId || "");
  const senderName = message.sender?.name || message.senderName || "Unknown";

  return {
    id: String(message._id || message.id),
    senderId,
    senderName,
    senderInitials: senderName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    text: message.content || message.text || "",
    time: new Date(message.createdAt || message.sentAt || Date.now()).toLocaleTimeString(
      "en-US",
      {
        hour: "2-digit",
        minute: "2-digit",
      },
    ),
    sentAt: new Date(message.createdAt || message.sentAt || Date.now()).getTime(),
    isMine: senderId === String(currentUserId),
    isPending: Boolean(message.isPending),
    hasError: Boolean(message.hasError),
    rawMessage: message,
  };
}

function buildSocketMessage(savedMessage) {
  return {
    _id: savedMessage._id,
    content: savedMessage.content,
    createdAt: savedMessage.createdAt,
    chatId: savedMessage.chat?._id || savedMessage.chat,
    chat: savedMessage.chat,
    senderId: savedMessage.sender?._id,
    senderName: savedMessage.sender?.name,
    sender: savedMessage.sender,
    participantIds: Array.isArray(savedMessage.chat?.users)
      ? savedMessage.chat.users.map((user) => String(user._id || user))
      : [],
  };
}

function DateDivider({ label }) {
  return (
    <div className="date-divider">
      <span className="date-divider__text">{label}</span>
    </div>
  );
}

function formatDateDividerLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === today.getFullYear()
        ? undefined
        : "numeric",
  });
}

function buildMessageTimeline(messages) {
  const items = [];
  let lastDateKey = null;

  messages.forEach((message) => {
    const date = new Date(message.sentAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (dateKey !== lastDateKey) {
      items.push({
        type: "divider",
        id: `divider-${dateKey}`,
        label: formatDateDividerLabel(message.sentAt),
      });
      lastDateKey = dateKey;
    }

    items.push({
      type: "message",
      id: message.id,
      message,
    });
  });

  return items;
}

function MessageRow({ message }) {
  const isMine = message.isMine;

  return (
    <div className={`msg-row ${isMine ? "msg-row--mine" : ""}`}>
      {!isMine && <div className="msg-avatar">{message.senderInitials}</div>}

      <div className={`msg-group ${isMine ? "msg-group--mine" : "msg-group--other"}`}>
        {!isMine && <div className="msg-sender">{message.senderName}</div>}

        <div
          className={[
            "msg-bubble",
            isMine ? "msg-bubble--mine" : "msg-bubble--other",
            message.isPending ? "msg-bubble--pending" : "",
            message.hasError ? "msg-bubble--error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="msg-bubble__text">{message.text}</span>
        </div>

        <div className={`msg-meta ${isMine ? "msg-meta--mine" : ""}`}>
          <span className="msg-time">
            {message.hasError
              ? "Failed to send"
              : message.isPending
                ? "Sending..."
                : message.time}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ChatWindow({ chat, currentUserId, currentUserName, onMessageSent }) {
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [messageError, setMessageError] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef(null);

  // Fix: memoize timeline to avoid recalculating on every render
  const timelineItems = useMemo(() => buildMessageTimeline(messages), [messages]);

  useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      if (!chat?.id) return;

      try {
        setLoadingMessages(true);
        setMessageError("");

        const messagesFromApi = await fetchMessagesApi(chat.id);
        const formattedMessages = messagesFromApi.map((message) =>
          formatMessage(message, currentUserId),
        );

        if (!isActive) return;
        setMessages(formattedMessages);
      } catch (error) {
        if (!isActive) return;
        setMessageError(error.response?.data?.message || "Failed to load messages.");
      } finally {
        if (isActive) {
          setLoadingMessages(false);
        }
      }
    }

    loadMessages();

    return () => {
      isActive = false;
    };
  }, [chat?.id, currentUserId]);

  useEffect(() => {
    if (!chat?.id) return undefined;

    joinChat(chat.id);
    clearNotification(chat.id);

    const unsubscribe = subscribeToMessages((message) => {
      const inboundChatId = String(message.chatId ?? message.chat?._id ?? "");
      if (inboundChatId !== String(chat.id)) return;

      setMessages((previous) => {
        const incomingId = String(message._id ?? "");
        if (incomingId && previous.some((entry) => String(entry.id) === incomingId)) {
          return previous;
        }

        return [...previous, formatMessage(message, currentUserId)];
      });
    });

    return () => {
      unsubscribe();
      leaveCurrentChat();
    };
  }, [chat?.id, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingMessages]);

  const handleScroll = useCallback((event) => {
    setIsScrolled(event.target.scrollTop > 10);
  }, []);

  const handleSend = useCallback(
    async (text) => {
      if (!chat?.id || !text.trim()) return;

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = formatMessage(
        {
          id: tempId,
          senderId: currentUserId,
          // Fix: use the real user's name instead of the hardcoded "You"
          senderName: currentUserName || "You",
          text,
          sentAt: Date.now(),
          isPending: true,
        },
        currentUserId,
      );

      setMessages((previous) => [...previous, optimisticMessage]);
      setIsSending(true);

      try {
        const savedMessage = await sendMessageApi({
          chatId: chat.id,
          content: text,
        });

        const formattedSavedMessage = formatMessage(savedMessage, currentUserId);

        setMessages((previous) =>
          previous.map((message) =>
            message.id === tempId ? formattedSavedMessage : message,
          ),
        );

        onMessageSent?.(savedMessage);
        emitSocketMessage(buildSocketMessage(savedMessage));
      } catch {
        setMessages((previous) =>
          previous.map((message) =>
            message.id === tempId
              ? {
                  ...message,
                  isPending: false,
                  hasError: true,
                }
              : message,
          ),
        );
      } finally {
        setIsSending(false);
      }
    },
    [chat?.id, currentUserId, currentUserName, onMessageSent],
  );

  return (
    <div className="chat-window">
      <div className={`chat-header ${isScrolled ? "chat-header--scrolled" : ""}`}>
        <div className="chat-header__avatar">{chat?.initials ?? "ST"}</div>
        <div className="chat-header__info">
          <div className="chat-header__name">{chat?.name ?? "Conversation"}</div>
          <div className="chat-header__status">
            <span className="chat-header__status-dot" />
            {chat?.memberCount === 1 ? "1 member" : `${chat?.memberCount ?? 0} members`}
          </div>
        </div>
        <div className="chat-header__live-badge">
          <span className="live-dot" />
          Live
        </div>
      </div>

      <div className="messages-area" onScroll={handleScroll}>
        {loadingMessages && (
          <div className="chat-window__status">Loading messages...</div>
        )}

        {!loadingMessages && messageError && (
          <div className="chat-window__status">{messageError}</div>
        )}

        {!loadingMessages && !messageError && messages.length === 0 && (
          <div className="chat-window__status">No messages yet. Start the conversation.</div>
        )}

        {!loadingMessages &&
          !messageError &&
          timelineItems.map((item) =>
            item.type === "divider" ? (
              <DateDivider key={item.id} label={item.label} />
            ) : (
              <MessageRow key={item.id} message={item.message} />
            ),
          )}

        <div ref={bottomRef} />
      </div>

      <MessageInput onSend={handleSend} isSending={isSending} />
    </div>
  );
}