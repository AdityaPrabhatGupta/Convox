import path from "path";

const LIMITS = {
  image: 5 * 1024 * 1024,
  video: 10 * 1024 * 1024,
  audio: 10 * 1024 * 1024,
  file: 5 * 1024 * 1024,
};

const ALLOWED_MIME = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"],
  file: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
};

export function getMediaType(mimetype = "") {
  for (const [type, mimes] of Object.entries(ALLOWED_MIME)) {
    if (mimes.includes(mimetype)) return type;
  }

  return null;
}

const ALLOWED_EXTENSIONS = {
  image: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  video: [".mp4", ".webm", ".mov"],
  audio: [".mp3", ".wav", ".ogg", ".weba", ".webm", ".m4a"],
  file: [".pdf", ".doc", ".docx", ".txt"],
};

export function validateFile(file) {
  const type = getMediaType(file?.mimetype);

  if (!type) {
    throw new Error(`Unsupported file type: ${file?.mimetype || "unknown"}`);
  }

  const extension = path.extname(file?.originalname || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS[type]?.includes(extension)) {
    throw new Error(`Unsupported file extension: ${extension || "unknown"}`);
  }

  const maxSize = LIMITS[type];
  if (file.size > maxSize) {
    throw new Error(`${type} exceeds ${maxSize / (1024 * 1024)}MB limit`);
  }

  return type;
}

export { ALLOWED_EXTENSIONS, ALLOWED_MIME, LIMITS };
