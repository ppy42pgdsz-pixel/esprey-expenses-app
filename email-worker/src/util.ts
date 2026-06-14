export function newId(): string {
  return crypto.randomUUID();
}

export function uint8ToBase64(bytes: Uint8Array): string {
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
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}/${m}/${id}.${ext}`;
}

export function extFromMime(mime: string): string {
  switch (mime.toLowerCase()) {
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

// Wrap an email's raw body HTML in a standalone document so PDFShift can render
// it as a self-contained page. Many emails come as fragments without <html>/<body>
// wrappers, which would inherit junk from a default UA stylesheet.
export function wrapEmailHtml(subject: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(subject)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f1f1f; margin: 0; padding: 20px; line-height: 1.45; }
  .email-header { border-bottom: 1px solid #e5e5e5; padding-bottom: 10px; margin-bottom: 16px; }
  .email-header .label { color: #888; font-size: 12px; }
  .email-header .subject { font-size: 18px; font-weight: 600; margin-top: 4px; }
  .email-body { font-size: 14px; }
  .email-body img { max-width: 100%; height: auto; }
  .email-body table { border-collapse: collapse; }
</style>
</head>
<body>
  <div class="email-header">
    <div class="label">Subject</div>
    <div class="subject">${escapeHtml(subject)}</div>
  </div>
  <div class="email-body">${bodyHtml}</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripHtml(html: string): string {
  // Preserve paragraph/line structure when converting HTML → plain text so the
  // PDF appendix reads like an email instead of one giant run-on paragraph.
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, "  ") // double-space between cells
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")        // collapse horizontal whitespace only
    .replace(/[ \t]*\n[ \t]*/g, "\n") // trim line-start/end spaces
    .replace(/\n{3,}/g, "\n\n")     // collapse runs of 3+ blank lines
    .trim();
}
