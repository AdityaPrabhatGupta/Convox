function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="M6 6 18 18" />
    </svg>
  );
}

export default function MediaPreview({ preview, onClear, uploading, progress }) {
  if (!preview) return null;

  const { objectUrl, type, file } = preview;

  return (
    <div className="media-preview" role="status" aria-live="polite">
      {type === "image" && (
        <img src={objectUrl} alt="Selected upload preview" className="media-preview__thumb" />
      )}

      {type === "video" && (
        <video src={objectUrl} className="media-preview__thumb" muted />
      )}

      {(type === "audio" || type === "file") && (
        <div className="media-preview__file">
          <span className="media-preview__file-icon" aria-hidden="true">
            {type === "audio" ? "A" : "F"}
          </span>
          <span className="media-preview__file-name">{file.name}</span>
          <span className="media-preview__file-size">{Math.max(1, Math.round(file.size / 1024))} KB</span>
        </div>
      )}

      <div className="media-preview__meta">
        <span className="media-preview__title">{file.name}</span>
        {uploading ? (
          <div className="media-preview__progress-wrap">
            <span className="media-preview__progress-label">Uploading {progress}%</span>
            <div className="media-preview__progress-track">
              <div className="media-preview__progress-bar" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <span className="media-preview__subtitle">Ready to send</span>
        )}
      </div>

      {!uploading && (
        <button
          type="button"
          className="media-preview__clear"
          onClick={onClear}
          aria-label="Remove selected file"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
