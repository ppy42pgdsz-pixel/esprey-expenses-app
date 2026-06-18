// Shared constants used across endpoints + frontend.

/**
 * The pseudo-company name used for non-business personal expenses. Always
 * available in every user's dropdown regardless of their team_member_companies
 * access list. Reserved — admins cannot create a real company with this name.
 */
export const PERSONAL_COMPANY = "Personal";

/** True if `name` is the reserved Personal sentinel (case-insensitive). */
export function isPersonalCompany(name: string | null | undefined): boolean {
  return typeof name === "string" && name.trim().toLowerCase() === PERSONAL_COMPANY.toLowerCase();
}
