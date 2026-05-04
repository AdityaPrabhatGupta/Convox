/**
 * VideoCallScreen.jsx — WhatsApp-style active call screen
 * Handles: calling, ringing, connecting, connected, ended states
 * Reuses: CallControls, cx-vcs__* CSS, Convox design tokens
 */
import { useEffect, useState } from "react";
import { CALL_STATUS } from "../hooks/useCall.js";
import CallControls from "./CallControls.jsx";
import "./CallScreen.css";

/* ── Helpers ──────────────────────────────────────────────────── */
function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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

function getAudioOutputApiSupport() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.enumerateDevices === "function" &&
    typeof window !== "undefined" &&
    typeof window.HTMLMediaElement !== "undefined" &&
    "setSinkId" in window.HTMLMediaElement.prototype
  );
}

function getReadableOutputLabel(device, index) {
  if (device.deviceId === "default") return "Phone speaker";
  if (device.label?.trim()) return device.label.trim();
  return `Speaker ${index + 1}`;
}

/* Status label map — CALLING is dynamic based on target online state */
const STATUS_LABEL = {
  [CALL_STATUS.CALLING]:    "Calling",
  [CALL_STATUS.RINGING]:    "Ringing",
  [CALL_STATUS.CONNECTING]: "Connecting",
  [CALL_STATUS.CONNECTED]:  "Connected",
  [CALL_STATUS.ENDED]:      "Call ended",
};

/* ── Ringback tone via Web Audio API (no file needed) ── */
function useRingbackTone(active) {
  useEffect(() => {
    if (!active) return undefined;

    let ctx;
    let interval;
    let stopped = false;

    const playRing = () => {
      if (stopped) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const now = ctx.currentTime;

        // Two-tone Indian ringback: 400 Hz + 450 Hz, 0.4s on / 0.2s off
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.value = 400;
        osc2.type = "sine";
        osc2.frequency.value = 450;

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
        gainNode.gain.setValueAtTime(0.18, now + 0.38);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.42);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } catch {
        // Browser may block AudioContext without user gesture — fail silently
      }
    };

    // First ring immediately, then every 2 seconds
    playRing();
    interval = setInterval(playRing, 2000);

    return () => {
      stopped = true;
      clearInterval(interval);
      try { ctx?.close(); } catch { /* ignore */ }
    };
  }, [active]);
}

/* Icons */
function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
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

/* ── Component ────────────────────────────────────────────────── */
export default function VideoCallScreen({
  callStatus,
  callType,
  remoteUser,
  isMuted,
  isVideoOff,
  callDuration,
  callError,
  localVideoRef,
  remoteVideoRef,
  isTargetOnline,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}) {
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isOutputPickerOpen, setIsOutputPickerOpen] = useState(false);
  const [outputDevices, setOutputDevices] = useState([]);
  const [selectedOutputId, setSelectedOutputId] = useState("default");
  const [outputError, setOutputError] = useState("");
  const [isSwitchingOutput, setIsSwitchingOutput] = useState(false);
  const outputSwitchSupported = getAudioOutputApiSupport();

  // Play ringback tone only while we're waiting for the call to be answered
  useRingbackTone(callStatus === CALL_STATUS.CALLING);

  useEffect(() => {
    const node = remoteVideoRef?.current;
    if (!node) {
      setHasRemoteVideo(false);
      return undefined;
    }

    const syncRemoteVideo = () => {
      const stream = node.srcObject;
      const hasLiveVideoTrack = Boolean(
        stream &&
        typeof stream.getVideoTracks === "function" &&
        stream.getVideoTracks().some((track) => track.readyState === "live"),
      );
      const ready =
        node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        !node.paused &&
        !node.ended;

      setHasRemoteVideo(hasLiveVideoTrack && ready);
    };

    syncRemoteVideo();
    node.addEventListener("loadeddata", syncRemoteVideo);
    node.addEventListener("playing", syncRemoteVideo);
    node.addEventListener("pause", syncRemoteVideo);
    node.addEventListener("emptied", syncRemoteVideo);
    node.addEventListener("ended", syncRemoteVideo);

    return () => {
      node.removeEventListener("loadeddata", syncRemoteVideo);
      node.removeEventListener("playing", syncRemoteVideo);
      node.removeEventListener("pause", syncRemoteVideo);
      node.removeEventListener("emptied", syncRemoteVideo);
      node.removeEventListener("ended", syncRemoteVideo);
    };
  }, [callStatus, remoteVideoRef, remoteUser?.id]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setOutputDevices([]);
      return undefined;
    }

    let isActive = true;

    const syncOutputDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!isActive) return;

        const audioOutputs = devices.filter((device) => device.kind === "audiooutput");
        const withDefault = audioOutputs.some((device) => device.deviceId === "default")
          ? audioOutputs
          : [{ deviceId: "default", kind: "audiooutput", label: "Phone speaker" }, ...audioOutputs];

        setOutputDevices(withDefault);
      } catch {
        if (!isActive) return;
        setOutputDevices([{ deviceId: "default", kind: "audiooutput", label: "Phone speaker" }]);
      }
    };

    syncOutputDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", syncOutputDevices);

    return () => {
      isActive = false;
      navigator.mediaDevices.removeEventListener?.("devicechange", syncOutputDevices);
    };
  }, []);

  useEffect(() => {
    if (!outputDevices.length) return;
    if (outputDevices.some((device) => device.deviceId === selectedOutputId)) return;
    setSelectedOutputId("default");
  }, [outputDevices, selectedOutputId]);

  const isConnected  = callStatus === CALL_STATUS.CONNECTED;
  const isEnded      = callStatus === CALL_STATUS.ENDED;
  const isAudioOnly  = callType === "audio";
  const showAvatar   = isAudioOnly || !isConnected || !hasRemoteVideo;
  const showControls = !isEnded;
  const canToggleMedia = callStatus !== CALL_STATUS.ENDED;
  const activeOutput = outputDevices.find((device) => device.deviceId === selectedOutputId) || null;
  const speakerLabel = activeOutput ? getReadableOutputLabel(activeOutput, 0) : "Speaker";
  const compactSpeakerLabel = speakerLabel.length > 10 ? "Output" : speakerLabel;

  const handleOpenSpeakerPicker = () => {
    setOutputError("");
    setIsOutputPickerOpen(true);
  };

  const handleCloseSpeakerPicker = () => {
    if (isSwitchingOutput) return;
    setIsOutputPickerOpen(false);
  };

  const handleSelectAudioOutput = async (deviceId) => {
    if (isSwitchingOutput) return;

    if (!outputSwitchSupported) {
      setOutputError("This browser does not support switching speakers inside the call. Use your system sound settings.");
      return;
    }

    const mediaNode = remoteVideoRef?.current;
    if (!mediaNode || typeof mediaNode.setSinkId !== "function") {
      setOutputError("The call audio output is not ready yet. Try again in a moment.");
      return;
    }

    try {
      setIsSwitchingOutput(true);
      setOutputError("");
      await mediaNode.setSinkId(deviceId);
      setSelectedOutputId(deviceId);
      setIsOutputPickerOpen(false);
    } catch (error) {
      if (error?.name === "NotAllowedError") {
        setOutputError("Your browser blocked speaker switching. Allow audio device access and try again.");
      } else {
        setOutputError(error?.message || "Could not switch the speaker output.");
      }
    } finally {
      setIsSwitchingOutput(false);
    }
  };

  const initials = getInitials(remoteUser?.name);
  // Dynamic status: when CALLING and target is online → "Ringing", else "Calling"
  const callingLabel = (callStatus === CALL_STATUS.CALLING && isTargetOnline) ? "Ringing" : STATUS_LABEL[CALL_STATUS.CALLING];
  const statusLabel = callStatus === CALL_STATUS.CALLING ? callingLabel : (STATUS_LABEL[callStatus] || callStatus);

  return (
    <div className="cx-vcs" role="dialog" aria-modal="true" aria-label="Active call">

      {/* ── Remote video (full background) ── */}
      <div className="cx-vcs__remote-wrap">
        <video
          ref={remoteVideoRef}
          className={`cx-vcs__remote-video ${showAvatar ? "cx-vcs__remote-video--hidden" : ""}`}
          autoPlay
          playsInline
        />

        {/* Avatar placeholder — shows when no video or audio-only */}
        {showAvatar && (
          <div className="cx-vcs__placeholder" aria-hidden="true">
            <div className="cx-avatar-wrap">
              {/* Ripple rings only when not ended */}
              {!isEnded && (
                <>
                  <div className="cx-ripple-ring" />
                  <div className="cx-ripple-ring" />
                  <div className="cx-ripple-ring" />
                </>
              )}
              <div className="cx-avatar">{initials}</div>
            </div>

            <h2 className="cx-caller-name">{remoteUser?.name || "Unknown"}</h2>

            <p className="cx-call-status-text">
              {(callStatus === CALL_STATUS.CALLING || callStatus === CALL_STATUS.RINGING) ? (
                <span className="cx-dot-anim">
                  {statusLabel}<span>.</span><span>.</span><span>.</span>
                </span>
              ) : statusLabel}
            </p>
          </div>
        )}
      </div>

      {/* Local video PiP (top-right) — video calls only */}
      {!isAudioOnly && !isEnded && (
        <div className={`cx-vcs__local-pip ${isVideoOff ? "cx-vcs__local-pip--faded" : ""}`}>
          <video ref={localVideoRef} autoPlay playsInline muted />
          {isVideoOff && (
            <div className="cx-vcs__local-pip__off" aria-label="Camera is off">
              <IconVideoOff />
            </div>
          )}
        </div>
      )}

      {/* Audio-only: hidden video track keeps WebRTC happy — no visible pip */}
      {isAudioOnly && !isEnded && (
        <video ref={localVideoRef} autoPlay playsInline muted style={{ display: "none" }} />
      )}

      {/* ── Top bar (name + status + timer) ── */}
      {isConnected && !isEnded && (
        <div className="cx-vcs__topbar">
          <div className="cx-vcs__identity">
            <span className="cx-vcs__name">{remoteUser?.name || "Unknown"}</span>
            <span className="cx-vcs__status cx-vcs__status--connected">Connected</span>
          </div>
          <span className="cx-vcs__timer" aria-live="off">
            {formatDuration(callDuration)}
          </span>
        </div>
      )}

      {/* ── Error toast ── */}
      {callError && (
        <div className="cx-vcs__error" role="alert">{callError}</div>
      )}

      {/* ── Call ended overlay ── */}
      {isEnded && (
        <div className="cx-vcs__ended-overlay" aria-live="assertive">
          <div className="cx-vcs__ended-icon" aria-hidden="true">
            <IconPhoneOff />
          </div>
          <p className="cx-vcs__ended-title">
            {remoteUser?.name ? `Call with ${remoteUser.name} ended` : "Call ended"}
          </p>
          {callError && (
            <p className="cx-vcs__ended-sub">{callError}</p>
          )}
        </div>
      )}

      {/* ── Controls bar ── */}
      {showControls && (
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isAudioOnly={isAudioOnly}
          speakerLabel={compactSpeakerLabel}
          speakerActive={isOutputPickerOpen}
          onMute={onToggleMute}
          onVideo={onToggleVideo}
          onSpeaker={handleOpenSpeakerPicker}
          onEnd={onEndCall}
          muteDisabled={!canToggleMedia}
          videoDisabled={!canToggleMedia}
          speakerDisabled={isEnded}
        />
      )}

      {isOutputPickerOpen && (
        <>
          <button
            type="button"
            className="cx-vcs__sheet-backdrop"
            aria-label="Close speaker options"
            onClick={handleCloseSpeakerPicker}
          />
          <div className="cx-vcs__sheet" role="dialog" aria-modal="true" aria-label="Audio output">
            <div className="cx-vcs__sheet-handle" aria-hidden="true" />
            <div className="cx-vcs__sheet-header">
              <div>
                <p className="cx-vcs__sheet-eyebrow">Audio output</p>
                <h3 className="cx-vcs__sheet-title">Choose where call audio plays</h3>
              </div>
              <button
                type="button"
                className="cx-vcs__sheet-close"
                onClick={handleCloseSpeakerPicker}
                aria-label="Close audio output picker"
              >
                x
              </button>
            </div>

            {!outputSwitchSupported ? (
              <div className="cx-vcs__sheet-empty">
                <p>This browser can play the call audio, but it cannot switch speakers from inside the app.</p>
                <p>Use your device or browser sound settings to move audio to speaker, headphones, or Bluetooth.</p>
              </div>
            ) : (
              <div className="cx-vcs__sheet-list" role="list">
                {outputDevices.map((device, index) => {
                  const isSelected = device.deviceId === selectedOutputId;
                  return (
                    <button
                      key={device.deviceId || `output-${index}`}
                      type="button"
                      className={`cx-vcs__sheet-option ${isSelected ? "cx-vcs__sheet-option--selected" : ""}`}
                      onClick={() => handleSelectAudioOutput(device.deviceId)}
                      disabled={isSwitchingOutput}
                    >
                      <span className="cx-vcs__sheet-option-copy">
                        <span className="cx-vcs__sheet-option-title">{getReadableOutputLabel(device, index)}</span>
                        <span className="cx-vcs__sheet-option-sub">
                          {device.deviceId === "default" ? "System default output" : "Available audio device"}
                        </span>
                      </span>
                      <span className="cx-vcs__sheet-option-mark" aria-hidden="true">
                        {isSelected ? "●" : "○"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {outputError && <p className="cx-vcs__sheet-error" role="alert">{outputError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
