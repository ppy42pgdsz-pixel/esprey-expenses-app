# Esprey Expenses — Consolidated Roadmap (2026-07-03)

Everything agreed or proposed, merged from the previous model's handover backlog (§13/§16) and the new code review. Deduplicated; overlaps noted.

## 1. In progress (finish first)

- ✅ **Spending-limits UI** — DONE 2026-07-04. Settings limit input, Dashboard Issues + orange highlight, over-limit banner with Acknowledge. Also fixed PATCH bug where `policy_acknowledged` wrongly marked receipts content-edited.
- ✅ **#44 Attendees in reports** — DONE 2026-07-04. Grey "with …" line per receipt on the category breakdown page (Carl's placement choice). #45 now unblocked.
- ✅ **Report page UX** — DONE 2026-07-04. Generate no longer auto-emails; explicit Email PDF button (new `/api/reports/email-pdf`), Download PDF link, pre-emptive >28 MB warning. Date-popover white-on-white button fixed.

### New candidate items from Carl (2026-07-04, not yet scheduled)
- Spending-limits master on/off toggle (limits currently "off" when no category has a value)
- Per-company spending limits + delegated per-company policy admin (needs multi-admin auth — `team_members.is_admin` groundwork exists)
- **#49 Multi-language (French first)** — IN PROGRESS 2026-07-04.
  ✅ 49a: `language` on user_profile (migration 0013), selector in My Profile, OCR notes in user's language (app + email worker), opt-in "translate my existing descriptions" button.
  ✅ 49b: report-language dropdown; PDF labels via `_lib/pdfStrings.ts` (en/fr); notes+categories batch-translated (`_lib/translate.ts`); vendors/amounts/dates/attendees never translated; French month names.
  ✅ 49c: DONE 2026-07-04. UI dictionary `shared/i18n.ts` (English-as-key, graceful fallback). All screens: Dashboard, Capture, Manual, Receipt detail (incl. banners/dialogs/errors), Reports, Settings, My Profile, Help & FAQ. French FAQ content in `shared/faq.ts` (q_fr/a_fr); help widget answers in the question's language. Bonus: admin picks a default language when adding a team member (seeds their profile, never overwrites their later choice). Team admin page itself left in English (admin-only).
  Adding pt-PT later = add a `pt` column to the dictionaries + dropdown entries (~1 hour).
  Original plan: two halves:
  1. *App in the user's language*: per-user language preference (User Settings, default from browser). All UI strings via an i18n dictionary; OCR prompt told to write the receipt `notes` in the user's language, so a French user sees French descriptions. Shared category names get display labels per language (canonical value stays stable in the DB).
  2. *Report language dropdown*: on the Reports page, pick the output language (e.g. team member works in French, report generated in English). Template headings come from the same dictionary; receipt notes/descriptions are batch-translated with one Claude call at generation time. **Vendor/establishment names are NEVER translated** — they must match the underlying receipt. Same rule for amounts, dates, and currency codes.
  Estimate: UI half ~2 days (touches every page), report half ~half a day. Report half is independently shippable first if desired.

## 2. Correctness fixes (new — from code review)

1. ✅ **Money as floats** — DONE 2026-07-03. `shared/money.ts` (integer minor units), all arithmetic call sites in Dashboard/ReceiptDetail/pdf.ts converted. DB strings unchanged.
2. ✅ **FX at purchase time** — DONE 2026-07-03. Migration 0011: `fx_rates` daily-table cache + `receipts.fx_rate_date` stamped on all three capture paths. Reports convert per-receipt at capture-day rates; pre-0011 rows fall back to live rates.
3. ⏸️ **Server-side + cross-user duplicate detection** — PARKED by Carl 2026-07-03.
4. ✅ **Soft delete + trash** — DONE 2026-07-03. Migration 0012: `deleted_at`; DELETE soft-stamps (hard-delete fallback pre-migration); Trash section in Settings with Restore; lazy 30-day purge.
5. ✅ **Tests + typecheck on deploy** — DONE 2026-07-03. `npm run deploy` = check → test → build → deploy. Vitest: 13 tests. Bonus: first-ever typecheck surfaced 11 latent errors, including a real bug — multi-page reports crashed on an undefined `billTo` variable (pdf.ts:366).

## 3. Existing numbered backlog (carried over)

| # | Item | Notes |
|---|---|---|
| 10 | UI polish pass | Open scope |
| 13 | Offline photo buffer | Service-worker fallback so captures survive no-signal, upload on reconnect |
| 43 | Concierge AI (email + in-app chat) | Both entry points: email to `ask@expenses.esprey.net` + PWA chat page. Read + write via Claude tool-use over existing D1 queries. Destructive actions (delete, add team member, change company access) gated on "Reply YES to confirm"; non-destructive writes (manual receipt, categorization rule) fire without confirmation. ~3 days. Modelled on Expensify's Concierge (see memory: concierge_ai_backlog) |
| 44 | Attendees in monthly report | Small; blocks #45. Also applies to any Concierge-generated report |
| 45 | Welcome-email update for #44 | Adds "Tag who was with you" section; after #44 |
| 46 | ✅ FAQ / help page | DONE 2026-07-04 — searchable Q&A at `/instructions`, content in `shared/faq.ts` |
| 47 | ✅ "How do I…" AI help widget | DONE 2026-07-04 — `/api/help/ask` (Haiku, FAQ-grounded, read-only) + ask box on the help page |
| 48 | Marketing site + walkthrough | (a) recorded video demo, or (b) live demo mode with tooltip overlays — needs `/demo` CF Access bypass + seeded fake data, 2–3× the effort of (a) |

Deferred by Carl: receipt splitting across categories.

## 4. Prioritized feature adds (endorsed from handover §16)

1. ⏸️ **CSV / accounting export** — PARKED by Carl 2026-07-04 (accountant works from PDFs for now).
2. **VAT / tax field separation** (net + tax + gross) — pairs with export.
3. **Reimbursement status** per receipt (pending / paid) — one column + chip.
4. ~~Report scheduling~~ — REMOVED by Carl 2026-07-04 (not wanted).
5. ✅ **URL-persisted dashboard filters** — DONE 2026-07-04. Filters mirror to ?pill/&company/&date/&from/&to; refresh, Back, and bookmarks all preserve the view. Also added a "?" help link in the Dashboard header.

## 5. Remaining ideas from handover §16 (unprioritized pool)

Approval workflow · mileage tracking · audit log · full data export (GDPR) · full-text search · recurring-expense reminders · OCR cost optimization (skip OCR for known structured emails: Uber, Ryanair…) · dark mode · print-friendly detail view · report customization · push notifications · handwritten-note/signature receipts · client/project tags · public API & webhooks.

## 6. Suggested sequence

Spending-limits UI → fixes 2.1 + 2.2 (financial correctness) → CSV export + VAT split → reimbursement status → scheduling/URL filters → then backlog #44/#45, #46/#47, #43.
