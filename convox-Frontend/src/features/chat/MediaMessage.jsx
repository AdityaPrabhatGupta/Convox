function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaMessage({ message }) {
  const { type, mediaUrl, fileName, fileSize } = message;

  if (type === "image") {
    return (
      <button
        type="button"
        className="media-message media-message--image media-message__image-button"
        onClick={() => message.onOpenImage?.(message)}
      >
        <img src={mediaUrl} alt={fileName || "Shared image"} className="media-message__image" />
      </button>
    );
  }

  if (type === "video") {
    return (
      <video controls src={mediaUrl} className="media-message media-message--video" preload="metadata">
        Your browser does not support video.
      </video>
    );
  }

  if (type === "audio") {
    return (
      <audio controls src={mediaUrl} className="media-message media-message--audio" preload="metadata">
        Your browser does not support audio playback.
      </audio>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      download={fileName || true}
      className="media-message media-message--file"
    >
      <span className="media-message__file-icon" aria-hidden="true">F</span>
      <span className="media-message__file-copy">
        <span className="media-message__file-name">{fileName || "Attachment"}</span>
        {fileSize ? <span className="media-message__file-size">{formatSize(fileSize)}</span> : null}
      </span>
    </a>
  );
}
