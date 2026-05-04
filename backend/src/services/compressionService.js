import crypto from "crypto";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { getMediaType } from "./mediaTypes.js";

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

const IMAGE_OUTPUT_MIME = "image/webp";
const VIDEO_OUTPUT_MIME = "video/mp4";
const AUDIO_OUTPUT_MIME = "audio/mpeg";

const makeTempPath = (suffix) =>
  path.join(os.tmpdir(), `convox-${crypto.randomUUID()}${suffix}`);

const safeUnlink = async (targetPath) => {
  if (!targetPath) return;
  await fs.unlink(targetPath).catch(() => {});
};

const getOutputMimetype = (mediaType) =>
  mediaType === "video" ? VIDEO_OUTPUT_MIME : AUDIO_OUTPUT_MIME;

export async function compressImageBuffer(inputBuffer) {
  const outputBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toBuffer();

  return {
    data: outputBuffer,
    mimetype: IMAGE_OUTPUT_MIME,
    size: outputBuffer.length,
    cleanup: async () => {},
  };
}

export async function compressVideoOrAudioFile({ buffer, mimetype }) {
  const mediaType = getMediaType(mimetype);
  const isVideo = mediaType === "video";
  const inputPath = makeTempPath(path.extname(`file.${mimetype.split("/")[1] || ""}`) || ".bin");
  const outputPath = makeTempPath(isVideo ? ".mp4" : ".mp3");

  await fs.writeFile(inputPath, buffer);

  try {
    await new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath).output(outputPath);

      if (isVideo) {
        command
          .videoCodec("libx264")
          .audioCodec("aac")
          .videoBitrate("900k")
          .audioBitrate("128k")
          .outputOptions(["-preset veryfast", "-crf 30", "-movflags +faststart"]);
      } else {
        command.audioCodec("libmp3lame").audioBitrate("96k");
      }

      command.on("end", resolve).on("error", reject).run();
    });

    await safeUnlink(inputPath);
    const { size } = await fs.stat(outputPath);

    return {
      data: createReadStream(outputPath),
      mimetype: getOutputMimetype(mediaType),
      size,
      cleanup: async () => {
        await Promise.all([safeUnlink(inputPath), safeUnlink(outputPath)]);
      },
    };
  } catch (error) {
    await Promise.all([safeUnlink(inputPath), safeUnlink(outputPath)]);
    throw error;
  }
}

export async function prepareUploadPayload(file) {
  const mediaType = getMediaType(file?.mimetype);

  if (mediaType === "image") {
    return compressImageBuffer(file.buffer);
  }

  if (mediaType === "video" || mediaType === "audio") {
    return compressVideoOrAudioFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
  }

  return {
    data: file.buffer,
    mimetype: file.mimetype,
    size: file.size,
    cleanup: async () => {},
  };
}
