/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import axiosInstance from "../services/axiosInstance.js";
import { socket } from "../services/socket.js";

const ChatRequestContext = createContext();

export const ChatRequestProvider = ({ children }) => {
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchIncoming();
    fetchOutgoing();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNewChatRequest = (request) => {
      setIncomingRequests((previous) => {
        const exists = previous.some((item) => item._id === request._id);
        return exists ? previous : [request, ...previous];
      });
    };

    const handleChatRequestAccepted = ({ chat }) => {
      setOutgoingRequests((previous) =>
        previous.filter((request) => {
          const receiverId = String(request.receiver?._id || request.receiver || "");
          return !chat?.members?.some((memberId) => String(memberId) === receiverId);
        }),
      );
    };

    socket.on("newChatRequest", handleNewChatRequest);
    socket.on("chatRequestAccepted", handleChatRequestAccepted);

    return () => {
      socket.off("newChatRequest", handleNewChatRequest);
      socket.off("chatRequestAccepted", handleChatRequestAccepted);
    };
  }, []);

  const fetchIncoming = async () => {
    try {
      const { data } = await axiosInstance.get("/api/chat-requests/incoming");
      setIncomingRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch incoming requests", error);
    }
  };

  const fetchOutgoing = async () => {
    try {
      const { data } = await axiosInstance.get("/api/chat-requests/outgoing");
      setOutgoingRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch outgoing requests", error);
    }
  };

  const sendRequest = async (receiverId) => {
    setLoading(true);

    try {
      const { data } = await axiosInstance.post("/api/chat-requests/send", {
        receiverId,
      });
      setOutgoingRequests((previous) => [data.request, ...previous]);
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

  return (
    <ChatRequestContext.Provider
      value={{
        incomingRequests,
        outgoingRequests,
        loading,
        sendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest,
      }}
    >
      {children}
    </ChatRequestContext.Provider>
  );
};

export const useChatRequestsContext = () => useContext(ChatRequestContext);
