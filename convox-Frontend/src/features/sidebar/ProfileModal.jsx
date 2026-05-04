import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { updateCurrentUserProfile } from "../../services/userService.js";
import "./ProfileModal.css";

const BIO_LIMIT = 30;
const MAX_IMAGE_DIMENSION = 512;
const IMAGE_QUALITY = 0.82;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });

const canvasToDataUrl = (canvas) =>
  new Promise((resolve, reject) => {
    try {
      resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
    } catch {
      reject(new Error("Failed to process image."));
    }
  });

const compressImageFile = async (file) => {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);

  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.width, image.height),
  );

  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to process image.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvasToDataUrl(canvas);
};

export default function ProfileModal({ user, onClose, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profilePic, setProfilePic] = useState(user?.profilePic || "");
  const [photoChanged, setPhotoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setBio(user?.bio || "");
    setProfilePic(user?.profilePic || "");
    setPhotoChanged(false);
    setError("");
  }, [user?._id, user?.name, user?.bio, user?.profilePic]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const previewSrc = useMemo(() => profilePic || "", [profilePic]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    try {
      const nextImage = await compressImageFile(file);
      setProfilePic(nextImage);
      setPhotoChanged(true);
      setError("");
    } catch {
      setError("Could not load that image.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        name,
        bio,
      };

      if (photoChanged) {
        payload.profilePic = profilePic;
      }

      const updatedProfile = await updateCurrentUserProfile(payload);

      onSaved?.(updatedProfile);
      onClose?.();
    } catch (submitError) {
      if (submitError.response?.status === 413) {
        setError("That photo is too large. Try another image.");
      } else {
        setError(
          submitError.response?.data?.message || "Could not update profile.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="profile-modal__backdrop" onClick={onClose} />
      <div className="profile-modal-wrapper" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
        <div className="profile-modal" style={{ width: "min(92vw, 460px)", maxHeight: "90dvh", overflowY: "auto", overflowX: "hidden", flexShrink: 0 }}>
          <div className="profile-modal__header">
          <div>
            <h2 id="profile-modal-title" className="profile-modal__title">{isEditing ? "Edit Profile" : "Profile"}</h2>
            <p className="profile-modal__subtitle">{isEditing ? "Edit your account details" : "Your account details"}</p>
          </div>
          <button type="button" className="profile-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

          <form className="profile-modal__form" onSubmit={isEditing ? handleSubmit : (e) => { e.preventDefault(); setIsEditing(true); }}>
          <div className="profile-modal__avatar-row">
            <div className="profile-modal__avatar">
              {previewSrc ? (
                <img src={previewSrc} alt={name || "Profile"} />
              ) : (
                <span>{(name || user?.email || "U").slice(0, 1).toUpperCase()}</span>
              )}
            </div>

            {isEditing && (
              <div className="profile-modal__avatar-actions">
                <label className="profile-modal__upload-btn">
                  Upload Photo
                  <input type="file" accept="image/*" onChange={handleFileChange} />
                </label>
                {profilePic && (
                  <button
                    type="button"
                    className="profile-modal__ghost-btn"
                    onClick={() => {
                      setProfilePic("");
                      setPhotoChanged(true);
                    }}
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            )}
          </div>

          <label className="profile-modal__field">
            <span className="profile-modal__label">Name</span>
            {isEditing ? (
              <input
                className="profile-modal__input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={50}
                required
              />
            ) : (
              <div className="profile-modal__input profile-modal__input--readonly">
                {name}
              </div>
            )}
          </label>

          <label className="profile-modal__field">
            <span className="profile-modal__label">Bio</span>
            {isEditing ? (
              <>
                <textarea
                  className="profile-modal__textarea"
                  value={bio}
                  onChange={(event) => setBio(event.target.value.slice(0, BIO_LIMIT))}
                  maxLength={BIO_LIMIT}
                  rows={2}
                  placeholder="Designer, coder, night owl"
                />
                <small className="profile-modal__char-hint">{bio.length}/{BIO_LIMIT}</small>
              </>
            ) : (
              <div className="profile-modal__textarea profile-modal__input--readonly">
                {bio || "No bio added."}
              </div>
            )}
          </label>

          <label className="profile-modal__field">
            <span className="profile-modal__label">Email</span>
            {isEditing ? (
              <input className="profile-modal__input" type="email" value={user?.email || ""} disabled style={{ cursor: "not-allowed" }} />
            ) : (
              <div className="profile-modal__input profile-modal__input--readonly">
                {user?.email || ""}
              </div>
            )}
          </label>

          {error && <div className="profile-modal__error">{error}</div>}

          <div className="profile-modal__actions">
            {isEditing ? (
              <>
                <button type="button" className="profile-modal__ghost-btn" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="profile-modal__save-btn" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            ) : (
              <button type="button" className="profile-modal__save-btn" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            )}
          </div>
          </form>
        </div>
      </div>
    </>,
    document.body,
  );
}
