import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useChatRequests } from "../../hooks/useChatRequests.js";
import "./RequestsDrawer.css";

const formatTimeline = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const RequestsDrawer = ({ onChatAccepted }) => {
  const {
    incomingRequests,
    outgoingRequests,
    unseenOutgoingUpdateCount,
    clearOutgoingUpdates,
    sendRequest,
    acceptRequest,
    rejectRequest,
  } = useChatRequests();
  const [open, setOpen] = useState(false);
  const [loadingKey, setLoadingKey] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("incoming");
  const [dismissing, setDismissing] = useState({});
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const incomingCount = incomingRequests.length;
  const sentCount = outgoingRequests.length;
  const notificationCount = incomingCount + unseenOutgoingUpdateCount;

  useEffect(() => {
    if (open && activeTab === "sent" && unseenOutgoingUpdateCount > 0) {
      clearOutgoingUpdates();
    }
  }, [activeTab, clearOutgoingUpdates, open, unseenOutgoingUpdateCount]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !triggerRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(""), 3000);
    return () => window.clearTimeout(t);
  }, [error]);

  const getInitials = (name = "") =>
    name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  const AVATAR_COLORS = [
    { bg: "rgba(108,99,255,0.15)", color: "#8b85ff" },
    { bg: "rgba(255,107,172,0.15)", color: "#ff6bac" },
    { bg: "rgba(34,211,122,0.15)", color: "#22d37a" },
    { bg: "rgba(255,181,71,0.15)", color: "#ffb547" },
    { bg: "rgba(94,174,255,0.15)", color: "#5eaeff" },
  ];

  const getAvatarColor = (name = "") => {
    const i = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
    return AVATAR_COLORS[i];
  };

  const animateDismiss = (id, direction, action) => {
    setDismissing((prev) => ({ ...prev, [id]: direction }));
    setTimeout(async () => {
      setLoadingKey(id);
      setError("");
      try {
        const result = await action(id);
        if (!result.success) {
          setError(result.message || "Something went wrong.");
          setDismissing((prev) => { const n={...prev}; delete n[id]; return n; });
          return;
        }
        if (result.chat) onChatAccepted?.(result.chat);
        if (incomingCount <= 1) setOpen(false);
      } finally {
        setLoadingKey("");
        setDismissing((prev) => { const n={...prev}; delete n[id]; return n; });
      }
    }, 320);
  };

  const handleAccept = (id) => animateDismiss(id, "accept", acceptRequest);
  const handleReject = (id) => animateDismiss(id, "reject", rejectRequest);
  const handleResend = async (receiverId) => {
    const key = `resend:${receiverId}`;
    setLoadingKey(key);
    setError("");
    try {
      const result = await sendRequest(receiverId);
      if (!result.success) {
        setError(result.message || "Something went wrong.");
      }
    } finally {
      setLoadingKey("");
    }
  };

  const handleDeclineAll = () => {
    incomingRequests.forEach((req, i) => {
      setTimeout(() => handleReject(req._id), i * 90);
    });
  };

  return (
    <div className="rb">
      <button
        ref={triggerRef}
        type="button"
        className={`rb__trigger ${notificationCount > 0 ? "rb__trigger--notify" : ""} ${open ? "rb__trigger--open" : ""}`}
        aria-label={`Chat requests${notificationCount > 0 ? ` (${notificationCount})` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((p) => !p)}
      >
        {notificationCount > 0 && <span className="rb__ring" />}
        <svg className="rb__bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notificationCount > 0 && (
          <span className="rb__badge">{notificationCount > 9 ? "9+" : notificationCount}</span>
        )}
      </button>

      {open && createPortal(
        <>
          <div className="cx-overlay-backdrop" onClick={() => setOpen(false)} />
          <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
            <div className="cx-overlay-shell" style={{ width: "min(92vw, 640px)" }}>
              <div ref={dropdownRef} className="rb__drawer rb__drawer--centered">
              {/* Header */}
          <div className="rb__header">
            <div className="rb__header-row">
              <div className="rb__header-left">
                <span className="rb__title">Requests</span>
                {incomingCount > 0 && (
                  <span className="rb__pending-pill">
                    <span className="rb__pending-dot" />
                    {incomingCount} pending
                  </span>
                )}
                {unseenOutgoingUpdateCount > 0 && (
                  <span className="rb__updates-pill">
                    {unseenOutgoingUpdateCount} update{unseenOutgoingUpdateCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button className="rb__close" onClick={() => setOpen(false)} type="button">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="10" y2="10" /><line x1="10" y1="1" x2="1" y2="10" />
                </svg>
              </button>
            </div>
            <p className="rb__subtitle">People who want to connect with you</p>
          </div>

          {/* Tabs */}
          <div className="rb__tabs">
            <button className={`rb__tab ${activeTab === "incoming" ? "rb__tab--active" : ""}`} onClick={() => setActiveTab("incoming")} type="button">
              Incoming
              {incomingCount > 0 && <span className="rb__tab-count">{incomingCount}</span>}
            </button>
            <button className={`rb__tab ${activeTab === "sent" ? "rb__tab--active" : ""}`} onClick={() => setActiveTab("sent")} type="button">
              Sent
              {sentCount > 0 && (
                <span className={`rb__tab-count ${unseenOutgoingUpdateCount > 0 ? "rb__tab-count--highlight" : ""}`}>
                  {sentCount}
                </span>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="rb__error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          {/* List */}
          <div className="rb__list">
            {activeTab === "incoming" && (
              <>
                {incomingCount === 0 ? (
                  <div className="rb__empty">
                    <div className="rb__empty-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <p className="rb__empty-title">All caught up</p>
                    <p className="rb__empty-sub">New requests will appear here</p>
                  </div>
                ) : (
                  incomingRequests.map((req) => {
                    const av = getAvatarColor(req.sender.name);
                    const state = dismissing[req._id];
                    return (
                      <div
                        key={req._id}
                        className={`rb__item ${state === "accept" ? "rb__item--accepting" : ""} ${state === "reject" ? "rb__item--rejecting" : ""}`}
                      >
                        <div className="rb__avatar-wrap">
                          <div className="rb__avatar" style={{ background: av.bg, color: av.color }}>
                            {req.sender.profilePic
                              ? <img src={req.sender.profilePic} alt={req.sender.name} />
                              : getInitials(req.sender.name)
                            }
                          </div>
                        </div>

                        <div className="rb__meta">
                          <p className="rb__name">{req.sender.name}</p>
                          <p className="rb__email">{req.sender.email}</p>
                        </div>

                        <div className="rb__actions">
                          <button
                            type="button"
                            className="rb__btn rb__btn--accept"
                            onClick={() => handleAccept(req._id)}
                            disabled={loadingKey === req._id}
                            aria-label="Accept"
                          >
                            {loadingKey === req._id
                              ? <span className="rb__spinner rb__spinner--green" />
                              : (
                                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="1.5,6.5 5,10 11.5,3" />
                                </svg>
                              )
                            }
                          </button>
                          <button
                            type="button"
                            className="rb__btn rb__btn--reject"
                            onClick={() => handleReject(req._id)}
                            disabled={loadingKey === req._id}
                            aria-label="Decline"
                          >
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <line x1="1" y1="1" x2="10" y2="10" /><line x1="10" y1="1" x2="1" y2="10" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {activeTab === "sent" && (
              <>
                {sentCount === 0 ? (
                  <div className="rb__empty">
                    <div className="rb__empty-icon">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                      </svg>
                    </div>
                    <p className="rb__empty-title">No sent requests</p>
                    <p className="rb__empty-sub">Requests you send will appear here with their latest status</p>
                  </div>
                ) : (
                  outgoingRequests.map((req) => {
                    const av = getAvatarColor(req.receiver?.name || "");
                    const resendKey = `resend:${req.receiver?._id}`;
                    const statusLabel = req.status === "accepted"
                      ? "Accepted"
                      : req.status === "rejected"
                        ? "Rejected"
                        : "Pending";
                    const timeline = req.status === "pending"
                      ? `Sent ${formatTimeline(req.createdAt)}`
                      : `${statusLabel} ${formatTimeline(req.updatedAt || req.createdAt)}`;

                    return (
                      <div key={req._id} className="rb__item rb__item--sent">
                        <div className="rb__avatar-wrap">
                          <div className="rb__avatar" style={{ background: av.bg, color: av.color }}>
                            {req.receiver?.profilePic
                              ? <img src={req.receiver.profilePic} alt={req.receiver?.name || "User"} />
                              : getInitials(req.receiver?.name || "User")
                            }
                          </div>
                        </div>

                        <div className="rb__meta">
                          <div className="rb__sent-head">
                            <p className="rb__name">{req.receiver?.name || "Unknown user"}</p>
                            <span className={`rb__status rb__status--${req.status}`}>{statusLabel}</span>
                          </div>
                          <p className="rb__email">{timeline}</p>
                          {req.status === "accepted" && (
                            <p className="rb__timeline-note">Accepted your request and opened the chat.</p>
                          )}
                          {req.status === "rejected" && (
                            <p className="rb__timeline-note">Request was declined. You can send it again.</p>
                          )}
                        </div>

                        {req.status === "rejected" && req.receiver?._id && (
                          <div className="rb__actions">
                            <button
                              type="button"
                              className="rb__resend-btn"
                              onClick={() => handleResend(req.receiver._id)}
                              disabled={loadingKey === resendKey}
                            >
                              {loadingKey === resendKey ? "Sending..." : "Send again"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {incomingCount > 0 && activeTab === "incoming" && (
            <div className="rb__footer">
              <button className="rb__decline-all" type="button" onClick={handleDeclineAll}>
                Decline all
              </button>
            </div>
          )}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
};

export default RequestsDrawer;
