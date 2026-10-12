import { formatMoney } from "../../shared/format";
import type { Company, Person, Receipt, UserProfile } from "./types";

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
  reocrReceipt: (id: string) =>
    jsonFetch<{ receipt: Receipt }>("/api/receipts/reocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  translateNotes: (language: string) =>
    jsonFetch<{ translated: number; total?: number; language: string }>(
      "/api/receipts/translate-notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      }
    ),
  listTrash: () =>
    jsonFetch<{ receipts: Receipt[] }>(`/api/receipts/trash`),
  restoreReceipt: (id: string) =>
    jsonFetch<{ restored: string }>(`/api/receipts/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
  // `capture` carries when the PHOTO was taken (EXIF shutter time, or the
  // file's lastModified) — read client-side because the canvas re-encode in
  // Capture.tsx strips EXIF before the bytes ever reach the server. The server
  // uses it to flag receipts whose OCR-read date lands in the wrong month.
  uploadReceipt: (
    file: File,
    company?: string,
    capture?: { ms: number; source: "exif" | "file" } | null,
  ) => {
    const fd = new FormData();
    fd.append("image", file);
    if (company) fd.append("company", company);
    if (capture) {
      fd.append("captured_at", String(capture.ms));
      fd.append("captured_at_source", capture.source);
    }
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
  listCompanies: () => jsonFetch<{ companies: Company[] }>("/api/companies"),
  getCompany: (name: string) =>
    jsonFetch<{ company: Company }>(`/api/companies/${encodeURIComponent(name)}`),
  addCompany: (name: string) =>
    jsonFetch<{ company: string }>("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }),
  patchCompany: (name: string, patch: Partial<Company>) =>
    jsonFetch<{ company: Company }>(`/api/companies/${encodeURIComponent(name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
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

  listCategories: () =>
    jsonFetch<{
      categories: string[];
      categoryDetails?: Array<{ name: string; spending_limit: string | null }>;
    }>("/api/categories"),
  // POST upserts: existing category + new limit = update the limit.
  addCategory: (name: string, spending_limit?: string | null) =>
    jsonFetch<{ category: string }>("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        spending_limit === undefined ? { name } : { name, spending_limit }
      ),
    }),
  deleteCategory: (name: string) =>
    jsonFetch<{ deleted: string }>(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE" }),

  listCurrencies: () => jsonFetch<{ currencies: Array<{ code: string; name: string }>; convertible?: string[] | null }>("/api/currencies"),
  addCurrency: (code: string, name: string) =>
    jsonFetch<{ currency: { code: string; name: string } }>("/api/currencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    }),
  deleteCurrency: (code: string) =>
    jsonFetch<{ deleted: string }>(`/api/currencies/${encodeURIComponent(code)}`, { method: "DELETE" }),

  listReports: () =>
    jsonFetch<{
      reports: Array<{
        file: string;
        month: string;
        companySlug: string;
        sizeBytes: number;
        uploadedAt: number;
        downloadUrl: string;
      }>;
    }>("/api/reports"),
  deleteReport: (file: string) =>
    jsonFetch<{ deleted: string }>(`/api/reports/delete?file=${encodeURIComponent(file)}`, { method: "DELETE" }),
  emailReportZip: (file: string) =>
    jsonFetch<{ emailedTo: string; sizeBytes: number }>("/api/reports/email-zip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }),

  whoAmI: () =>
    jsonFetch<{
      middlewareSaw: { userEmail: string | null; isAdmin: boolean };
    }>("/api/diag/whoami"),

  listTeam: () =>
    jsonFetch<{
      members: Array<{
        id: number;
        email: string;
        display_name: string | null;
        role: string;
        is_admin: number;
        added_at: number;
        added_by: string | null;
        aliases: Array<{ alias_email: string; primary_email: string; added_at: number; added_by: string | null }>;
      }>;
      cloudflareEmails: string[];
      cloudflareError: string | null;
    }>("/api/team"),
  addTeamAlias: (primary: string, alias: string) =>
    jsonFetch<{
      added: boolean;
      primary: string;
      alias: string;
      cloudflareAdded?: boolean;
      cloudflareEmails?: string[];
      note?: string;
    }>("/api/team/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary, alias }),
    }),
  getTeamMemberCompanies: (email: string) =>
    jsonFetch<{ email: string; companies: string[] }>(
      `/api/team/companies/${encodeURIComponent(email)}`
    ),
  setTeamMemberCompanies: (email: string, companies: string[]) =>
    jsonFetch<{ email: string; companies: string[]; skipped: string[] }>(
      `/api/team/companies/${encodeURIComponent(email)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companies }),
      },
    ),

  removeTeamAlias: (alias: string) =>
    jsonFetch<{
      removed: boolean;
      alias: string;
      primary: string;
      cloudflareRemoved: boolean;
      cloudflareEmails: string[];
    }>(`/api/team/aliases/${encodeURIComponent(alias)}`, { method: "DELETE" }),
  addTeamMember: (email: string, display_name?: string | null, language?: string) =>
    jsonFetch<{
      member: { email: string; display_name: string | null };
      cloudflareAdded: boolean;
      cloudflareEmails: string[];
      emailedTo: string | null;
      emailError: string | null;
    }>("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name: display_name ?? null, language: language ?? "en" }),
    }),
  removeTeamMember: (email: string) =>
    jsonFetch<{
      removed: boolean;
      email: string;
      cloudflareRemoved: boolean;
      cloudflareEmails: string[];
    }>(`/api/team/${encodeURIComponent(email)}`, { method: "DELETE" }),
  wipeTeamMember: (email: string) =>
    jsonFetch<{
      wiped: boolean;
      email: string;
      aliasesRemoved: string[];
      receiptsDeleted: number;
      r2ObjectsDeleted: number;
      r2Errors: string[] | null;
      cloudflareErrors: string[] | null;
    }>(`/api/team/wipe/${encodeURIComponent(email)}`, { method: "POST" }),

  getUserProfile: () => jsonFetch<{ profile: UserProfile }>("/api/user"),
  updateUserProfile: (patch: Partial<UserProfile>) =>
    jsonFetch<{ profile: UserProfile }>("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  generateReport: (month: string, company: string | null, currency: string | null, language?: string) =>
    jsonFetch<{
      month: string;
      company: string | null;
      currency: string | null;
      file: string;
      monthLabel: string;
      receipts: number;
      sizeBytes: number;
      downloadUrl: string;
      zipFile: string | null;
      zipSizeBytes: number;
      zipFilesIncluded: number;
      zipError: string | null;
      zipDownloadUrl: string | null;
    }>("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, company, currency, language: language || "en" }),
    }),
  emailReportPdf: (file: string) =>
    jsonFetch<{ emailedTo: string; sizeBytes: number }>("/api/reports/email-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    }),
};

export function imageUrl(id: string): string {
  return `/api/receipts/${id}/image`;
}

/** "EUR 1,284.60" as plain text. Use <Amount> from components/Amount for markup. */
export function formatAmount(r: Receipt): string {
  return formatMoney(r.amount, r.currency);
}

/**
 * Deterministic dot colour for a company name — same input always yields the
 * same palette slot. Muted so it reads as a marker, never as a status.
 * Personal is a fixed neutral so "no business company" always looks the same.
 */
const COMPANY_PALETTE: string[] = [
  "#6E7FA3", // slate blue
  "#5E8C7E", // sea green
  "#A3786E", // clay
  "#8C7A5E", // olive brown
  "#7D6E9E", // dusk violet
  "#5E8A9E", // steel teal
  "#9E6E7A", // rose brown
  "#6E9E6E", // moss
  "#9E8A5E", // ochre
  "#7A7A7A", // graphite
];
export function companyColor(name: string | null | undefined): { dot: string } | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "personal") return { dot: "#B7B3AA" };
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return { dot: COMPANY_PALETTE[hash % COMPANY_PALETTE.length] };
}

export { formatDate, formatMoney, formatNumber } from "../../shared/format";
