import "./CallButton.css";

function VideoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.52 2 2 0 0 1 3.62 1.34h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export default function CallButton({ onVideoCall, onAudioCall, disabled = false }) {
  if (disabled) return null;

  return (
    <>
      <button
        type="button"
        className="call-btn ig-header__icon-btn"
        onClick={onAudioCall}
        aria-label="Start voice call"
        title="Voice call"
      >
        <PhoneIcon />
      </button>
      <button
        type="button"
        className="call-btn ig-header__icon-btn"
        onClick={onVideoCall}
        aria-label="Start video call"
        title="Video call"
      >
        <VideoIcon />
      </button>
    </>
  );
}
