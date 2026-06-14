// Frontend mirror of the receipt row shape.
export interface Receipt {
  id: string;
  r2_key: string;
  thumb_r2_key: string | null;
  source: "camera" | "email" | "manual";
  source_meta: string | null;
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  receipt_date: string | null;
  company: string | null;
  notes: string | null;
  attendees: string | null; // JSON-encoded array of names
  category: string | null;
  ocr_raw: string | null;
  ocr_status: "pending" | "success" | "failed" | "manual";
  uploaded_at: number;
}

export interface Person {
  name: string;
  is_favorite: number; // 0 or 1
}

export interface UserProfile {
  id: number;
  name: string | null;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_country: string | null;
  vat_number: string | null;
  bank_name: string | null;   // legacy
  bank_iban: string | null;   // legacy
  bank_swift: string | null;  // legacy
  bank_details: string | null;
  updated_at: number;
}

export interface Company {
  name: string;                        // short name (PK, used in receipts)
  full_name: string | null;            // full legal/billing name (used in invoices)
  address_line1: string | null;
  address_line2: string | null;
  address_country: string | null;
  vat_number: string | null;
  created_at: number;
}

export function parseAttendees(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String);
  } catch {
    // tolerate comma-separated legacy
    return raw.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}
