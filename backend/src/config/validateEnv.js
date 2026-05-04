const REQUIRED_ENV_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GROQ_API_KEY",
];

export function validateRequiredEnv() {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());

  if (!missing.length) return;

  const error = new Error(
    `Missing required environment variables: ${missing.join(", ")}`,
  );
  error.code = "ENV_VALIDATION_ERROR";
  throw error;
}
