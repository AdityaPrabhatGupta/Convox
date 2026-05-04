import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance.js";
import { saveToken, saveUser } from "../../utils/auth.js";
import {
  ChatBubble,
  Connector,
  ConvoxLogo,
  EyeIcon,
  MobileScrollCue,
  Phone,
  TrustRow,
  TypingDots,
} from "./AuthComponents.jsx";
import "./AuthScreen.css";

const MESSAGES = [
  { id: 1, text: "Hey! Ready to chat on Convox?", side: "left", delay: 0.4 },
  { id: 2, text: "Yep, I just signed in.", side: "right", delay: 1.2 },
  { id: 3, text: "The layout feels really clean.", side: "left", delay: 2.1 },
  { id: 4, text: "And the message flow is smooth!", side: "right", delay: 3.0 },
  { id: 5, text: "Sending you a quick update.", side: "left", delay: 3.9 },
];

const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "").replace(/\/api$/, "");

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 60);

    // Show OAuth error if redirected back from Google with an error
    const oauthError = searchParams.get("oauthError");
    if (oauthError) setError(decodeURIComponent(oauthError));

    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);
      const response = await axiosInstance.post("/api/users/login", {
        email: email.trim(),
        password,
      });

      const token = response.data?.token;
      const user = response.data?.data;

      if (!token) {
        throw new Error("Login succeeded but no token was returned.");
      }

      saveToken(token);
      saveUser(user);

      navigate("/chat", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/api/users/auth/google`;
  };

  return (
    <div className={`login-root${loaded ? " login-root--in" : ""}`}>
      <div className="panel panel--left">
        <div className="blob blob--1" />
        <div className="blob blob--2" />
        <div className="blob blob--3" />

        <div className="logo">
          <ConvoxLogo />
          <span className="logo__name">Convox</span>
        </div>

        <div className="hero-copy">
          <h1 className="hero-headline">Connect.<br />Converse.<br />Create.</h1>
          <p className="hero-sub">Real-time messaging that feels fast, natural, and secure. Join millions of happy users.</p>
        </div>

        <div className="chat-scene">
          <div className="chat-scene__phones">
            <div className="phone-wrap phone-wrap--left">
              <Phone floatOffset="0s" />
            </div>
            <div className="phone-wrap phone-wrap--right">
              <Phone flip floatOffset="0.7s" />
            </div>

            <Connector />
          </div>

          <div className="chat-scene__messages" aria-hidden="true">
            {MESSAGES.map((message) => (
              <ChatBubble key={message.id} {...message} />
            ))}
            <TypingDots delay={5.0} />
          </div>
        </div>

        <MobileScrollCue />
      </div>

      <div className="panel panel--right">
        <div className="ambient ambient--1" />
        <div className="ambient ambient--2" />
        <div className="ambient ambient--3" />
        <div className="form-glow" />

        <div className="glass-card">
          <div className="card-logo">
            <ConvoxLogo />
          </div>

          <h2 className="card-title">Welcome back</h2>
          <p className="card-sub">Sign in to your Convox account</p>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {/* ── Google Button ── */}
          <button
            id="btn-google-login"
            type="button"
            className="btn-google"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleIcon />
            <span>Continue with Google</span>
          </button>

          {/* ── Divider ── */}
          <div className="auth-divider">
            <span className="auth-divider__line" />
            <span className="auth-divider__text">or</span>
            <span className="auth-divider__line" />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field${focusedField === "email" ? " field--focused" : ""}`}>
              <label className="field__label" htmlFor="login-email">Email</label>
              <div className="field__wrap">
                <span className="field__icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input
                  id="login-email"
                  type="email"
                  className="field__input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div className={`field${focusedField === "password" ? " field--focused" : ""}`}>
              <label className="field__label" htmlFor="login-password">Password</label>
              <div className="field__wrap">
                <span className="field__icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  className="field__input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="field__eye"
                  onClick={() => setShowPass((value) => !value)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  <EyeIcon visible={showPass} />
                </button>
              </div>
            </div>

            <button className="btn-signin" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in to Convox"}
              <svg className="btn-signin__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>

          <TrustRow />

          <p className="card-footer">
            Don't have an account?{" "}
            <Link to="/signup" className="card-link">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
