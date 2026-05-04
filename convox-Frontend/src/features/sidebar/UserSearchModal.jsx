import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useUserSearch from "../../hooks/useUserSearch.js";
import ChatRequestButton from "./ChatRequestButton.jsx";
import "./UserSearchModal.css";

function AccountPreview({ user, onClose }) {
  if (!user) return null;

  return createPortal(
    <>
      <div className="cx-overlay-backdrop" onClick={onClose} />
      <div style={{ position: "fixed", inset: 0, zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div className="cx-overlay-shell usm__preview" style={{ width: "min(92vw, 420px)" }}>
            <div className="usm__preview-header">
              <button type="button" className="usm__preview-close" onClick={onClose} aria-label="Close">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="10" y2="10"/><line x1="10" y1="1" x2="1" y2="10"/></svg>
              </button>
              <div className="usm__preview-avatar">
                <img src={user.profilePic || "/default-avatar.png"} alt={user.name} />
              </div>
              <h3 className="usm__preview-name">{user.name}</h3>
              <p className="usm__preview-email">{user.email}</p>
              <p className="usm__preview-bio">{user.bio?.trim() || "No bio added yet."}</p>
            </div>
            <div className="usm__preview-body">
              <div className="usm__preview-note">
                You can view the account here and send a friend request. Messaging stays locked until the request is accepted.
              </div>
              <ChatRequestButton targetUser={user} />
            </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

function UserResultRow({ user, onViewAccount }) {
  return (
    <li className="usm__row">
      <button type="button" className="usm__row-btn" onClick={() => onViewAccount(user)}>
        <img src={user.profilePic || "/default-avatar.png"} alt={user.name} className="usm__avatar" />
        <div className="usm__info">
          <p className="usm__name">{user.name}</p>
          <p className="usm__email">{user.email}</p>
        </div>
      </button>
      <ChatRequestButton targetUser={user} />
    </li>
  );
}

const UserSearchModal = ({ onClose }) => {
  const { keyword, setKeyword, results, loading, error, clearSearch } =
    useUserSearch();
  const inputRef = useRef(null);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === "Escape") {
        if (selectedUser) {
          setSelectedUser(null);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, selectedUser]);

  const handleClose = () => {
    clearSearch();
    setSelectedUser(null);
    onClose();
  };

  return createPortal(
    <>
      <div className="cx-overlay-backdrop" onClick={handleClose} />
      <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }} role="dialog" aria-modal="true" aria-label="Find people">
        <div className="cx-overlay-shell usm" style={{ width: "min(92vw, 560px)" }}>
            {/* Header */}
            <div className="usm__header">
              <h2 className="usm__title">Find People</h2>
              <button type="button" className="usm__close" onClick={handleClose} aria-label="Close">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="1" y1="1" x2="10" y2="10"/><line x1="10" y1="1" x2="1" y2="10"/></svg>
              </button>
            </div>

            {/* Search */}
            <div className="usm__search-wrap">
              <div className="usm__search-bar">
                <svg className="usm__search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="usm__search-input"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="Search by name or email..."
                />
                {keyword && (
                  <button type="button" className="usm__search-clear" onClick={clearSearch} aria-label="Clear search">
                    <svg width="8" height="8" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="10" y2="10"/><line x1="10" y1="1" x2="1" y2="10"/></svg>
                  </button>
                )}
              </div>
            </div>

            <p className="usm__hint">Click a user to view their account. Messaging is only possible after friendship is accepted.</p>

            {/* Results area */}
            <div className="usm__results">
              {loading && (
                <div className="usm__loading"><div className="usm__spinner" /></div>
              )}

              {error && !loading && (
                <p className="usm__error">{error}</p>
              )}

              {!loading && !error && keyword.trim() && results.length === 0 && (
                <div className="usm__empty">
                  <div className="usm__empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  </div>
                  <p className="usm__empty-title">No results</p>
                  <p className="usm__empty-sub">No users found for "{keyword}"</p>
                </div>
              )}

              {!loading && !keyword.trim() && (
                <div className="usm__empty">
                  <div className="usm__empty-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <p className="usm__empty-title">Find people</p>
                  <p className="usm__empty-sub">Start typing to search for users</p>
                </div>
              )}

              {!loading && results.length > 0 && (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {results.map((user) => (
                    <UserResultRow
                      key={user._id}
                      user={user}
                      onViewAccount={setSelectedUser}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

      <AccountPreview user={selectedUser} onClose={() => setSelectedUser(null)} />
    </>,
    document.body,
  );
};

export default UserSearchModal;
