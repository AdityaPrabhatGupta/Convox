import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { logout, getCurrentUserId, getCurrentUserName } from "../utils/auth";
import axiosInstance from "../services/axiosInstance.js";
import { Sidebar } from "../features/sidebar/index.js";
import { ChatWindow, EmptyState } from "../features/chat/index.js";
import {
  useCall,
  CALL_STATUS,
  IncomingCallPopup,
  VideoCallScreen,
} from "../features/call/index.js";
import { fetchChats as fetchChatsApi } from "../services/chatService.js";
import { fetchCurrentUserProfile } from "../services/userService.js";
import {
  subscribeToMessages,
  subscribeToNotifications,
  connectSocket,
  disconnectSocket,
  socket,
} from "../services/socket.js";
import "./Chat.css";

function formatTime(value) {
  if (!value) return "";

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLatestMessagePreview(message, currentUserId) {
  if (!message) {
    return {
      text: "No messages yet",
      kind: "default",
      emphasis: "neutral",
    };
  }

  if (message.type === "call_log") {
    const senderId = String(message.sender?._id || message.senderId || "");
    const isMine = senderId === String(currentUserId);
    const callType = message.callMeta?.callType || "audio";
    const outcome = message.callMeta?.outcome || "ended";
    const typeSuffix = callType === "video" ? " video" : "";
    const kind = callType === "video" ? "video-call" : "audio-call";

    if (outcome === "ended") {
      return {
        text: isMine ? `Outgoing${typeSuffix} call` : `Incoming${typeSuffix} call`,
        kind,
        emphasis: "success",
      };
    }
    if (outcome === "missed") {
      return {
        text: isMine ? `Call not answered${typeSuffix ? " (" + callType + ")" : ""}` : `Missed${typeSuffix} call`,
        kind,
        emphasis: "danger",
      };
    }
    if (outcome === "declined") {
      return {
        text: isMine ? `Call declined${typeSuffix ? " (" + callType + ")" : ""}` : `Declined${typeSuffix} call`,
        kind,
        emphasis: "danger",
      };
    }

    return {
      text: `${callType === "video" ? "Video" : "Voice"} call`,
      kind,
      emphasis: "neutral",
    };
  }

  if (message.type && message.type !== "text") {
    const mediaPreviewText = {
      image: "Sent an image",
      video: "Sent a video",
      audio: "Sent an audio clip",
      file: "Sent a file",
    };

    return {
      text: mediaPreviewText[message.type] || "Sent an attachment",
      kind: "attachment",
      emphasis: "neutral",
    };
  }

  return {
    text: message.content || message.text || "No messages yet",
    kind: "default",
    emphasis: "neutral",
  };
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
  const isBotChat = Boolean(chat.isBotChat) || Boolean(displayUser?.isBot);

  const latestPreview = formatLatestMessagePreview(chat.latestMessage, currentUserId);

  return {
    id: chat._id,
    type: isGroupChat ? "group" : "direct",
    name,
    initials,
    avatarVariant: isGroupChat ? "group" : "primary",
    status: null,
    preview: latestPreview.text,
    previewKind: latestPreview.kind,
    previewEmphasis: latestPreview.emphasis,
    timestamp: formatTime(chat.latestMessage?.createdAt),
    unread: 0,
    memberCount: users.length,
    avatarUrl: displayUser?.profilePic || null,
    bio: isGroupChat ? "" : displayUser?.bio || "",
    email: isGroupChat ? "" : displayUser?.email || "",
    lastSeen: isGroupChat ? null : displayUser?.lastSeen || null,
    lastActivityAt: chat.latestMessage?.createdAt || null,
    otherUserId: isGroupChat ? null : displayUser?._id || null,
    canMessage: chat.canMessage ?? true,
    restrictionReason: chat.restrictionReason || "",
    participantIds: users.map((user) => String(user._id)),
    users,
    groupAdmin: chat.groupAdmin || null,
    latestMessage: chat.latestMessage || null,
    isGroupChat,
    isBotChat,
    rawChat: chat,
  };
}

function applyPresenceToChat(chat, onlineUserIds) {
  if (chat?.isBotChat) {
    return {
      ...chat,
      status: "online",
    };
  }

  if (!chat || chat.isGroupChat || !chat.otherUserId) {
    return {
      ...chat,
      status: chat?.isGroupChat ? null : chat?.status ?? "offline",
    };
  }

  return {
    ...chat,
    status: onlineUserIds.has(String(chat.otherUserId)) ? "online" : "offline",
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

function ConfirmDialog({ open, title, description, confirmLabel, onCancel, onConfirm }) {
  if (!open) return null;

  return createPortal(
    <>
      <div className="cx-overlay-backdrop relationship-modal__backdrop" onClick={onCancel} />
      <div className="cx-overlay-shell action-dialog-shell" role="dialog" aria-modal="true">
        <div className="rb__drawer rb__drawer--centered action-dialog">
          <div className="action-dialog__header">
            <div>
              <h3 className="action-dialog__title">{title}</h3>
              <p className="action-dialog__description">{description}</p>
            </div>
            <button type="button" className="action-dialog__close" onClick={onCancel} aria-label="Close dialog">x</button>
          </div>
          <div className="action-dialog__actions">
            <button type="button" className="action-dialog__cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="action-dialog__confirm action-dialog__confirm--danger" onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default function Chat() {
  const currentUserId = getCurrentUserId() || "me";
  const [socketStatus, setSocketStatus] = useState(() =>
    socket.connected ? "connected" : "connecting",
  );
  const [selectedChat, setSelectedChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [loadingChats, setLoadingChats] = useState(true);
  const [chatError, setChatError] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // Mobile: true = sidebar visible (drawer open), false = chat visible
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);
  const navigate = useNavigate();
  const onlineUserIdsRef = useRef(onlineUserIds);
  const resolvedCurrentUserName = currentUser?.name || getCurrentUserName() || "Me";
  const {
    callStatus,
    callType,
    remoteUser,
    incomingCallData,
    callError,
    isMuted,
    isVideoOff,
    callDuration,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  } = useCall({
    currentUserId,
    currentUserName: resolvedCurrentUserName,
  });

  const showIncomingPopup =
    callStatus === CALL_STATUS.RINGING && Boolean(incomingCallData);
  const showCallScreen =
    callStatus !== CALL_STATUS.IDLE && callStatus !== CALL_STATUS.RINGING;

  useEffect(() => {
    onlineUserIdsRef.current = onlineUserIds;
  }, [onlineUserIds]);

  const upsertChat = useCallback((chatFromApi, options = {}) => {
    if (!chatFromApi?._id) return;

    const formattedChat = applyPresenceToChat(
      formatChatForSidebar(chatFromApi, currentUserId),
      onlineUserIdsRef.current,
    );

    setChats((previous) => {
      const withoutCurrent = previous.filter(
        (chat) => chat.id !== formattedChat.id,
      );

      return [formattedChat, ...withoutCurrent];
    });

    if (options.select) {
      setSelectedChat(formattedChat);
    } else {
      setSelectedChat((previous) =>
        previous?.id === formattedChat.id ? formattedChat : previous,
      );
    }
  }, [currentUserId]);

  const syncChatPreview = useCallback((chatId, preview, timestamp) => {
    setChats((previous) =>
      moveChatToTop(previous, chatId, (chat) => ({
        ...chat,
        preview: preview ?? chat.preview,
        timestamp: timestamp === null ? "" : formatTime(timestamp) || chat.timestamp,
        lastActivityAt: timestamp ?? chat.lastActivityAt,
      })),
    );

    setSelectedChat((previous) => {
      if (!previous || previous.id !== String(chatId)) return previous;

      return {
        ...previous,
        preview: preview ?? previous.preview,
        timestamp: timestamp === null ? "" : formatTime(timestamp) || previous.timestamp,
        lastActivityAt: timestamp ?? previous.lastActivityAt,
      };
    });
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser() {
      try {
        if (isActive) {
          setCurrentUser(null);
        }
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
          applyPresenceToChat(formatChatForSidebar(chat, currentUserId), onlineUserIdsRef.current),
        );

        if (!isActive) return;

        setChats(formattedChats);
        setSelectedChat((previous) => {
          if (!previous) return null;

          return (
            formattedChats.find((chat) => chat.id === previous.id) ||
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

    connectSocket();
    loadCurrentUser();
    loadChats();

    return () => {
      isActive = false;
    };
  }, [currentUserId]);

  useEffect(() => {
    setChats((previous) =>
      previous.map((chat) => applyPresenceToChat(chat, onlineUserIds)),
    );
    setSelectedChat((previous) =>
      previous ? applyPresenceToChat(previous, onlineUserIds) : previous,
    );
  }, [onlineUserIds]);

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

  useEffect(() => {
    const handleSocketConnect = () => {
      setSocketStatus("connected");
    };

    const handleSocketConnectError = () => {
      setSocketStatus("offline");
    };

    const handleSocketDisconnect = () => {
      setSocketStatus("offline");
    };

    const handleSocketReconnectAttempt = () => {
      setSocketStatus("connecting");
    };

    socket.on("connect", handleSocketConnect);
    socket.on("connect_error", handleSocketConnectError);
    socket.on("disconnect", handleSocketDisconnect);
    socket.io.on("reconnect_attempt", handleSocketReconnectAttempt);

    return () => {
      socket.off("connect", handleSocketConnect);
      socket.off("connect_error", handleSocketConnectError);
      socket.off("disconnect", handleSocketDisconnect);
      socket.io.off("reconnect_attempt", handleSocketReconnectAttempt);
    };
  }, []);

  useEffect(() => {
    const handleRequestAccepted = ({ chat }) => {
      upsertChat(chat);
    };

    socket.on("request_accepted", handleRequestAccepted);
    socket.on("chatRequestAccepted", handleRequestAccepted);

    return () => {
      socket.off("request_accepted", handleRequestAccepted);
      socket.off("chatRequestAccepted", handleRequestAccepted);
    };
  }, [upsertChat]);

  useEffect(() => {
    const handleOnlineUsers = (userIds = []) => {
      setOnlineUserIds(new Set((Array.isArray(userIds) ? userIds : []).map(String)));
    };

    const handleUserOnline = (userId) => {
      if (!userId) return;
      setOnlineUserIds((previous) => {
        const next = new Set(previous);
        next.add(String(userId));
        return next;
      });
      setChats((previous) =>
        previous.map((chat) => (
          String(chat.otherUserId) === String(userId)
            ? { ...chat, status: "online" }
            : chat
        )),
      );
      setSelectedChat((previous) => (
        String(previous?.otherUserId) === String(userId)
          ? { ...previous, status: "online" }
          : previous
      ));
    };

    const handleUserOffline = (userId) => {
      if (!userId) return;
      const lastSeen = new Date().toISOString();
      setOnlineUserIds((previous) => {
        const next = new Set(previous);
        next.delete(String(userId));
        return next;
      });
      setChats((previous) =>
        previous.map((chat) => (
          String(chat.otherUserId) === String(userId)
            ? { ...chat, status: "offline", lastSeen }
            : chat
        )),
      );
      setSelectedChat((previous) => (
        String(previous?.otherUserId) === String(userId)
          ? { ...previous, status: "offline", lastSeen }
          : previous
      ));
    };

    socket.on("onlineUsers", handleOnlineUsers);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);

    return () => {
      socket.off("onlineUsers", handleOnlineUsers);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
    };
  }, []);

  const handleSelectChat = useCallback((chat) => {
    if (!chat?.id) return;

    setSelectedChat((previous) => {
      if (previous?.id === chat.id) return previous;
      return chat;
    });
    // On mobile: hide sidebar, show chat
    setShowMobileSidebar(false);
  }, []);

  const handleMessageSent = useCallback((savedMessage) => {
    const chatId = String(savedMessage.chat?._id ?? savedMessage.chat ?? "");
    if (!chatId) return;

    syncChatPreview(chatId, savedMessage.content, savedMessage.createdAt);
  }, [syncChatPreview]);

  const handleChatPreviewChanged = useCallback((chatId, preview, timestamp = null) => {
    if (!chatId) return;
    syncChatPreview(chatId, preview, timestamp);
  }, [syncChatPreview]);

  const handleLogout = useCallback(() => {
    setShowLogoutConfirm(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    try {
      await axiosInstance.post("/api/users/logout");
    } catch {
      // Best-effort logout. Local sign-out still proceeds.
    }

    disconnectSocket();
    logout();
    navigate("/login");
  }, [navigate]);

  const handleAcceptedChat = useCallback((chat) => {
    upsertChat(chat, { select: true });
  }, [upsertChat]);

  const handleProfileUpdated = useCallback((profile) => {
    setCurrentUser(profile);
  }, []);

  const handleGroupCreated = useCallback((rawChat) => {
    upsertChat(rawChat, { select: true });
  }, [upsertChat]);

  const handleGroupUpdated = useCallback((rawChat) => {
    if (!rawChat?._id) return;
    upsertChat(rawChat);
  }, [upsertChat]);

  const handleGroupLeft = useCallback((chatId) => {
    setChats((previous) =>
      previous.filter((chat) => chat.id !== String(chatId)),
    );
    setSelectedChat((previous) =>
      previous?.id === String(chatId) ? null : previous,
    );
  }, []);

  const handleGroupDeleted = useCallback((chatId) => {
    setChats((previous) =>
      previous.filter((chat) => chat.id !== String(chatId)),
    );
    setSelectedChat((previous) =>
      previous?.id === String(chatId) ? null : previous,
    );
  }, []);

  const handleChatRemoved = useCallback((chatId, nextState = {}) => {
    setChats((previous) => {
      const shouldDelete = Boolean(nextState.deleteChat);
      const nextChats = shouldDelete
        ? previous.filter((chat) => chat.id !== String(chatId))
        : previous.map((chat) => (
            chat.id === String(chatId)
              ? {
                  ...chat,
                  canMessage: false,
                  restrictionReason: nextState.restrictionReason || chat.restrictionReason,
                }
              : chat
          ));

      setSelectedChat((currentSelected) => {
        if (currentSelected?.id !== String(chatId)) return currentSelected;
        if (shouldDelete) return nextChats[0] || null;

        return {
          ...currentSelected,
          canMessage: false,
          restrictionReason: nextState.restrictionReason || currentSelected.restrictionReason,
        };
      });

      return nextChats;
    });
  }, []);

  const handleVideoCall = useCallback(({ targetUserId, targetUserName }) => {
    if (!targetUserId) return;
    startCall({
      targetUserId,
      targetUserName,
      type: "video",
    });
    setShowMobileSidebar(false);
  }, [startCall]);

  const handleAudioCall = useCallback(({ targetUserId, targetUserName }) => {
    if (!targetUserId) return;
    startCall({
      targetUserId,
      targetUserName,
      type: "audio",
    });
    setShowMobileSidebar(false);
  }, [startCall]);

  useEffect(() => {
    const handleGroupUpdatedSocket = ({ chatId, event, removedId }) => {
      if (event === "memberRemoved" && String(removedId) === String(currentUserId)) {
        handleGroupLeft(chatId);
        return;
      }

      fetchChatsApi()
        .then((freshChats) => {
          const match = freshChats.find(
            (chat) => String(chat._id) === String(chatId),
          );
          if (match) handleGroupUpdated(match);
          else handleGroupLeft(chatId);
        })
        .catch(() => {});
    };

    const handleGroupDissolvedSocket = ({ chatId }) => {
      handleGroupDeleted(chatId);
    };

    socket.on("groupUpdated", handleGroupUpdatedSocket);
    socket.on("groupDissolved", handleGroupDissolvedSocket);

    return () => {
      socket.off("groupUpdated", handleGroupUpdatedSocket);
      socket.off("groupDissolved", handleGroupDissolvedSocket);
    };
  }, [currentUserId, handleGroupDeleted, handleGroupLeft, handleGroupUpdated]);

  if (loadingChats) {
    return <div className="chat-page chat-app chat-page__status">Loading chats...</div>;
  }

  if (chatError) {
    return <div className="chat-page chat-app chat-page__status">{chatError}</div>;
  }

  return (
    <div className={`chat-page chat-app${selectedChat ? " chat-page--chat-open" : ""}`}>
      {socketStatus !== "connected" && (
        <div
          className={`chat-page__socket-banner chat-page__socket-banner--${socketStatus}`}
          role="status"
          aria-live="polite"
        >
          {socketStatus === "connecting"
            ? "Connecting to realtime server..."
            : "Realtime server is offline. Messages, presence, and calls may not work until the backend starts."}
        </div>
      )}

      <Sidebar
        chats={chats}
        currentUser={currentUser}
        selectedChat={selectedChat}
        onSelectChat={handleSelectChat}
        onLogout={handleLogout}
        onChatAccepted={handleAcceptedChat}
        onProfileUpdated={handleProfileUpdated}
        onGroupCreated={handleGroupCreated}
        onCloseMobile={() => setShowMobileSidebar(false)}
        mobileHidden={!showMobileSidebar}
      />

      <div className={`chat-panel${showMobileSidebar ? " chat-panel--mobile-hidden" : ""}`}>
        {selectedChat ? (
          <ChatWindow
            key={selectedChat.id}
            chat={selectedChat}
            currentUserId={currentUserId}
            currentUserName={currentUser?.name}
            onVideoCall={handleVideoCall}
            onAudioCall={handleAudioCall}
            onMessageSent={handleMessageSent}
            onChatPreviewChanged={handleChatPreviewChanged}
            onChatRemoved={handleChatRemoved}
            onGroupUpdated={handleGroupUpdated}
            onGroupLeft={handleGroupLeft}
            onGroupDeleted={handleGroupDeleted}
            onBack={() => setShowMobileSidebar(true)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log out of Convox?"
        description="You'll be signed out on this device and taken back to the login screen."
        confirmLabel="Log Out"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />

      {showIncomingPopup && createPortal(
        <IncomingCallPopup
          callerName={incomingCallData?.callerName}
          callType={incomingCallData?.callType}
          onAccept={acceptCall}
          onReject={rejectCall}
        />,
        document.body,
      )}

      {showCallScreen && createPortal(
        <VideoCallScreen
          callStatus={callStatus}
          callType={callType}
          remoteUser={remoteUser}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          callDuration={callDuration}
          callError={callError}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          isTargetOnline={remoteUser?.id ? onlineUserIds.has(String(remoteUser.id)) : false}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
        />,
        document.body,
      )}
    </div>
  );
}
