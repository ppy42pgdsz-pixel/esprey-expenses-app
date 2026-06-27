// Shared types for Pages Functions.

export interface Env {
  DB: D1Database;
  RECEIPTS: R2Bucket;
  CARL_EMAIL: string;
  ANTHROPIC_API_KEY: string;
  SESSION_SECRET: string;
  RESEND_API_KEY?: string;          // optional — if absent, email step is skipped
  REPORT_FROM_ADDRESS?: string;     // e.g. reports@esprey.net (must be Resend-verified)
  PDFSHIFT_API_KEY?: string;        // optional — used to render email HTML into PDF appendix pages

  // Invoice "BILL FROM" block
  BILL_FROM_NAME?: string;
  BILL_FROM_LINE1?: string;
  BILL_FROM_LINE2?: string;
  BILL_FROM_COUNTRY?: string;

  // Payment details
  BANK_NAME?: string;
  BANK_IBAN?: string;
  BANK_SWIFT?: string;

  // Multi-user: token for managing the Cloudflare Access policy, plus the
  // account ID it should operate on.
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}

export interface TeamMemberRow {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  is_admin: number;
  added_at: number;
  added_by: string | null;
}

/** Data injected by the auth middleware into PagesFunction context.data. */
export interface AuthContext {
  userEmail: string | null;
  isAdmin: boolean;
}

export interface BillFrom {
  name: string;
  business_name?: string;
  line1: string;
  line2: string;
  country: string;
  vat_number?: string;
  email?: string;
  phone?: string;
}

export interface BankDetails {
  /** Free-form payment instructions, rendered verbatim in the invoice footer. */
  details: string;
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
  rotation: number;
  tip_pct: number;
  tip_amount: string | null; // custom tip amount (decimal string). null = use tip_pct.
  override_acknowledged: number; // 0/1 — user confirmed manual override of OCR-extracted values
  policy_acknowledged: number; // 0/1 — user confirmed an over-limit (category spending policy) receipt
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
