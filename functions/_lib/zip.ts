// Build a ZIP of receipt originals for a monthly report. One file per receipt,
// named "YYYY-MM-DD_VendorName.ext", flat structure (no subfolders).

import { zip } from "fflate";
import type { ReceiptRow } from "./types";

interface FileLoader {
  (r2_key: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

export interface ReceiptZipResult {
  bytes: Uint8Array;
  filesIncluded: number;
  filesSkipped: number;
}

export async function buildReceiptZip(opts: {
  receipts: ReceiptRow[];
  fetchOriginal: FileLoader;
}): Promise<ReceiptZipResult> {
  const entries: Record<string, Uint8Array> = {};
  // Tracks how many times we've used each base filename so we can disambiguate.
  const nameCounts = new Map<string, number>();
  let included = 0;
  let skipped = 0;

  for (const r of opts.receipts) {
    // Manual entries (no original) — skip.
    if (r.source === "manual" || (r.r2_key && r.r2_key.startsWith("manual:"))) {
      skipped++;
      continue;
    }
    if (!r.r2_key) { skipped++; continue; }

    let obj;
    try { obj = await opts.fetchOriginal(r.r2_key); } catch { obj = null; }
    if (!obj) { skipped++; continue; }

    const baseMime = (obj.mime || "").split(";")[0].trim().toLowerCase();
    // Skip the .txt sidecars and the rendered html copy that PDFShift produced —
    // for HTML email receipts, we want the cached PDF render, which fetchOriginal
    // already substitutes when given the .html key.
    const ext = extForMime(baseMime, r.r2_key);
    if (!ext) { skipped++; continue; }

    const date = (r.receipt_date && /^\d{4}-\d{2}-\d{2}$/.test(r.receipt_date))
      ? r.receipt_date
      : new Date(r.uploaded_at).toISOString().slice(0, 10);
    const vendorPart = slugVendor(r.vendor) || "receipt";
    const base = `${date}_${vendorPart}`;
    const count = (nameCounts.get(base) ?? 0) + 1;
    nameCounts.set(base, count);
    const name = count === 1 ? `${base}.${ext}` : `${base}_${count}.${ext}`;
    entries[name] = obj.bytes;
    included++;
  }

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 6 }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
  return { bytes, filesIncluded: included, filesSkipped: skipped };
}

function extForMime(baseMime: string, r2Key: string): string | null {
  if (baseMime === "application/pdf") return "pdf";
  if (baseMime === "image/jpeg" || baseMime === "image/jpg") return "jpg";
  if (baseMime === "image/png") return "png";
  if (baseMime === "image/heic" || baseMime === "image/heif") return "heic";
  if (baseMime === "image/webp") return "webp";
  // For HTML receipts: fetchOriginal replaces the .html bytes with the rendered PDF,
  // and reports the mime as "text/html". We want to save these as .pdf in the ZIP.
  if (baseMime === "text/html") return "pdf";
  if (baseMime === "text/plain") return "txt";
  // Unknown — fall back to file extension if it looks reasonable.
  const m = r2Key.match(/\.([A-Za-z0-9]{1,5})$/);
  if (m) return m[1].toLowerCase();
  return null;
}

function slugVendor(name: string | null): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
