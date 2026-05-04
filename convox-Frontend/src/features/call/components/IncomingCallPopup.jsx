/**
 * IncomingCallPopup.jsx — WhatsApp-style incoming call screen
 * Reuses: cx-* CSS tokens, cx-ripple-ring animation, cx-call-action-btn
 * Behavior: auto-rejects after 30s, shows call type badge, ripple avatar,
 *           plays classic two-burst ringtone via Web Audio API.
 */
import { useEffect, useRef } from "react";
import "./CallScreen.css";

/* ── Icons ──────────────────────────────────────────────────── */
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.52 2 2 0 0 1 3.62 1.34h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.52 2 2 0 0 1 3.62 1.34h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9a16 16 0 0 0 2.77 4.31z" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function getInitials(name = "") {
  return (name || "?")
    .trim()
    .split(" ")
    .map((w) => w[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

/* ── Incoming ringtone — Web Audio API, no file needed ────────
   Pattern: BRRRING … BRRRING … (2s silence) … repeat every 4s
   Each "BRRRING" = two 480 Hz sine + 960 Hz square blended bursts,
   0.4 s on / 0.2 s off, giving a classic telephone timbre.
──────────────────────────────────────────────────────────────── */
function useIncomingRingtone() {
  useEffect(() => {
    let stopped = false;
    let interval;

    /**
     * Play one BRRRING burst starting at `startTime` on the given AudioContext.
     * Uses a sine + subtle square mix for that classic "telephone bell" colour.
     */
    const playBurst = (ctx, startTime) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainMix = ctx.createGain(); // square wave level
      const gain = ctx.createGain();    // master envelope

      osc1.type = "sine";
      osc1.frequency.value = 480;

      osc2.type = "square";
      osc2.frequency.value = 960;
      gainMix.gain.value = 0.06; // blend square very softly

      osc1.connect(gain);
      osc2.connect(gainMix);
      gainMix.connect(gain);
      gain.connect(ctx.destination);

      const t = startTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.02); // fast attack
      gain.gain.setValueAtTime(0.28, t + 0.36);           // sustain
      gain.gain.linearRampToValueAtTime(0, t + 0.42);     // fast release

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.45);
      osc2.stop(t + 0.45);
    };

    const ring = () => {
      if (stopped) return;
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;
        playBurst(ctx, now);        // BRRRING #1 starts immediately
        playBurst(ctx, now + 0.65); // BRRRING #2 starts 0.65 s later
        // Close context after both bursts finish (~1.2 s total audio)
        setTimeout(() => {
          try { ctx.close(); } catch { /* ignore */ }
        }, 1800);
      } catch {
        // AudioContext may be blocked before first user gesture — fail silently
      }
    };

    // Ring immediately on mount, then repeat every 4 seconds
    ring();
    interval = setInterval(ring, 4000);

    // Cleanup: popup unmounts when user accepts/declines, stops sound instantly
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []); // run once per popup mount
}

/* ── Component ───────────────────────────────────────────────── */
export default function IncomingCallPopup({
  callerName,
  callerAvatar = null,
  callType = "video",
  onAccept,
  onReject,
}) {
  const onRejectRef = useRef(onReject);
  useEffect(() => { onRejectRef.current = onReject; }, [onReject]);

  /* Play incoming ringtone while the popup is visible */
  useIncomingRingtone();

  /* Auto-reject after 30 s if no answer */
  useEffect(() => {
    const timer = setTimeout(() => onRejectRef.current?.(), 30_000);
    return () => clearTimeout(timer);
  }, []);

  const isVideo = callType === "video";

  return (
    <div className="cx-icp" role="dialog" aria-modal="true" aria-label="Incoming call">

      {/* Call type badge */}
      <p className="cx-icp__type-badge">
        {isVideo ? <VideoIcon /> : <PhoneIcon />}
        {isVideo ? "Incoming video call" : "Incoming voice call"}
      </p>

      {/* Avatar with ripple rings */}
      <div className="cx-avatar-wrap" aria-hidden="true">
        <div className="cx-ripple-ring" />
        <div className="cx-ripple-ring" />
        <div className="cx-ripple-ring" />
        <div className="cx-avatar">
          {callerAvatar
            ? <img src={callerAvatar} alt={callerName} />
            : getInitials(callerName)
          }
        </div>
      </div>

      {/* Name */}
      <h2 className="cx-caller-name">{callerName || "Unknown"}</h2>

      {/* Animated status */}
      <p className="cx-call-status-text">
        <span className="cx-dot-anim">
          Ringing<span>.</span><span>.</span><span>.</span>
        </span>
      </p>

      {/* Accept / Decline */}
      <div className="cx-icp__actions">
        <div className="cx-icp__btn-group">
          <button
            type="button"
            className="cx-call-action-btn cx-call-action-btn--reject"
            onClick={onReject}
            aria-label="Reject call"
          >
            <PhoneOffIcon />
          </button>
          <span className="cx-icp__btn-label">Decline</span>
        </div>

        <div className="cx-icp__btn-group">
          <button
            type="button"
            className="cx-call-action-btn cx-call-action-btn--accept"
            onClick={onAccept}
            aria-label="Accept call"
          >
            <PhoneIcon />
          </button>
          <span className="cx-icp__btn-label">Accept</span>
        </div>
      </div>
    </div>
  );
}
