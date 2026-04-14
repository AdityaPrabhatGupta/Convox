import { useState } from "react";
import { useChatRequests } from "../hooks/useChatRequests.js";
import IncomingRequestCard from "./IncomingRequestCard.jsx";

const RequestsDrawer = () => {
  const [open, setOpen] = useState(false);
  const { incomingRequests } = useChatRequests();
  const count = incomingRequests.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        title="Chat Requests"
        style={{
          position: "relative",
          width: "36px",
          height: "36px",
          borderRadius: "999px",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: "var(--color-text-primary)",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "16px" }}>🔔</span>
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              padding: "0 4px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: 40,
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "320px",
          maxWidth: "100%",
          height: "100vh",
          background: "#18181b",
          boxShadow: "-12px 0 36px rgba(0, 0, 0, 0.35)",
          zIndex: 50,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s ease-in-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px",
            borderBottom: "1px solid #3f3f46",
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            Chat Requests
            {count > 0 && (
              <span
                style={{
                  marginLeft: "8px",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "#ef4444",
                  color: "#ffffff",
                  fontSize: "12px",
                }}
              >
                {count} new
              </span>
            )}
          </h2>
          <button
            onClick={() => setOpen(false)}
            type="button"
            style={{
              border: "none",
              background: "transparent",
              color: "#a1a1aa",
              fontSize: "20px",
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        <div
          style={{
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {count === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#71717a",
              }}
            >
              <span style={{ fontSize: "32px", marginBottom: "12px" }}>📭</span>
              <p style={{ margin: 0, fontSize: "14px" }}>No pending requests</p>
            </div>
          ) : (
            incomingRequests.map((request) => (
              <IncomingRequestCard key={request._id} request={request} />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default RequestsDrawer;

