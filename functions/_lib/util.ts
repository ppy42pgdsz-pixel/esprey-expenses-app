// Small helpers shared across endpoints.

export function newId(): string {
  // crypto.randomUUID is available in the Workers runtime.
  return crypto.randomUUID();
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunk) as unknown as number[]
    );
  }
  return btoa(binary);
}

export function r2KeyForReceipt(id: string, ext: string): string {
  // YYYY/MM/<id>.<ext> — keeps things organized by month.
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${id}.${ext}`;
}

/**
 * Convert an email address into a safe R2 key segment.
 * `cesprey@gmail.com` → `cesprey_gmail_com`.
 * Used to namespace per-user files in R2 (reports/, etc).
 */
export function userSlug(email: string): string {
  return (email || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Full R2 key for a per-user monthly report. */
export function reportR2Key(email: string, file: string): string {
  return `reports/${userSlug(email)}/${file}`;
}

export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
    case "image/heif":
      return "heic";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}
