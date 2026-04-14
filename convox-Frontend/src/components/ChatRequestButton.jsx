import { getCurrentUserId } from "../utils/auth.js";
import { useChatRequests } from "../hooks/useChatRequests.js";

const baseButtonStyle = {
  padding: "6px 12px",
  fontSize: "12px",
  borderRadius: "999px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const ChatRequestButton = ({ targetUser }) => {
  const { sendRequest, outgoingRequests, loading } = useChatRequests();
  const currentUserId = getCurrentUserId();

  const existingRequest = outgoingRequests.find(
    (request) => request.receiver?._id === targetUser?._id,
  );

  if (!targetUser?._id || targetUser._id === currentUserId) return null;

  const handleSend = async () => {
    const result = await sendRequest(targetUser._id);
    if (!result.success) {
      window.alert(result.message);
    }
  };

  if (existingRequest) {
    return (
      <button
        disabled
        type="button"
        style={{
          ...baseButtonStyle,
          border: "1px solid #facc15",
          color: "#facc15",
          background: "transparent",
          cursor: "not-allowed",
          opacity: 0.8,
        }}
      >
        Request Sent
      </button>
    );
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      type="button"
      style={{
        ...baseButtonStyle,
        border: "none",
        color: "#ffffff",
        background: "#3b82f6",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Sending..." : "Add to Convox"}
    </button>
  );
};

export default ChatRequestButton;
