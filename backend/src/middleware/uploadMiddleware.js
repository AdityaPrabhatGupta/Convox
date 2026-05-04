import multer from "multer";
import { getMediaType } from "../services/mediaTypes.js";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const type = getMediaType(file.mimetype);
  if (!type) {
    cb(new Error(`Unsupported type: ${file.mimetype}`));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
