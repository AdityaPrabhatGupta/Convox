import path from "path";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary.js";
import { prepareUploadPayload } from "./compressionService.js";
import { getMediaType, validateFile } from "./mediaTypes.js";

const toUploadStream = (data) => (Buffer.isBuffer(data) ? Readable.from(data) : data);

export async function uploadToCloudinary(data, mediaType, originalName) {
  const resourceType =
    mediaType === "image" ? "image" : mediaType === "file" ? "raw" : "video";
  const baseName = path.parse(originalName || `upload-${Date.now()}`).name;

  return new Promise((resolve, reject) => {
    const sourceStream = toUploadStream(data);
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `convox/${mediaType}s`,
        resource_type: resourceType,
        use_filename: true,
        public_id: `${Date.now()}_${baseName}`,
        format: mediaType === "image" ? "webp" : undefined,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );

    sourceStream.on("error", reject);
    sourceStream.pipe(stream);
  });
}

export async function processAndUpload(file) {
  const type = validateFile(file);
  let uploadPayload = {
    data: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
    cleanup: async () => {},
  };

  try {
    uploadPayload = await prepareUploadPayload(file);
  } catch (error) {
    console.error("Media compression failed, falling back to original upload", {
      originalName: file.originalname,
      mimetype: file.mimetype,
      error: error.message,
    });
  }

  try {
    const result = await uploadToCloudinary(
      uploadPayload.data,
      type,
      file.originalname,
    );

    return {
      type,
      mediaUrl: result.secure_url,
      fileName: file.originalname,
      fileSize: uploadPayload.size,
      mimeType: uploadPayload.mimetype,
    };
  } finally {
    await uploadPayload.cleanup();
  }
}

export { getMediaType, validateFile };
