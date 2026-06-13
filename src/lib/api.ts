import type { Person, Receipt } from "./types";

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
  createManualReceipt: (data: {
    vendor?: string | null;
    amount?: string | null;
    currency?: string | null;
    receipt_date?: string | null;
    company?: string | null;
    category?: string | null;
    notes?: string | null;
    attendees?: string[];
  }) =>
    jsonFetch<{ id: string }>("/api/receipts/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  listCompanies: () => jsonFetch<{ companies: string[] }>("/api/companies"),
  addCompany: (name: string) =>
    jsonFetch<{ company: string }>("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteCompany: (name: string) =>
    jsonFetch<{ deleted: string }>(`/api/companies/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listPeople: () => jsonFetch<{ people: Person[] }>("/api/people"),
  addPerson: (name: string, is_favorite = false) =>
    jsonFetch<{ person: Person }>("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, is_favorite }),
    }),
  setPersonFavorite: (name: string, is_favorite: boolean) =>
    jsonFetch<{ person: Person }>(`/api/people/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_favorite }),
    }),
  deletePerson: (name: string) =>
    jsonFetch<{ deleted: string }>(`/api/people/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listCategories: () => jsonFetch<{ categories: string[] }>("/api/categories"),
  addCategory: (name: string) =>
    jsonFetch<{ category: string }>("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  deleteCategory: (name: string) =>
    jsonFetch<{ deleted: string }>(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listCurrencies: () => jsonFetch<{ currencies: Array<{ code: string; name: string }> }>("/api/currencies"),
  addCurrency: (code: string, name: string) =>
    jsonFetch<{ currency: { code: string; name: string } }>("/api/currencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    }),
  deleteCurrency: (code: string) =>
    jsonFetch<{ deleted: string }>(`/api/currencies/${encodeURIComponent(code)}`, { method: "DELETE" }),

  listReports: () =>
    jsonFetch<{ reports: Array<{ month: string; sizeBytes: number; uploadedAt: number; downloadUrl: string }> }>("/api/reports"),
  generateReport: (month: string) =>
    jsonFetch<{
      month: string;
      receipts: number;
      sizeBytes: number;
      downloadUrl: string;
      emailedTo: string | null;
      emailError: string | null;
    }>("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    }),
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
