import { useState } from "react";
import { getCurrentUserId } from "../../utils/auth.js";
import { useChatRequests } from "../../hooks/useChatRequests.js";

const ChatRequestButton = ({ targetUser }) => {
  const { sendRequest, outgoingRequests, loading } = useChatRequests();
  const currentUserId = getCurrentUserId();
  const [error, setError] = useState("");

  const latestRequest = outgoingRequests.find(
    (request) => String(request.receiver?._id) === String(targetUser?._id),
  );
  const pendingRequest = latestRequest?.status === "pending" ? latestRequest : null;
  const acceptedRequest = latestRequest?.status === "accepted" ? latestRequest : null;

  if (!targetUser?._id || targetUser._id === currentUserId) return null;

  const handleSend = async () => {
    setError("");
    const result = await sendRequest(targetUser._id);
    if (!result.success) {
      setError(result.message);
    }
  };

  if (pendingRequest || acceptedRequest) {
    const isAccepted = Boolean(acceptedRequest);
    return (
      <button
        disabled
        type="button"
        className={`crb ${isAccepted ? "crb--accepted" : "crb--pending"}`}
      >
        {isAccepted ? "Friend" : "Request Sent"}
      </button>
    );
  }

  return (
    <div className="crb__wrap">
      <button
        onClick={handleSend}
        disabled={loading}
        type="button"
        className={`crb crb--add ${loading ? "crb--loading" : ""}`}
      >
        {loading ? "Sending..." : latestRequest?.status === "rejected" ? "Send Again" : "Add Friend"}
      </button>
      {error && <span className="crb__error">{error}</span>}
    </div>
  );
};

export default ChatRequestButton;
