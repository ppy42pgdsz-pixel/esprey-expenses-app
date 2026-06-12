// Frontend mirror of the receipt row shape.
export interface Receipt {
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
