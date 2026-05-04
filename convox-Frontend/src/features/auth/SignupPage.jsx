import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance.js";
import { saveToken, saveUser } from "../../utils/auth.js";
import {
  ChatBubble,
  Connector,
  ConvoxLogo,
  EmailIcon,
  EyeIcon,
  LockIcon,
  MobileScrollCue,
  Phone,
  Spinner,
  TrustRow,
  TypingDots,
  UserIcon,
} from "./AuthComponents.jsx";
import "./AuthScreen.css";

const MESSAGES = [
  { id: 1, text: "Create your Convox account", side: "left", delay: 0.4 },
  { id: 2, text: "Set up your profile in a few seconds.", side: "right", delay: 1.2 },
  { id: 3, text: "Everything stays clean and simple.", side: "left", delay: 2.1 },
  { id: 4, text: "You'll be ready to chat right away.", side: "right", delay: 3.0 },
  { id: 5, text: "Let's get you started.", side: "left", delay: 3.9 },
];

const validateField = (field, value) => {
  const trimmed = value.trim();

  if (field === "name") {
    if (!trimmed) return "Name is required.";
    if (trimmed.length < 2) return "Name must be at least 2 characters.";
  }

  if (field === "email") {
    if (!trimmed) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Enter a valid email address.";
  }

  if (field === "password") {
    if (!trimmed) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
  }

  return "";
};

const validateForm = (values) => ({
  name: validateField("name", values.name),
  email: validateField("email", values.email),
  password: validateField("password", values.password),
});

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

export default function SignupPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({ name: "", email: "", password: "" });
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  const handleChange = (field) => (event) => {
    const nextValue = event.target.value;
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    setApiError("");

    setFieldErrors((prev) => {
      const nextError = validateField(field, nextValue);
      if (!nextError) {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      }
      return { ...prev, [field]: nextError };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setApiError("");

    const nextErrors = validateForm(values);
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    try {
      setLoading(true);
      const response = await axiosInstance.post("/api/users/register", {
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      const token = response.data?.token;
      const user = response.data?.data;

      if (!token) {
        throw new Error("Signup succeeded but no token was returned.");
      }

      saveToken(token);
      saveUser(user);

      navigate("/chat", { replace: true });
    } catch (error) {
      setApiError(error.response?.data?.message || error.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
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
          <h1 className="hero-headline">Start.<br />Build.<br />Belong.</h1>
          <p className="hero-sub">Create your account and join conversations that feel instant and natural.</p>
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

          <h2 className="card-title">Create account</h2>
          <p className="card-sub">Join Convox and start chatting</p>

          {apiError && (
            <div className="login-error" role="alert">
              {apiError}
            </div>
          )}

          {/* ── Google Button ── */}
          <button
            id="btn-google-signup"
            type="button"
            className="btn-google"
            onClick={handleGoogleSignup}
            disabled={loading}
          >
            <GoogleIcon />
            <span>Sign up with Google</span>
          </button>

          {/* ── Divider ── */}
          <div className="auth-divider">
            <span className="auth-divider__line" />
            <span className="auth-divider__text">or</span>
            <span className="auth-divider__line" />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field${focusedField === "name" ? " field--focused" : ""}`}>
              <label className="field__label" htmlFor="signup-name">Name</label>
              <div className="field__wrap">
                <span className="field__icon">
                  <UserIcon />
                </span>
                <input
                  id="signup-name"
                  type="text"
                  className="field__input"
                  value={values.name}
                  onChange={handleChange("name")}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your full name"
                  autoComplete="name"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "signup-name-error" : undefined}
                />
              </div>
              {fieldErrors.name && (
                <p id="signup-name-error" className="form-field__error">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div className={`field${focusedField === "email" ? " field--focused" : ""}`}>
              <label className="field__label" htmlFor="signup-email">Email</label>
              <div className="field__wrap">
                <span className="field__icon">
                  <EmailIcon />
                </span>
                <input
                  id="signup-email"
                  type="email"
                  className="field__input"
                  value={values.email}
                  onChange={handleChange("email")}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "signup-email-error" : undefined}
                />
              </div>
              {fieldErrors.email && (
                <p id="signup-email-error" className="form-field__error">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className={`field${focusedField === "password" ? " field--focused" : ""}`}>
              <label className="field__label" htmlFor="signup-password">Password</label>
              <div className="field__wrap">
                <span className="field__icon">
                  <LockIcon />
                </span>
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  className="field__input"
                  value={values.password}
                  onChange={handleChange("password")}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "signup-password-error" : undefined}
                />
                <button
                  type="button"
                  className="field__eye"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  <EyeIcon visible={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p id="signup-password-error" className="form-field__error">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button className="btn-signin" type="submit" disabled={loading}>
              {loading ? <Spinner /> : "Create account"}
              {!loading && (
                <svg className="btn-signin__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </form>

          <TrustRow />

          <p className="card-footer">
            Already have an account?{" "}
            <Link to="/login" className="card-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
