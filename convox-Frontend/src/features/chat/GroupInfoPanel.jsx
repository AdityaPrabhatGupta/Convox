import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { searchUsers } from "../../services/userService.js";
import {
  renameGroup,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  transferAdmin,
} from "../../services/groupService.js";
import "../sidebar/CreateGroupModal.css";
import "./GroupInfoPanel.css";

function Avatar({ name, src, size = 40 }) {
  const initials = (name || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="gip-avatar" style={{ width: size, height: size, fontSize: size * 0.33 }}>
      {src ? <img src={src} alt={name} className="gip-avatar__img" /> : <span>{initials}</span>}
    </div>
  );
}

export default function GroupInfoPanel({
  open,
  chat,
  currentUserId,
  onClose,
  onGroupUpdated,
  onGroupLeft,
  onGroupDeleted,
}) {
  const adminId = String(
    chat?.groupAdmin?._id ||
      chat?.groupAdmin ||
      chat?.rawChat?.groupAdmin?._id ||
      chat?.rawChat?.groupAdmin ||
      "",
  );
  const isAdmin = Boolean(adminId) && adminId === String(currentUserId);
  const members = useMemo(() => chat?.users || [], [chat?.users]);

  const [tab, setTab] = useState("info");
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addSelected, setAddSelected] = useState([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const addSearchRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTab("info");
    setRenaming(false);
    setShowAddMembers(false);
    setConfirmAction(null);
    setActionError("");
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!addQuery.trim()) {
      setAddResults([]);
      return undefined;
    }

    debounceRef.current = setTimeout(async () => {
      setAddSearching(true);
      try {
        const data = await searchUsers(addQuery);
        const existingIds = new Set(members.map((member) => String(member._id)));
        setAddResults(
          (data || []).filter(
            (user) =>
              !existingIds.has(String(user._id)) &&
              String(user._id) !== String(currentUserId),
          ),
        );
      } catch {
        setAddResults([]);
      } finally {
        setAddSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addQuery, members, currentUserId]);

  const handleRename = async () => {
    if (!newName.trim()) {
      setNameError("Name cannot be empty.");
      return;
    }

    setSavingName(true);
    setNameError("");
    try {
      const updated = await renameGroup(chat.id, newName.trim());
      onGroupUpdated?.(updated);
      setRenaming(false);
    } catch (err) {
      setNameError(err.response?.data?.message || "Failed to rename.");
    } finally {
      setSavingName(false);
    }
  };

  const toggleAddSelect = (user) => {
    setAddSelected((previous) => {
      const exists = previous.some(
        (entry) => String(entry._id) === String(user._id),
      );
      return exists
        ? previous.filter((entry) => String(entry._id) !== String(user._id))
        : [...previous, user];
    });
  };

  const handleAddMembers = async () => {
    if (!addSelected.length) return;
    setAdding(true);
    setAddError("");
    try {
      const result = await addGroupMembers(
        chat.id,
        addSelected.map((user) => user._id),
      );
      onGroupUpdated?.(result.chat);
      setShowAddMembers(false);
      setAddSelected([]);
      setAddQuery("");
    } catch (err) {
      setAddError(err.response?.data?.message || "Failed to add members.");
    } finally {
      setAdding(false);
    }
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (confirmAction.type === "remove") {
        const result = await removeGroupMember(chat.id, confirmAction.memberId);
        onGroupUpdated?.(result.chat);
      } else if (confirmAction.type === "makeAdmin") {
        const result = await transferAdmin(chat.id, confirmAction.memberId);
        onGroupUpdated?.(result);
      } else if (confirmAction.type === "leave") {
        const result = await leaveGroup(chat.id);
        if (result.dissolved) onGroupDeleted?.(chat.id);
        else onGroupLeft?.(chat.id);
      } else if (confirmAction.type === "delete") {
        await deleteGroup(chat.id);
        onGroupDeleted?.(chat.id);
      }
      setConfirmAction(null);
    } catch (err) {
      setActionError(err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!open || !chat) return null;

  const confirmCopy = {
    remove: {
      title: "Remove Member",
      desc: `Remove ${confirmAction?.memberName} from this group?`,
      btn: "Remove",
    },
    makeAdmin: {
      title: "Make Admin",
      desc: `Make ${confirmAction?.memberName} the group admin? You'll lose admin rights.`,
      btn: "Confirm",
    },
    leave: {
      title: "Leave Group",
      desc: "You'll lose access to this group's messages.",
      btn: "Leave",
    },
    delete: {
      title: "Delete Group",
      desc: "This will permanently delete the group and all its messages.",
      btn: "Delete",
    },
  };

  return createPortal(
    <>
      <div className="gip-backdrop" onClick={onClose} />
      <div className="gip-panel" role="dialog" aria-modal="true" aria-label="Group info">
        <div className="gip-topbar">
          <button type="button" className="gip-topbar__back" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="gip-topbar__title">Group Info</span>
        </div>

        <div className="gip-hero">
          <div className="gip-hero__avatar">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          {renaming ? (
            <div className="gip-rename-row">
              <input
                className="gip-rename-input"
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleRename();
                  if (event.key === "Escape") setRenaming(false);
                }}
                maxLength={80}
              />
              <button type="button" className="gip-rename-save" onClick={handleRename} disabled={savingName}>
                {savingName ? "..." : "Save"}
              </button>
              <button
                type="button"
                className="gip-rename-cancel"
                onClick={() => {
                  setRenaming(false);
                  setNameError("");
                }}
              >
                Cancel
              </button>
              {nameError && <p className="gip-field-error">{nameError}</p>}
            </div>
          ) : (
            <div className="gip-hero__name-row">
              <h2 className="gip-hero__name">{chat.name}</h2>
              {isAdmin && (
                <button
                  type="button"
                  className="gip-edit-btn"
                  onClick={() => {
                    setNewName(chat.name);
                    setRenaming(true);
                  }}
                  title="Rename group"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="gip-hero__meta">
            {members.length} member{members.length !== 1 ? "s" : ""} · {isAdmin ? "You are admin" : "Group"}
          </p>
        </div>

        <div className="gip-tabs">
          <button type="button" className={`gip-tab ${tab === "info" ? "gip-tab--active" : ""}`} onClick={() => setTab("info")}>
            Info
          </button>
          <button type="button" className={`gip-tab ${tab === "members" ? "gip-tab--active" : ""}`} onClick={() => setTab("members")}>
            Members
          </button>
        </div>

        <div className="gip-body">
          {tab === "info" && (
            <div className="gip-section">
              <p className="gip-section__label">Actions</p>
              {isAdmin && (
                <button
                  type="button"
                  className="gip-action-row"
                  onClick={() => {
                    setShowAddMembers(true);
                    setTimeout(() => addSearchRef.current?.focus(), 80);
                  }}
                >
                  <span className="gip-action-row__icon gip-action-row__icon--add">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </span>
                  Add Members
                </button>
              )}
              <button
                type="button"
                className="gip-action-row gip-action-row--danger"
                onClick={() => setConfirmAction({ type: "leave" })}
              >
                <span className="gip-action-row__icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                Leave Group
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="gip-action-row gip-action-row--danger"
                  onClick={() => setConfirmAction({ type: "delete" })}
                >
                  <span className="gip-action-row__icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </span>
                  Delete Group
                </button>
              )}
            </div>
          )}

          {tab === "members" && (
            <div className="gip-member-list">
              {members.map((member) => {
                const memberId = String(member._id);
                const isSelf = memberId === String(currentUserId);
                const isMemberAdmin = adminId === memberId;

                return (
                  <div key={memberId} className="gip-member-row">
                    <Avatar name={member.name} src={member.profilePic} />
                    <div className="gip-member-info">
                      <span className="gip-member-name">
                        {member.name}
                        {isSelf ? " (You)" : ""}
                      </span>
                      {member.bio && <span className="gip-member-bio">{member.bio}</span>}
                    </div>
                    {isMemberAdmin && <span className="gip-admin-badge">Admin</span>}
                    {isAdmin && !isSelf && (
                      <div className="gip-member-actions">
                        {!isMemberAdmin && (
                          <button
                            type="button"
                            className="gip-member-btn gip-member-btn--promote"
                            title="Make admin"
                            onClick={() =>
                              setConfirmAction({
                                type: "makeAdmin",
                                memberId,
                                memberName: member.name,
                              })
                            }
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          className="gip-member-btn gip-member-btn--remove"
                          title="Remove"
                          onClick={() =>
                            setConfirmAction({
                              type: "remove",
                              memberId,
                              memberName: member.name,
                            })
                          }
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showAddMembers && (
          <div className="gip-add-overlay">
            <div className="gip-add-header">
              <button
                type="button"
                className="gip-topbar__back"
                onClick={() => {
                  setShowAddMembers(false);
                  setAddSelected([]);
                  setAddQuery("");
                  setAddError("");
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="gip-topbar__title">Add Members</span>
            </div>
            <div className="gip-add-search-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 26, opacity: 0.5, pointerEvents: "none" }}>
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={addSearchRef}
                className="cgm-search"
                style={{ paddingLeft: 38 }}
                type="text"
                placeholder="Search users..."
                value={addQuery}
                onChange={(event) => setAddQuery(event.target.value)}
              />
            </div>
            {addSelected.length > 0 && (
              <div className="cgm-chips" style={{ padding: "0 16px 0" }}>
                {addSelected.map((user) => (
                  <div key={user._id} className="cgm-chip">
                    <Avatar name={user.name} src={user.profilePic} size={22} />
                    <span className="cgm-chip__name">{user.name.split(" ")[0]}</span>
                    <button type="button" className="cgm-chip__remove" onClick={() => toggleAddSelect(user)}>
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="gip-add-results">
              {addSearching && <p className="cgm-hint">Searching...</p>}
              {!addSearching && addQuery && !addResults.length && <p className="cgm-hint">No users found</p>}
              {addResults.map((user) => {
                const selected = addSelected.some(
                  (entry) => String(entry._id) === String(user._id),
                );
                return (
                  <button
                    key={user._id}
                    type="button"
                    className={`cgm-user-row ${selected ? "cgm-user-row--selected" : ""}`}
                    onClick={() => toggleAddSelect(user)}
                  >
                    <Avatar name={user.name} src={user.profilePic} />
                    <div className="cgm-user-info">
                      <span className="cgm-user-name">{user.name}</span>
                      {user.bio && <span className="cgm-user-bio">{user.bio}</span>}
                    </div>
                    <div className={`cgm-check ${selected ? "cgm-check--on" : ""}`}>
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            {addError && <p className="cgm-error" style={{ padding: "0 16px" }}>{addError}</p>}
            <div className="gip-add-footer">
              <button
                type="button"
                className="cgm-btn-primary"
                onClick={handleAddMembers}
                disabled={!addSelected.length || adding}
              >
                {adding ? "Adding..." : `Add ${addSelected.length || ""} Member${addSelected.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {confirmAction && (
          <div className="gip-confirm-overlay">
            <div className="gip-confirm-box">
              <h3 className="gip-confirm-title">{confirmCopy[confirmAction.type]?.title}</h3>
              <p className="gip-confirm-desc">{confirmCopy[confirmAction.type]?.desc}</p>
              {actionError && <p className="gip-field-error">{actionError}</p>}
              <div className="gip-confirm-actions">
                <button
                  type="button"
                  className="gip-confirm-cancel"
                  onClick={() => {
                    setConfirmAction(null);
                    setActionError("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gip-confirm-danger"
                  onClick={executeConfirm}
                  disabled={actionLoading}
                >
                  {actionLoading ? "..." : confirmCopy[confirmAction.type]?.btn}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
