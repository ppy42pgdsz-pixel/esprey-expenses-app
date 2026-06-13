// Shared types for Pages Functions.

export interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  CARL_EMAIL: string;
  ANTHROPIC_API_KEY: string;
  SESSION_SECRET: string;
  RESEND_API_KEY?: string;          // optional — if absent, email step is skipped
  REPORT_FROM_ADDRESS?: string;     // e.g. reports@esprey.net (must be Resend-verified)
}

export interface ReceiptRow {
  id: string;
  r2_key: string;
  thumb_r2_key: string | null;
  source: "camera" | "email";
  source_meta: string | null;
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  receipt_date: string | null;
  company: string | null;
  notes: string | null;
  ocr_raw: string | null;
  ocr_status: "pending" | "success" | "failed" | "manual";
  uploaded_at: number;
}

export interface ExtractedReceipt {
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  receipt_date: string | null; // YYYY-MM-DD
  notes: string | null;
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...(extra ?? {}) }, { status });
}
