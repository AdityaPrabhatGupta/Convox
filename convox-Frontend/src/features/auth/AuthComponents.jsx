import { useId } from "react";

export function ConvoxLogo() {
  const gradientId = useId();
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#ec4899" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#${gradientId})`} fillOpacity="0.16" />
      <path
        d="M6 8C6 6.895 6.895 6 8 6H22C23.105 6 24 6.895 24 8V18C24 19.105 23.105 20 22 20H17.5L13 25V20H8C6.895 20 6 19.105 6 18V8Z"
        fill={`url(#${gradientId})`}
        fillOpacity="0.28"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 8.5L14.5 14H17L14 20.5"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TypingDots({ delay }) {
  return (
    <div className="typing-bubble" style={{ animationDelay: `${delay}s` }} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function ChatBubble({ text, side, delay }) {
  return (
    <div
      className={`chat-bubble chat-bubble--${side}`}
      style={{ animationDelay: `${delay}s` }}
    >
      {text}
    </div>
  );
}

export function Phone({ flip = false, floatOffset = "0s" }) {
  return (
    <div
      className="phone"
      style={{
        "--float-delay": floatOffset,
        transform: flip ? "scaleX(-1)" : "none",
      }}
      aria-hidden="true"
    >
      <div className="phone__screen">
        <div className="phone__bar" />
        <div className="phone__bar phone__bar--short" />
        <div className="phone__bar" />
        <div className="phone__bar phone__bar--short" />
        <div className="phone__bar" />
      </div>
    </div>
  );
}

export function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function Connector() {
  return (
    <div className="connector">
      <div className="connector__line" />
      <div className="connector__dot connector__dot--1" />
      <div className="connector__dot connector__dot--2" />
      <div className="connector__dot connector__dot--3" />
    </div>
  );
}

export function MobileScrollCue() {
  return (
    <div className="mobile-scroll-cue" aria-hidden="true">
      <span>Scroll to continue</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14" />
        <path d="M19 12l-7 7-7-7" />
      </svg>
    </div>
  );
}

export function TrustRow() {
  return (
    <div className="trust-row">
      <span>Fast</span>
      <span className="trust-sep">•</span>
      <span>Secure</span>
      <span className="trust-sep">•</span>
      <span>Private</span>
    </div>
  );
}

export function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 00-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

export function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="3" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function Spinner() {
  return (
    <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
