/**
 * CallControls.jsx — Bottom control bar for active calls
 * Standalone so it can be tested / reused independently
 * Props: isMuted, isVideoOff, isAudioOnly, isEnded, onMute, onVideo, onEnd
 */
import "./CallScreen.css";

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconVideoOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M15 8H1v12h14V8zM22 8l-6 4 6 4V8z" />
    </svg>
  );
}

function IconPhoneOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.52 2 2 0 0 1 3.62 1.34h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 2.77 4.31z" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export default function CallControls({
  isMuted,
  isVideoOff,
  isAudioOnly,
  speakerLabel = "Speaker",
  speakerActive = false,
  onMute,
  onVideo,
  onSpeaker,
  onEnd,
  muteDisabled = false,
  videoDisabled = false,
  speakerDisabled = false,
}) {
  return (
    <div className="cx-vcs__controls" role="toolbar" aria-label="Call controls">
      {/* Mute */}
      <div className="cx-ctrl">
        <button
          type="button"
          className={`cx-ctrl__btn ${isMuted ? "cx-ctrl__btn--active" : ""}`}
          onClick={onMute}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          aria-pressed={isMuted}
          disabled={muteDisabled}
        >
          {isMuted ? <IconMicOff /> : <IconMic />}
        </button>
        <span className="cx-ctrl__label">{isMuted ? "Unmute" : "Mute"}</span>
      </div>

      {/* Video toggle — hidden for audio-only calls */}
      {!isAudioOnly && (
        <div className="cx-ctrl">
          <button
            type="button"
            className={`cx-ctrl__btn ${isVideoOff ? "cx-ctrl__btn--active" : ""}`}
            onClick={onVideo}
            aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
            aria-pressed={isVideoOff}
            disabled={videoDisabled}
          >
            {isVideoOff ? <IconVideoOff /> : <IconVideo />}
          </button>
          <span className="cx-ctrl__label">{isVideoOff ? "Start Video" : "Stop Video"}</span>
        </div>
      )}

      <div className="cx-ctrl">
        <button
          type="button"
          className={`cx-ctrl__btn ${speakerActive ? "cx-ctrl__btn--active" : ""}`}
          onClick={onSpeaker}
          aria-label="Choose audio output"
          aria-pressed={speakerActive}
          disabled={speakerDisabled}
        >
          <IconSpeaker />
        </button>
        <span className="cx-ctrl__label">{speakerLabel}</span>
      </div>

      {/* End call */}
      <div className="cx-ctrl">
        <button
          type="button"
          className="cx-ctrl__btn cx-ctrl__btn--end"
          onClick={onEnd}
          aria-label="End call"
        >
          <IconPhoneOff />
        </button>
        <span className="cx-ctrl__label">End</span>
      </div>
    </div>
  );
}
