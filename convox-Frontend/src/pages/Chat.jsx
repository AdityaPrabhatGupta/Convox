import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, getCurrentUserId } from "../utils/auth";
import Sidebar from "../sidebar/Sidebar";
import ChatWindow from "../chat/ChatWindow";
import EmptyState from "../chat/EmptyState";
import { fetchChats as fetchChatsApi } from "../services/chatService.js";
import { fetchCurrentUserProfile } from "../services/userService.js";
import {
  subscribeToMessages,
  subscribeToNotifications,
} from "../services/socket.js";
import "./Chat.css";

function formatTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatChatForSidebar(chat, currentUserId) {
  const users = Array.isArray(chat.users) ? chat.users : [];
  const otherUsers = users.filter(
    (user) => String(user._id) !== String(currentUserId),
  );
  const isGroupChat = Boolean(chat.isGroupChat);
  const displayUser = otherUsers[0];
  const name = isGroupChat
    ? chat.groupName || "Group Chat"
    : displayUser?.name || "Unknown User";

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: chat._id,
    type: isGroupChat ? "group" : "direct",
    name,
    initials,
    avatarVariant: isGroupChat ? "group" : "primary",
    status: null,
    preview: chat.latestMessage?.content || "No messages yet",
    timestamp: formatTime(chat.latestMessage?.createdAt),
    unread: 0,
    memberCount: users.length,
    participantIds: users.map((user) => String(user._id)),
    users,
    latestMessage: chat.latestMessage || null,
    isGroupChat,
    rawChat: chat,
  };
}

function moveChatToTop(chats, chatId, updater) {
  const index = chats.findIndex((chat) => chat.id === String(chatId));
  if (index === -1) return chats;

  const nextChats = [...chats];
  const currentChat = nextChats[index];
  const updatedChat = updater(currentChat);
  nextChats.splice(index, 1);
  nextChats.unshift(updatedChat);
  return nextChats;
}

export default function Chat() {
  const currentUserId = getCurrentUserId() || "me";
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatError, setChatError] = useState("");
  const navigate = useNavigate();

  const syncChatPreview = useCallback((chatId, preview, timestamp) => {
    setChats((previous) =>
      moveChatToTop(previous, chatId, (chat) => ({
        ...chat,
        preview: preview || chat.preview,
        timestamp: formatTime(timestamp) || chat.timestamp,
      })),
    );

    setSelectedChat((previous) => {
      if (!previous || previous.id !== String(chatId)) return previous;

      return {
        ...previous,
        preview: preview || previous.preview,
        timestamp: formatTime(timestamp) || previous.timestamp,
      };
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      try {
        const profile = await fetchCurrentUserProfile();
        if (!isActive) return;
        setCurrentUser(profile);
      } catch {
        if (!isActive) return;
        setCurrentUser(null);
      }
    }

    async function loadChats() {
      try {
        setLoadingChats(true);
        setChatError("");

        const chatsFromApi = await fetchChatsApi();
        const formattedChats = chatsFromApi.map((chat) =>
          formatChatForSidebar(chat, currentUserId),
        );

        if (!isActive) return;

        setChats(formattedChats);
        setSelectedChat((previous) => {
          if (!previous) return formattedChats[0] || null;

          return (
            formattedChats.find((chat) => chat.id === previous.id) ||
            formattedChats[0] ||
            null
          );
        });
      } catch (error) {
        if (!isActive) return;
        setChatError(error.response?.data?.message || "Failed to load chats.");
      } finally {
        if (isActive) {
          setLoadingChats(false);
        }
      }
    }

    loadCurrentUser();
    loadChats();

    return () => {
      isActive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    const unsubscribeMessages = subscribeToMessages((message) => {
      const chatId = String(message.chatId ?? message.chat?._id ?? "");
      if (!chatId) return;

      syncChatPreview(chatId, message.content, message.createdAt);
    });

    const unsubscribeNotifications = subscribeToNotifications((notification) => {
      syncChatPreview(
        notification.chatId,
        `${notification.senderName}: ${notification.preview}`,
        notification.timestamp,
      );
    });

    return () => {
      unsubscribeMessages();
      unsubscribeNotifications();
    };
  }, [syncChatPreview]);

  const handleSelectChat = useCallback((chat) => {
    setSelectedChat(chat);
  }, []);

  const handleMessageSent = useCallback((savedMessage) => {
    const chatId = String(savedMessage.chat?._id ?? savedMessage.chat ?? "");
    if (!chatId) return;

    syncChatPreview(chatId, savedMessage.content, savedMessage.createdAt);
  }, [syncChatPreview]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loadingChats) {
    return <div className="chat-page chat-page__status">Loading chats...</div>;
  }

  if (chatError) {
    return <div className="chat-page chat-page__status">{chatError}</div>;
  }

  return (
    <div className="chat-page">
      <Sidebar
        chats={chats}
        currentUser={currentUser}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onLogout={handleLogout}
      />
      {selectedChat ? (
        <ChatWindow
          chat={selectedChat}
          currentUserId={currentUserId}
          currentUserName={currentUser?.name}
          onMessageSent={handleMessageSent}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}