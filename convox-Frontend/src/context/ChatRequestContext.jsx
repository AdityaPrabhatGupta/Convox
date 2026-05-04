/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import axiosInstance from "../services/axiosInstance.js";
import { socket } from "../services/socket.js";
import { isLoggedIn } from "../utils/auth.js";

const ChatRequestContext = createContext();

const sortRequestsByRecent = (requests) =>
  [...requests].sort(
    (left, right) =>
      new Date(right.updatedAt || right.createdAt || 0).getTime() -
      new Date(left.updatedAt || left.createdAt || 0).getTime(),
  );

const upsertRequest = (requests, nextRequest) => {
  const withoutCurrent = requests.filter((request) => request._id !== nextRequest._id);
  return sortRequestsByRecent([nextRequest, ...withoutCurrent]);
};

export const ChatRequestProvider = ({ children }) => {
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [unseenOutgoingUpdates, setUnseenOutgoingUpdates] = useState({});
  const [loading, setLoading] = useState(false);
  const authenticated = isLoggedIn();

  const fetchIncoming = useCallback(async () => {
    if (!authenticated) return;

    try {
      const { data } = await axiosInstance.get("/api/chat-requests/incoming");
      setIncomingRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch incoming requests", error);
    }
  }, [authenticated]);

  const fetchOutgoing = useCallback(async () => {
    if (!authenticated) return;

    try {
      const { data } = await axiosInstance.get("/api/chat-requests/outgoing");
      setOutgoingRequests(Array.isArray(data) ? sortRequestsByRecent(data) : []);
    } catch (error) {
      console.error("Failed to fetch outgoing requests", error);
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setUnseenOutgoingUpdates({});
      return;
    }

    fetchIncoming();
    fetchOutgoing();
  }, [authenticated, fetchIncoming, fetchOutgoing]);

  useEffect(() => {
    if (!authenticated || !socket) return undefined;

    const handleNewChatRequest = (request) => {
      setIncomingRequests((previous) => {
        const exists = previous.some((item) => item._id === request._id);
        return exists ? previous : [request, ...previous];
      });
    };

    const handleRequestStatusChanged = ({ request }) => {
      if (!request?._id) return;

      setOutgoingRequests((previous) => upsertRequest(previous, request));
      setUnseenOutgoingUpdates((previous) => ({
        ...previous,
        [request._id]: true,
      }));
    };

    socket.on("newChatRequest", handleNewChatRequest);
    socket.on("chatRequestStatusChanged", handleRequestStatusChanged);

    return () => {
      socket.off("newChatRequest", handleNewChatRequest);
      socket.off("chatRequestStatusChanged", handleRequestStatusChanged);
    };
  }, [authenticated]);

  const sendRequest = async (receiverId) => {
    if (!authenticated) {
      return { success: false, message: "Please log in first." };
    }

    setLoading(true);

    try {
      const { data } = await axiosInstance.post("/api/chat-requests/send", {
        receiverId,
      });
      setOutgoingRequests((previous) => upsertRequest(previous, data.request));
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
      };
    } finally {
      setLoading(false);
    }
  };

  const acceptRequest = async (requestId) => {
    if (!authenticated) {
      return { success: false, message: "Please log in first." };
    }

    try {
      const { data } = await axiosInstance.patch(
        `/api/chat-requests/${requestId}/accept`,
      );
      setIncomingRequests((previous) =>
        previous.filter((request) => request._id !== requestId),
      );
      return { success: true, chat: data.chat };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
      };
    }
  };

  const rejectRequest = async (requestId) => {
    if (!authenticated) {
      return { success: false, message: "Please log in first." };
    }

    try {
      await axiosInstance.patch(`/api/chat-requests/${requestId}/reject`);
      setIncomingRequests((previous) =>
        previous.filter((request) => request._id !== requestId),
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
      };
    }
  };

  const cancelRequest = async (requestId) => {
    if (!authenticated) {
      return { success: false, message: "Please log in first." };
    }

    try {
      await axiosInstance.delete(`/api/chat-requests/${requestId}/cancel`);
      setOutgoingRequests((previous) =>
        previous.filter((request) => request._id !== requestId),
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Something went wrong.",
      };
    }
  };

  const clearOutgoingUpdates = () => {
    setUnseenOutgoingUpdates({});
  };

  const unseenOutgoingUpdateCount = Object.keys(unseenOutgoingUpdates).length;

  return (
    <ChatRequestContext.Provider
      value={{
        incomingRequests,
        outgoingRequests,
        unseenOutgoingUpdateCount,
        loading,
        sendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest,
        clearOutgoingUpdates,
      }}
    >
      {children}
    </ChatRequestContext.Provider>
  );
};

export const useChatRequestsContext = () => useContext(ChatRequestContext);
