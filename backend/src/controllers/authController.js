import asyncHandler from "../utils/asyncHandler.js";
import { User } from "../models/index.js";
import { createOnboardingConversation } from "../services/assistantSeeder.js";
import {
  cacheDelete,
  cacheGetJson,
  cacheKeys,
  cacheSetJson,
  CACHE_TTLS,
} from "../config/redis.js";
import logger from "../config/logger.js";
import {
  compareToken,
  getRefreshCookieOptions,
  getRefreshTokenExpiryDate,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  profilePic: user.profilePic,
  bio: user.bio,
  lastSeen: user.lastSeen,
  removedUsers: user.removedUsers,
  createdAt: user.createdAt,
});

function getRedirectBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/$/, "");
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");
  if (req) {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.get("host");
    if (host) return `${protocol}://${host}`;
  }
  return "http://localhost:5000";
}

async function fetchGoogleProfile(code, req) {
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: `${getRedirectBaseUrl(req)}/api/users/auth/google/callback`,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
  }

  const { access_token } = await tokenRes.json();
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  return profileRes.json();
}

async function issueSession(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokenHash = await hashToken(refreshToken);
  user.refreshTokenExpiresAt = getRefreshTokenExpiryDate();
  await user.save();

  res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());
  await cacheDelete(cacheKeys.userProfile(String(user._id)));

  return {
    token: accessToken,
    data: publicUser(user),
  };
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", getRefreshCookieOptions());
}

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide all the required fields");
  }

  if (password.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters");
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    res.status(400);
    throw new Error("An account with this email already exists");
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    password,
  });

  const payload = await issueSession(res, user);

  res.status(201).json({
    success: true,
    message: "Account created successfully",
    ...payload,
  });

  createOnboardingConversation(user._id).catch((error) => {
    logger.error("Onboarding conversation creation failed", { error: error.message, userId: String(user._id) });
  });
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please provide email and password");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +refreshTokenHash +refreshTokenExpiresAt");
  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (!user.password) {
    res.status(401);
    throw new Error("This account uses Google sign-in. Please continue with Google.");
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const payload = await issueSession(res, user);

  res.status(200).json({
    success: true,
    message: "Login successful",
    ...payload,
  });
});

export const refreshSession = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401);
    throw new Error("Refresh token missing");
  }

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenExpiresAt");

  if (!user?.refreshTokenHash) {
    res.status(401);
    throw new Error("Session not found");
  }

  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() < Date.now()) {
    res.status(401);
    throw new Error("Refresh token expired");
  }

  const matches = await compareToken(refreshToken, user.refreshTokenHash);
  if (!matches) {
    res.status(401);
    throw new Error("Refresh token invalid");
  }

  const payload = await issueSession(res, user);

  res.status(200).json({
    success: true,
    message: "Session refreshed",
    ...payload,
  });
});

export const logoutUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await User.findByIdAndUpdate(decoded.id, {
        $set: {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null,
        },
      });
    } catch {
      // Clear cookie even if token is already invalid.
    }
  }

  clearRefreshCookie(res);
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

export const getUserProfile = asyncHandler(async (req, res) => {
  const cacheKey = cacheKeys.userProfile(String(req.user._id));
  const cached = await cacheGetJson(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  const payload = {
    success: true,
    data: publicUser(req.user),
  };

  await cacheSetJson(cacheKey, payload, CACHE_TTLS.user);
  res.status(200).json(payload);
});

export const googleAuth = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${getRedirectBaseUrl(req)}/api/users/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

export const googleCallback = asyncHandler(async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    res.redirect(`${clientUrl}/login?error=google_denied`);
    return;
  }

  try {
    const profile = await fetchGoogleProfile(code, req);
    const { id: googleId, email, name, picture } = profile;

    if (!email) {
      res.redirect(`${clientUrl}/login?error=no_email`);
      return;
    }

    let user = await User.findOne({ googleId }).select("+refreshTokenHash +refreshTokenExpiresAt");

    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() }).select("+refreshTokenHash +refreshTokenExpiresAt");

      if (user) {
        user.googleId = googleId;
        if (!user.profilePic && picture) user.profilePic = picture;
        await user.save();
      } else {
        user = await User.create({
          name,
          email: email.toLowerCase(),
          googleId,
          profilePic: picture || null,
          password: null,
        });

        createOnboardingConversation(user._id).catch((onboardingError) => {
          logger.error("Google onboarding conversation failed", {
            error: onboardingError.message,
            userId: String(user._id),
          });
        });
      }
    }

    const payload = await issueSession(res, user);
    const userData = encodeURIComponent(JSON.stringify(payload.data));
    res.redirect(`${clientUrl}/auth/callback?token=${payload.token}&user=${userData}`);
  } catch (googleError) {
    logger.error("Google OAuth callback failed", { error: googleError.message });
    res.redirect(`${clientUrl}/login?error=google_failed`);
  }
});
