import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { createGroup } from "../../services/groupService.js";
import "./CreateGroupModal.css";
import "./ProfileModal.css";

function Avatar({ name, src }) {
  const initials = (name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="cgm-avatar">
      {src ? <img src={src} alt={name} className="cgm-avatar__img" /> : <span>{initials}</span>}
    </div>
  );
}

export default function CreateGroupModal({
  open,
  friends = [],
  onClose,
  onCreated,
}) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setStep(1);
    setQuery("");
    setResults(friends);
    setSelected([]);
    setGroupName("");
    setCreating(false);
    setError("");
    setTimeout(() => searchRef.current?.focus(), 80);
  }, [open, friends]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(friends);
      return undefined;
    }

    debounceRef.current = setTimeout(() => {
      setSearching(true);
      const q = query.toLowerCase();
      const filtered = friends.filter(
        (user) =>
          user.name.toLowerCase().includes(q) ||
          (user.email && user.email.toLowerCase().includes(q))
      );
      setResults(filtered);
      setSearching(false);
    }, 150);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, friends]);

  const toggleUser = useCallback((user) => {
    setSelected((previous) => {
      const exists = previous.some(
        (entry) => String(entry._id) === String(user._id),
      );
      if (exists) {
        return previous.filter(
          (entry) => String(entry._id) !== String(user._id),
        );
      }
      if (previous.length >= 49) return previous;
      return [...previous, user];
    });
  }, []);

  const isSelected = (user) =>
    selected.some((entry) => String(entry._id) === String(user._id));

  const handleNext = () => {
    if (selected.length < 1) {
      setError("Add at least 1 member.");
      return;
    }

    setError("");
    setStep(2);
    setTimeout(() => document.getElementById("cgm-name-input")?.focus(), 80);
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Enter a group name.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const chat = await createGroup(
        groupName.trim(),
        selected.map((user) => user._id),
      );
      onCreated?.(chat);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="profile-modal__backdrop" onClick={onClose} />
      <div className="profile-modal-wrapper">
        <div className="profile-modal" role="dialog" aria-modal="true" aria-label="Create group" style={{ flexShrink: 0 }}>
        <div className="profile-modal__header">
          {step === 2 && (
            <button
              type="button"
              className="cgm-back"
              onClick={() => {
                setStep(1);
                setError("");
              }}
              style={{ marginRight: "12px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          )}
          <span className="profile-modal__title" style={{ flex: 1 }}>
            {step === 1 ? "New Group" : "Group Name"}
          </span>
          <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {step === 1 && (
          <div className="cgm-body">
            {selected.length > 0 && (
              <div className="cgm-chips">
                {selected.map((user) => (
                  <div key={user._id} className="cgm-chip">
                    <Avatar name={user.name} src={user.profilePic} />
                    <span className="cgm-chip__name">{user.name.split(" ")[0]}</span>
                    <button
                      type="button"
                      className="cgm-chip__remove"
                      onClick={() => toggleUser(user)}
                      aria-label={`Remove ${user.name}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="cgm-search-row">
              <svg className="cgm-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={searchRef}
                className="cgm-search"
                type="text"
                placeholder="Search people..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
              />
              {searching && <span className="cgm-search-spinner" />}
            </div>

            <div className="cgm-results">
              {!query && !results.length && (
                <p className="cgm-hint">You don't have any friends to add yet.</p>
              )}
              {query && !searching && !results.length && (
                <p className="cgm-hint">No friends found for "{query}"</p>
              )}
              {results.map((user) => (
                <button
                  key={user._id}
                  type="button"
                  className={`cgm-user-row ${isSelected(user) ? "cgm-user-row--selected" : ""}`}
                  onClick={() => toggleUser(user)}
                >
                  <Avatar name={user.name} src={user.profilePic} />
                  <div className="cgm-user-info">
                    <span className="cgm-user-name">{user.name}</span>
                    {user.bio && <span className="cgm-user-bio">{user.bio}</span>}
                  </div>
                  <div className={`cgm-check ${isSelected(user) ? "cgm-check--on" : ""}`}>
                    {isSelected(user) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="cgm-error">{error}</p>}

            <div className="cgm-footer">
              <span className="cgm-count">{selected.length} selected</span>
              <button
                type="button"
                className="cgm-btn-primary"
                onClick={handleNext}
                disabled={selected.length < 1}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="cgm-body">
            <div className="cgm-name-section">
              <div className="cgm-group-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <input
                id="cgm-name-input"
                className="cgm-name-input"
                type="text"
                placeholder="Group name..."
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={80}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleCreate();
                }}
              />
            </div>

            <div className="cgm-member-preview">
              <p className="cgm-member-preview__label">
                {selected.length + 1} participants
              </p>
              <div className="cgm-member-preview__list">
                {selected.map((user) => (
                  <div key={user._id} className="cgm-member-chip">
                    <Avatar name={user.name} src={user.profilePic} />
                    <span>{user.name.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="cgm-error">{error}</p>}

            <div className="cgm-footer">
              <button
                type="button"
                className="cgm-btn-primary"
                onClick={handleCreate}
                disabled={creating || !groupName.trim()}
              >
                {creating ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>,
    document.body,
  );
}
