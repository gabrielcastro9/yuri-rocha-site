import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dbDriver, dbLabel, dbReady } from "./db.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uploadDir = path.join(root, "data", "uploads");

export { dbDriver as storageDriver, dbReady as storageReady, dbLabel };

function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const VIDEO_TYPES = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov"
};

const EXT_TYPES = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime"
};

export async function saveUpload(file) {
  let type = String(file?.type || "").toLowerCase();
  const nameExt = String(file?.name || "").split(".").pop()?.toLowerCase();
  if ((!type || type === "application/octet-stream") && EXT_TYPES[nameExt]) type = EXT_TYPES[nameExt];
  const ext = IMAGE_TYPES[type] || VIDEO_TYPES[type];
  const video = Boolean(VIDEO_TYPES[type]);
  if (!ext) throw new Error("Formato não permitido. Use JPEG, PNG, WebP, GIF, MP4, WebM ou MOV.");
  const limit = video ? 50 * 1024 * 1024 : 2 * 1024 * 1024;
  if (!file.size || file.size > limit) {
    throw new Error(video ? "O vídeo deve ter no máximo 50 MB." : "O arquivo deve ter no máximo 2 MB.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${ext}`;

  if (blobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: type
    });
    return { url: blob.url };
  }

  if (process.env.VERCEL) {
    throw new Error("Envio de arquivo exige Vercel Blob ligado ao projeto.");
  }

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}
