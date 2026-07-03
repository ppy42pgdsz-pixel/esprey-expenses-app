# Esprey Expenses — Consolidated Roadmap (2026-07-03)

Everything agreed or proposed, merged from the previous model's handover backlog (§13/§16) and the new code review. Deduplicated; overlaps noted.

## 1. In progress (finish first)

- **Spending-limits UI** — backend done (migration 0009). Remaining: limit input in Settings → Categories (admin), over-limit receipts in Dashboard Issues + orange highlight, detail-page banner with Acknowledge button (`policy_acknowledged`).

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
| 46 | FAQ / help page | Searchable Q&A replacing thin `/instructions` |
| 47 | "How do I…" AI help widget | Grounded in FAQ, no tool access — safer/cheaper than Concierge; blocked by #46 |
| 48 | Marketing site + walkthrough | (a) recorded video demo, or (b) live demo mode with tooltip overlays — needs `/demo` CF Access bypass + seeded fake data, 2–3× the effort of (a) |

Deferred by Carl: receipt splitting across categories.

## 4. Prioritized feature adds (endorsed from handover §16)

1. **CSV / accounting export** (Xero/QuickBooks-friendly) — #1 gap vs Expensify; one endpoint.
2. **VAT / tax field separation** (net + tax + gross) — pairs with export.
3. **Reimbursement status** per receipt (pending / paid) — one column + chip.
4. **Report scheduling** — CF Cron Trigger emailing the monthly report on the 1st; `generate.ts` already does the work.
5. **URL-persisted dashboard filters** — trivial; fixes bookmarks/back button.

## 5. Remaining ideas from handover §16 (unprioritized pool)

Approval workflow · mileage tracking · audit log · full data export (GDPR) · full-text search · recurring-expense reminders · OCR cost optimization (skip OCR for known structured emails: Uber, Ryanair…) · dark mode · print-friendly detail view · report customization · push notifications · handwritten-note/signature receipts · client/project tags · public API & webhooks.

## 6. Suggested sequence

Spending-limits UI → fixes 2.1 + 2.2 (financial correctness) → CSV export + VAT split → reimbursement status → scheduling/URL filters → then backlog #44/#45, #46/#47, #43.
