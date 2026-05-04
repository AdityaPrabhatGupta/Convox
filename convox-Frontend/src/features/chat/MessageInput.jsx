import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MessageInput.css";
import { useMediaUpload } from "../../hooks/useMediaUpload.js";
import MediaPreview from "./MediaPreview.jsx";

const EMOJIS = [
  "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}", "\u{1F605}", "\u{1F923}", "\u{1F602}",
  "\u{1F642}", "\u{1F60A}", "\u{1F607}", "\u{1F60D}", "\u{1F970}", "\u{1F929}", "\u{1F618}", "\u{1F61A}",
  "\u{1F60E}", "\u{1F92A}", "\u{1F60F}", "\u{1F644}", "\u{1F62E}", "\u{1F633}", "\u{1F62D}", "\u{1F622}",
  "\u{1F641}", "\u{1F61E}", "\u{1F620}", "\u{1F621}", "\u{1F44D}", "\u{1F44E}", "\u{1F44F}", "\u{1F64F}",
  "\u{1F91D}", "\u{1F64C}", "\u{1F91F}", "\u{270C}\uFE0F", "\u{1F44A}", "\u{1F4AA}", "\u{1F525}", "\u{2728}",
  "\u{1F389}", "\u{1F496}", "\u{1F497}", "\u{1F498}", "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F49C}",
  "\u{1F49D}", "\u{1F90D}", "\u{1F90E}", "\u{1F495}", "\u{1F4A9}", "\u{1F4AF}", "\u{1F52E}", "\u{1F31F}",
  "\u{1F308}", "\u{2600}\uFE0F", "\u{1F31E}", "\u{1F4A5}", "\u{1F3C6}", "\u{1F3C5}", "\u{1F947}", "\u{1F948}",
  "\u{1F949}", "\u{1F30D}", "\u{1F30E}", "\u{1F30F}", "\u{1F4BB}", "\u{1F680}", "\u{1F3A5}", "\u{1F3B5}",
  "\u{1F381}", "\u{1F4E3}", "\u{1F4E2}", "\u{1F4AC}", "\u{1F4AD}", "\u{1F4A1}", "\u{1F4B0}", "\u{1F4AF}",
  "\u{1F9E1}", "\u{1F9D1}\u200D\u{1F4BB}", "\u{1F468}\u200D\u{1F4BB}", "\u{1F469}\u200D\u{1F4BB}",
  "\u{1F3A8}", "\u{1F3B8}", "\u{1F3C3}", "\u{1F3CA}", "\u{1F680}", "\u{1F6F8}", "\u{1F9D0}", "\u{1F92D}",
];

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconEmoji() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 13s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  );
}

function IconAttach() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="M6 6 18 18" />
    </svg>
  );
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function EmojiPopover({ onSelect, onClose, style }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest?.("[data-emoji-popover]") || target.closest?.("[data-emoji-trigger]")) return;
      onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [onClose]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 100000, pointerEvents: "none" }}>
      <div
        data-emoji-popover
        className="message-emoji-popover"
        role="dialog"
        aria-label="Emoji picker"
        style={style}
      >
        <div className="message-emoji-popover__header">
          <span>Pick an emoji</span>
          <button type="button" className="message-emoji-popover__close" onClick={onClose} aria-label="Close emoji picker">
            <IconClose />
          </button>
        </div>
        <div className="message-emoji-popover__grid">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="message-emoji-popover__btn"
              onClick={() => onSelect(emoji)}
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VoiceRecorderButton({ disabled, onVoiceSend }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [micError, setMicError] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  // Keep ref in sync so the onstop callback reads the latest value
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const reset = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stream?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
    durationRef.current = 0;
  };

  useEffect(() => () => reset(), []);

  const startRecording = async () => {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        onVoiceSend?.({
          blob,
          url,
          duration: durationRef.current,
          mimeType: blob.type,
        });
        reset();
      };

      recorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((value) => value + 1);
      }, 1000);
    } catch {
      setMicError("Microphone access denied. Please allow mic access and try again.");
      reset();
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stop();
  };

  const cancelRecording = () => {
    reset();
  };

  if (recording) {
    return (
      <div className="recording-bar">
        <span className="rec-dot" />
        <span className="rec-time">{formatDuration(duration)}</span>
        <button type="button" className="rec-cancel" onClick={cancelRecording}>
          Cancel
        </button>
        <button type="button" className="rec-send" onClick={stopRecording}>
          Send
        </button>
      </div>
    );
  }

  if (micError) {
    return (
      <span className="input-area__note" style={{ fontSize: "11px", padding: "4px 8px", margin: 0 }}>
        {micError}
        <button type="button" style={{ marginLeft: 6, background: "none", border: "none", color: "inherit", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }} onClick={() => setMicError("")}>
          Dismiss
        </button>
      </span>
    );
  }

  return (
    <button
      className="wa-icon-btn"
      aria-label="Voice message"
      type="button"
      disabled={disabled}
      onClick={startRecording}
      title="Record voice note"
    >
      <IconMic />
    </button>
  );
}

export default function MessageInput({
  onSend,
  onMediaSent,
  onVoiceSend,
  replyTo = null,
  onCancelReply,
  isSending = false,
  disabled = false,
  disabledMessage = "",
  chatId = "",
}) {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiPopoverStyle, setEmojiPopoverStyle] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef(null);
  const composerRef = useRef(null);
  const emojiTriggerRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const {
    preview,
    uploading,
    error: uploadError,
    selectFile,
    clearPreview,
    upload,
  } = useMediaUpload();

  const handleSend = async () => {
    if (disabled) return;

    if (preview) {
      const uploadedMessage = await upload(chatId, setUploadProgress, replyTo?.id);
      setUploadProgress(0);
      if (uploadedMessage) {
        setText("");
        onCancelReply?.();
        onMediaSent?.(uploadedMessage);
      }
      inputRef.current?.focus();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    await onSend?.(trimmed, replyTo?.id);
    setText("");
    onCancelReply?.();
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const updateSelection = () => {
    const input = inputRef.current;
    if (!input) return;
    selectionRef.current = {
      start: input.selectionStart ?? text.length,
      end: input.selectionEnd ?? text.length,
    };
  };

  const insertEmoji = (emoji) => {
    const input = inputRef.current;
    if (!input || disabled) return;

    const { start, end } = selectionRef.current;
    const nextText = `${text.slice(0, start)}${emoji}${text.slice(end)}`;
    const nextCursor = start + emoji.length;

    setText(nextText);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
      selectionRef.current = { start: nextCursor, end: nextCursor };
    });
  };

  const positionEmojiPicker = () => {
    const trigger = emojiTriggerRef.current;
    const composer = composerRef.current;
    if (!trigger || !composer) return;

    const triggerRect = trigger.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    const chatWindowRect = composer.closest(".chat-window")?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    };

    const panelWidth = Math.min(360, Math.max(280, composerRect.width - 64));
    const panelHeight = 360;
    const gutter = 12;
    const left = Math.max(
      chatWindowRect.left + gutter,
      Math.min(
        chatWindowRect.right - panelWidth - gutter,
        triggerRect.left,
      ),
    );

    let top = composerRect.top - panelHeight - 10;
    if (top < chatWindowRect.top + gutter) {
      top = Math.min(
        composerRect.bottom + 10,
        chatWindowRect.bottom - panelHeight - gutter,
      );
    }

    setEmojiPopoverStyle({
      position: "fixed",
      left: `${left}px`,
      top: `${top}px`,
      width: `${panelWidth}px`,
      zIndex: 100001,
      pointerEvents: "auto",
    });
  };

  const openEmojiPicker = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;

    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      return;
    }

    positionEmojiPicker();
    setShowEmojiPicker(true);
  };

  useLayoutEffect(() => {
    if (!showEmojiPicker) return undefined;

    positionEmojiPicker();
    const handleReposition = () => positionEmojiPicker();
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [showEmojiPicker]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="input-area">
      {(preview || uploadError) && (
        <div className="input-area__stack">
          <MediaPreview
            preview={preview}
            onClear={clearPreview}
            uploading={uploading}
            progress={uploadProgress}
          />
          {uploadError ? <div className="input-area__note input-area__note--error">{uploadError}</div> : null}
        </div>
      )}

      {replyTo && (
        <div className="input-reply-preview">
          <div className="input-reply-preview__rail" />
          <div className="input-reply-preview__body">
            <span className="input-reply-preview__label">
              Replying to {replyTo.isMine ? "yourself" : replyTo.senderName || "message"}
            </span>
            <span className="input-reply-preview__text">{replyTo.text || "Attachment"}</span>
          </div>
          <button
            type="button"
            className="input-reply-preview__close"
            onClick={onCancelReply}
            aria-label="Cancel reply"
          >
            <IconClose />
          </button>
        </div>
      )}

      <div className="input-area__composer" ref={composerRef}>
        {/* Left pill: emoji + field + attach + mic */}
        <div className="wa-input-pill">
          {/* Emoji (left inside pill) */}
          <div className="input-emoji-wrap">
            <button
              className="wa-icon-btn"
              aria-label="Emoji"
              aria-expanded={showEmojiPicker}
              type="button"
              disabled={disabled}
              ref={emojiTriggerRef}
              data-emoji-trigger
              onClick={openEmojiPicker}
            >
              <IconEmoji />
            </button>

            {showEmojiPicker && (
              <EmojiPopover
                onSelect={insertEmoji}
                onClose={() => setShowEmojiPicker(false)}
                style={emojiPopoverStyle}
              />
            )}
          </div>

          {/* Text input */}
          <input
            ref={inputRef}
            className="wa-input-field"
            type="text"
            placeholder={disabled ? "Messaging is unavailable" : "Type your message..."}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onClick={updateSelection}
            onKeyUp={updateSelection}
            onSelect={updateSelection}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            disabled={disabled}
          />

          <div className="wa-pill-actions">
            <button
              className="wa-icon-btn"
              aria-label="Attach file"
              type="button"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
              title="Attach file"
            >
              <IconAttach />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              onChange={(event) => {
                if (event.target.files?.[0]) {
                  selectFile(event.target.files[0]);
                }
                event.target.value = "";
              }}
            />
            <VoiceRecorderButton
              disabled={disabled || uploading}
              onVoiceSend={(voiceMessage) => {
                onVoiceSend?.(voiceMessage, replyTo?.id);
                onCancelReply?.();
              }}
            />
          </div>

          {/* Send button (separate circle) */}
          <button
            className="wa-send-btn"
            aria-label="Send message"
            type="button"
            onClick={() => void handleSend()}
            disabled={disabled || (!text.trim() && !preview) || isSending || uploading || (!chatId && !!preview)}
          >
            <IconSend />
          </button>
        </div>

        {disabledMessage && <div className="input-area__note">{disabledMessage}</div>}
      </div>
    </div>
  );
}

