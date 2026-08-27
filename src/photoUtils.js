/**
 * photoUtils.js — one place for field photo handling.
 *
 * Used by Field Mode, the classic Daily Log screen, and the project's
 * Daily Log tab so a photo behaves identically wherever it's added.
 *
 * Phones shoot 8–12 MB images. Uploading those raw from inside a concrete
 * storage building on one bar either fails or takes minutes, and it burns
 * Firebase Storage. Everything is resized to ~1600px on the long edge and
 * re-encoded as JPEG q0.8 first — typically ~300 KB, visually identical on
 * a report.
 */

import { storage, storageRef, uploadBytes, getDownloadURL } from "./firebase.js";

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/** File/Blob → compressed JPEG Blob. Falls back to the original on failure. */
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//i.test(file.type || "")) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > MAX_EDGE || height > MAX_EDGE) {
          const s = MAX_EDGE / Math.max(width, height);
          width = Math.round(width * s); height = Math.round(height * s);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => resolve(b || file), "image/jpeg", JPEG_QUALITY);
      } catch { URL.revokeObjectURL(url); resolve(file); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

/**
 * Compress + upload photos for one daily log.
 * @param files      array of File objects
 * @param projectId  project the log belongs to
 * @param logId      the log's id (photos live under it)
 * @param onProgress optional (done, total) => void
 * @returns array of download URLs
 */
export async function uploadLogPhotos(files, projectId, logId, onProgress) {
  const urls = [];
  const list = Array.from(files || []);
  for (let i = 0; i < list.length; i++) {
    const blob = await compressImage(list[i]);
    const ref = storageRef(storage, `projects/${projectId}/dailyLogs/${logId}/${Date.now()}-${i}.jpg`);
    try {
      await uploadBytes(ref, blob);
      urls.push(await getDownloadURL(ref));
    } catch (e) {
      // Re-throw with a cause the person can act on. Reporting a permissions
      // denial as "weak signal" sent crews chasing a connection problem while
      // Storage rules quietly rejected every upload.
      const err = new Error(describeUploadError(e));
      err.code = e?.code || "unknown";
      err.original = e;
      throw err;
    }
    if (onProgress) onProgress(i + 1, list.length);
  }
  return urls;
}

/** Turn a Firebase Storage error into something a foreman can read — and an
 *  admin can act on. */
export function describeUploadError(e) {
  const code = String(e?.code || "");
  if (code.includes("unauthorized") || code.includes("permission")) {
    return "Photo uploads are blocked by the app's storage permissions. This is a settings issue, not your phone — tell the office (Firebase Storage rules need updating).";
  }
  if (code.includes("quota")) return "The photo storage account is full. Tell the office.";
  if (code.includes("unauthenticated")) return "Your sign-in expired. Close and reopen the app, then try again.";
  if (code.includes("retry-limit") || code.includes("canceled") || code.includes("network")) {
    return "Upload timed out — weak signal. Your log is still here; try again from better service.";
  }
  return `Photo upload failed (${code || "unknown error"}).`;
}

/** Local preview URLs for chosen-but-not-yet-uploaded files. */
export function previewUrl(file) {
  try { return URL.createObjectURL(file); } catch { return null; }
}
