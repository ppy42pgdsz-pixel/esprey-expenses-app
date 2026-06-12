import type { Receipt } from "./types";

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = (data && data.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  listReceipts: (companyFilter?: string) => {
    const q = companyFilter ? `?company=${encodeURIComponent(companyFilter)}` : "";
    return jsonFetch<{ receipts: Receipt[] }>(`/api/receipts${q}`);
  },
  getReceipt: (id: string) =>
    jsonFetch<{ receipt: Receipt }>(`/api/receipts/${id}`),
  patchReceipt: (id: string, patch: Partial<Receipt>) =>
    jsonFetch<{ receipt: Receipt }>(`/api/receipts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  deleteReceipt: (id: string) =>
    jsonFetch<{ deleted: string }>(`/api/receipts/${id}`, { method: "DELETE" }),
  uploadReceipt: (file: File, company?: string) => {
    const fd = new FormData();
    fd.append("image", file);
    if (company) fd.append("company", company);
    return jsonFetch<{ id: string; ocr_status: string; extracted: any }>(
      "/api/receipts/upload",
      { method: "POST", body: fd }
    );
  },
  listCompanies: () => jsonFetch<{ companies: string[] }>("/api/companies"),
};

export function imageUrl(id: string): string {
  return `/api/receipts/${id}/image`;
}

export function formatAmount(r: Receipt): string {
  if (!r.amount) return "—";
  const cur = r.currency ?? "";
  return cur ? `${cur} ${r.amount}` : r.amount;
}

export function formatDate(iso: string | null | number): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
