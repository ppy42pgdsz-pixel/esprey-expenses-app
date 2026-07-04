// Per-user language lookup (#49). 'en' unless the user picked 'fr' in
// User Settings. Defensive: pre-0013 schema or missing profile → 'en'.

export type AppLanguage = "en" | "fr" | "pt";

export async function getUserLanguage(db: D1Database, userEmail: string): Promise<AppLanguage> {
  try {
    const row = await db
      .prepare(`SELECT language FROM user_profile WHERE user_email = ?`)
      .bind(userEmail)
      .first<{ language: string | null }>();
    return row?.language === "fr" ? "fr" : row?.language === "pt" ? "pt" : "en";
  } catch {
    return "en";
  }
}

export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  fr: "French",
  pt: "European Portuguese",
};
