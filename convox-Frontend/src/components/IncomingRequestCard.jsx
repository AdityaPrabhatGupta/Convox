import { useChatRequests } from "../hooks/useChatRequests.js";

const cardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "16px",
  background: "#27272a",
};

const buttonStyle = {
  padding: "6px 12px",
  border: "none",
  borderRadius: "10px",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

const IncomingRequestCard = ({ request }) => {
  const { acceptRequest, rejectRequest } = useChatRequests();

  const handleAccept = async () => {
    await acceptRequest(request._id);
  };

  const handleReject = async () => {
    await rejectRequest(request._id);
  };

  return (
    <div style={cardStyle}>
      <img
        src={request.sender.avatar || "/default-avatar.png"}
        alt={request.sender.name}
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "999px",
          objectFit: "cover",
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {request.sender.name}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#a1a1aa" }}>
          {request.sender.email}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#71717a" }}>
          {new Date(request.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={handleAccept}
          type="button"
          style={{ ...buttonStyle, background: "#22c55e" }}
        >
          Accept
        </button>
        <button
          onClick={handleReject}
          type="button"
          style={{ ...buttonStyle, background: "#52525b" }}
        >
          Reject
        </button>
      </div>
    </div>
  );
};

export default IncomingRequestCard;

