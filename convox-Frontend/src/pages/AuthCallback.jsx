import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { saveToken, saveUser } from "../utils/auth.js";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const token = searchParams.get("token");
    const userRaw = searchParams.get("user");
    const error = searchParams.get("error");

    if (error || !token) {
      const messages = {
        google_denied: "Google sign-in was cancelled.",
        no_email: "No email address was returned from Google.",
        google_failed: "Google sign-in failed. Please try again.",
      };
      navigate(`/login?oauthError=${encodeURIComponent(messages[error] || "Google sign-in failed.")}`, {
        replace: true,
      });
      return;
    }

    saveToken(token);

    if (userRaw) {
      try {
        saveUser(JSON.parse(decodeURIComponent(userRaw)));
      } catch {
        // Non-fatal. The app can fetch the profile after login.
      }
    }

    navigate("/chat", { replace: true });
  }, [navigate, searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f0c29, #302b63, #24243e)",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
        gap: "1.25rem",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        style={{ animation: "spin 0.8s linear infinite" }}
        aria-hidden="true"
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <circle cx="24" cy="24" r="20" stroke="rgba(139,92,246,0.25)" strokeWidth="4" />
        <path
          d="M24 4a20 20 0 0120 20"
          stroke="#8b5cf6"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>
        Signing you in...
      </p>
    </div>
  );
}
