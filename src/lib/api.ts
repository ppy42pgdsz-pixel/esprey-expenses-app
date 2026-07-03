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
  listTrash: () =>
    jsonFetch<{ receipts: Receipt[] }>(`/api/receipts/trash`),
  restoreReceipt: (id: string) =>
    jsonFetch<{ restored: string }>(`/api/receipts/trash`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }),
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
  addTeamMember: (email: string, display_name?: string | null) =>
    jsonFetch<{
      member: { email: string; display_name: string | null };
      cloudflareAdded: boolean;
      cloudflareEmails: string[];
      emailedTo: string | null;
      emailError: string | null;
    }>("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, display_name: display_name ?? null }),
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
  generateReport: (month: string, company: string | null, currency: string | null) =>
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
      emailedTo: string | null;
      emailError: string | null;
    }>("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, company, currency }),
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

/**
 * Deterministic colour for a company name — same input always yields the
 * same palette slot. Special-cases Personal so it always looks the same.
 */
const COMPANY_PALETTE: Array<{ bg: string; fg: string }> = [
  { bg: "#dcfce7", fg: "#166534" }, // green
  { bg: "#dbeafe", fg: "#1e40af" }, // blue
  { bg: "#fce7f3", fg: "#9f1239" }, // pink
  { bg: "#fef3c7", fg: "#92400e" }, // amber
  { bg: "#f3e8ff", fg: "#6b21a8" }, // purple
  { bg: "#cffafe", fg: "#155e75" }, // cyan
  { bg: "#fee2e2", fg: "#991b1b" }, // red
  { bg: "#e0e7ff", fg: "#3730a3" }, // indigo
  { bg: "#ecfccb", fg: "#3f6212" }, // lime
  { bg: "#ffe4e6", fg: "#9f1239" }, // rose
];
export function companyColor(name: string | null | undefined): { bg: string; fg: string } | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  // Personal always gets a soft neutral slate so it visually distinguishes
  // "no business company" from real billable companies.
  if (trimmed.toLowerCase() === "personal") return { bg: "#e2e8f0", fg: "#334155" };
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return COMPANY_PALETTE[hash % COMPANY_PALETTE.length];
}

export function formatDate(iso: string | null | number): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
