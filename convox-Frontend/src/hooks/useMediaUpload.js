import { useCallback, useEffect, useState } from "react";
import { uploadMediaMessage } from "../services/messageService.js";

const TYPE_LIMITS = { image: 5, video: 10, audio: 2, file: 5 };
const ALLOWED = {
  "image/jpeg": 1,
  "image/png": 1,
  "image/gif": 1,
  "image/webp": 1,
  "video/mp4": 1,
  "video/webm": 1,
  "video/quicktime": 1,
  "audio/mpeg": 1,
  "audio/wav": 1,
  "audio/ogg": 1,
  "audio/webm": 1,
  "application/pdf": 1,
  "text/plain": 1,
  "application/msword": 1,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 1,
};

function getMajorType(mime = "") {
  if (mime.startsWith("image")) return "image";
  if (mime.startsWith("video")) return "video";
  if (mime.startsWith("audio")) return "audio";
  return "file";
}

export function useMediaUpload() {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const clearPreview = useCallback(() => {
    setPreview((current) => {
      if (current?.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }
      return null;
    });
    setError("");
  }, []);

  useEffect(() => () => {
    if (preview?.objectUrl) {
      URL.revokeObjectURL(preview.objectUrl);
    }
  }, [preview]);

  const selectFile = useCallback((file) => {
    if (!file) return;

    clearPreview();
    setError("");

    if (!ALLOWED[file.type]) {
      setError("Unsupported file type");
      return;
    }

    const type = getMajorType(file.type);
    const limit = TYPE_LIMITS[type] * 1024 * 1024;
    if (file.size > limit) {
      setError(`${type} must be under ${TYPE_LIMITS[type]}MB`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview({ file, objectUrl, type });
  }, [clearPreview]);

  const upload = useCallback(async (chatId, onProgress, replyTo) => {
    if (!preview?.file) return null;

    setUploading(true);
    setError("");

    try {
      const result = await uploadMediaMessage({
        chatId,
        file: preview.file,
        replyTo,
        onUploadProgress: onProgress,
      });
      clearPreview();
      return result;
    } catch (uploadError) {
      setError(uploadError.response?.data?.message || uploadError.message || "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  }, [clearPreview, preview]);

  return {
    preview,
    uploading,
    error,
    selectFile,
    clearPreview,
    upload,
  };
}
