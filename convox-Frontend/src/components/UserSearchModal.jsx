import { useRef, useEffect } from "react";
import useUserSearch from "../hooks/useUserSearch.js";
import ChatRequestButton from "./ChatRequestButton.jsx";

const UserResultRow = ({ user }) => (
  <li
    style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "12px 16px",
      borderTop: "1px solid #27272a",
    }}
  >
    <img
      src={user.profilePic || "/default-avatar.png"}
      alt={user.name}
      style={{
        width: "40px",
        height: "40px",
        borderRadius: "999px",
        objectFit: "cover",
        flexShrink: 0,
      }}
    />

    <div style={{ flex: 1, minWidth: 0 }}>
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 500,
          color: "#ffffff",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {user.name}
      </p>
      <p
        style={{
          margin: "2px 0 0",
          fontSize: "12px",
          color: "#a1a1aa",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {user.email}
      </p>
    </div>

    <ChatRequestButton targetUser={user} />
  </li>
);

const UserSearchModal = ({ onClose }) => {
  const { keyword, setKeyword, results, loading, error, clearSearch } =
    useUserSearch();
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 40,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: "448px",
          background: "#18181b",
          borderRadius: "16px",
          boxShadow: "0 25px 50px rgba(0, 0, 0, 0.4)",
          zIndex: 50,
          border: "1px solid #3f3f46",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid #3f3f46",
          }}
        >
          <h2 style={{ margin: 0, color: "#ffffff", fontWeight: 600, fontSize: "16px" }}>
            Find People
          </h2>
          <button
            onClick={handleClose}
            type="button"
            style={{
              color: "#a1a1aa",
              background: "transparent",
              border: "none",
              fontSize: "20px",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: "12px 16px", borderBottom: "1px solid #3f3f46" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "#27272a",
              borderRadius: "12px",
              padding: "8px 12px",
            }}
          >
            <span style={{ color: "#a1a1aa", fontSize: "14px" }}>🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search by name or email..."
              style={{
                flex: 1,
                background: "transparent",
                color: "#ffffff",
                fontSize: "14px",
                border: "none",
                outline: "none",
              }}
            />
            {keyword && (
              <button
                onClick={clearSearch}
                type="button"
                style={{
                  color: "#71717a",
                  background: "transparent",
                  border: "none",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                x
              </button>
            )}
          </div>
        </div>

        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
          {loading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                padding: "32px 0",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  border: "2px solid #3b82f6",
                  borderTopColor: "transparent",
                  borderRadius: "999px",
                  animation: "spin 1s linear infinite",
                }}
              />
            </div>
          )}

          {error && !loading && (
            <p style={{ textAlign: "center", color: "#f87171", fontSize: "14px", padding: "24px 0" }}>
              {error}
            </p>
          )}

          {!loading && !error && keyword.trim() && results.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 0",
                color: "#71717a",
              }}
            >
              <span style={{ fontSize: "30px", marginBottom: "8px" }}>🙅</span>
              <p style={{ margin: 0, fontSize: "14px" }}>
                No users found for "{keyword}"
              </p>
            </div>
          )}

          {!loading && !keyword.trim() && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 0",
                color: "#71717a",
              }}
            >
              <span style={{ fontSize: "30px", marginBottom: "8px" }}>👥</span>
              <p style={{ margin: 0, fontSize: "14px" }}>Start typing to find people</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {results.map((user) => (
                <UserResultRow key={user._id} user={user} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default UserSearchModal;

