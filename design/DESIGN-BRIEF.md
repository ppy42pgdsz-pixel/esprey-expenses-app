# Esprey Expenses — Design brief for Claude Design

*Written 11 October 2026 from the live codebase (`esprey-expenses-app`, last commit `aa18aea`), README, ROADMAP, HANDOVER, every page under `src/pages`, every component, the D1 schema and 16 migrations, and the API in `functions/`. Every screen, field, string and rule below exists in the code today unless it is explicitly marked **NOT BUILT** or **DATA DOES NOT EXIST**.*

**Attach with this brief:** the DESIGN.md token files from Esprey Travel and Esprey Health, so the family resemblance (and the differences) can be checked against the real tokens.

**Example values.** The live database can't be read from the code. Example values come from the code, tests, docs and Carl's real June 2026 report: Waraba Gold, Lithium Africa, Personal, Sr. Marujo EUR 171.07, Saily (eSIM) USD 36.99, Botanical Holdings with no amount, the Starbeans coffee 4.50, invoice `EX-202609-WARABAGOLD-USD`, and the XOF peg. Values that fill out a row (such as the Hôtel Ivoire line) use the same vocabulary and are realistic, but they are illustrative.

---

## 1. What the app is

Esprey Expenses (`expenses.esprey.net`) is a private phone-first web app in which Carl Esprey and a small team of up to about ten people get receipts in (photo, forwarded email or manual entry). Claude reads the vendor, amount, currency and date from each one. Each person then generates, per month and per company, a PDF **expense report**: an invoice from that person to the company (for example Waraba Gold) listing every receipt, with the originals attached.

**There is no claim object, approver or accountant login in the app.** The "claim" is that monthly PDF. **Reimbursement** means the company paying that invoice to the bank details printed in its footer, and it happens entirely outside the app: the person emails the PDF to themselves and forwards it to the company or accountant.

The one thing the app must make effortless: **getting every receipt out of a pocket and into the correct month's report, correctly read, without missing one.**

---

## 2. Screen inventory

Breakpoints today: the dashboard switches from cards to a table at **900 px**. The receipt detail page goes two-column at **720 px**. Every page except the dashboard is capped at **720 px** wide, centred, even on a 1440 px screen. The dashboard is capped at 1280 px. The design should set its own breakpoints, and the screens below say what each one must do at 390 and 1440.

The app is in **three languages**: English, French and Portuguese (Portugal), chosen per user. Every user-facing string goes through a dictionary. French and Portuguese run about 25–35 % longer than English ("Uncategorized" → "Non catégorisé" / "Sem categoria"; "Acknowledge — this is a separate expense" → "Confirmer — c'est une dépense distincte"). Every layout must survive the longest. The admin-only screens (Team, Company detail) are English-only by Carl's decision.

The app has two roles:
- **Member**: sees only their own receipts, reports, people list and profile.
- **Admin** (Carl, `is_admin = 1`): everything a member can do, plus editing the shared Companies / Categories / Currencies lists, Team management and company details. **An admin cannot see other people's receipts or reports.** No screen anywhere shows another person's data.

### 2.0 Sign-in (not part of the app)

- **Purpose:** gatekeeping. Cloudflare Zero Trust Access hosts the page in front of `expenses.esprey.net`. The app contains no login code.
- **Data:** an email field, then a 6-digit one-time code emailed by Cloudflare.
- **Actions:** enter email → "Send me a code" → enter code.
- **Error state:** Cloudflare's own (wrong or expired code; an email not on the allow list gets no code).
- **Design scope:** Cloudflare lets us set only a **logo, app name and background colour** on this page. Deliver those three items: the 1024 px mark, "Esprey Expenses", and the stone background hex. Do not design a custom login screen; it can't be built.
- **Edge case worth a frame:** someone who is on the Cloudflare allow list but missing from the team table signs in and sees an empty dashboard ("No receipts yet.") with no explanation. **DATA DOES NOT EXIST** to detect this client-side.

### 2.1 Dashboard (`/`), the home screen

**Purpose:** see all your receipts, spot what needs attention, and start a capture.

**Top bar (today):**
- Left: three icon links: ⚙ Settings, 📄 Reports (monthly reports), ? Help & FAQ.
- Centre: the logo (hidden below 720 px) and the title **"Expenses"**.
- Right: **"+ Manual"** (secondary) and **"+ Capture"** (primary).

**Counter pills** (each is a toggle filter; tap again to clear). The format is `Label (n)`:

| Pill | Counts | Tint |
|---|---|---|
| **Receipts (585)** | all receipts in the date window | none |
| **Uncategorized (12)** | receipts with no company | orange when > 0 |
| **Issues (7)** | receipts with any unacknowledged flag (see §4) | red when > 0 |
| **Date check (16)** | receipts whose date disagrees with when the photo was taken | red if any are a month jump, amber if only day gaps |

The Date check pill **deliberately ignores the date filter**, because a receipt that jumped months is by definition outside the window being looked at. When it's active, this hint shows: *"Receipts whose date doesn't match the day the photo was taken. The date filter is ignored here on purpose — a receipt that jumped months is outside the window you're looking at. Open one to correct the date or confirm it's genuine."*

**Toolbar:**
- Company select: "All companies" plus each company name.
- Date select:
  - 📅 Date: All time
  - This week (Monday-anchored)
  - Last week
  - This month
  - Last month
  - Last 30 days
  - Last 90 days
  - Custom range… (opens a popover with From and To date inputs and a "Done" button; the trigger then reads `2026-09-01 → 2026-09-30`). A dot (●) marks an active date filter.
- "✕ Clear filters" (shown only when a filter is on).
- "Refresh".

When a date filter is active, this caption shows: *"Showing receipts dated **1 Sept – 30 Sept 2026**. Counts above reflect this period."*

Filters persist in the URL (`?pill=issues&company=Waraba%20Gold&date=last_month`) and for the browser session.

**Desktop list (≥ 900 px today): a table.**

| ☐ | thumb | Date ▼ | Vendor | Description | Amount | Cur | Category | Company | |
|---|---|---|---|---|---|---|---|---|---|
| ☐ | 🖼 | Sep 3, 2026 | Sr. Marujo | Team dinner after site visit | 171.07 | EUR | Meals | `Waraba Gold` | Open |
| ☐ | 🖼 | Sep 2, 2026 ⚠ | Hôtel Ivoire | 2 nights, Abidjan | 85000.00 | XOF | Hotels | `Waraba Gold` | Open |
| ☐ | ✉️ | Sep 1, 2026 | Ryanair | LIS–MAD | 89.99 | EUR | Flights | `Lithium Africa` | Open |
| ☐ | ✏️ | Aug 29, 2026 | Starbeans | Coffee | 4.50 | EUR | Meals | `Personal` | Open |
| ☐ | 🖼 | Jun 2, 2026 | Botanical Holdings | | — | | | `Uncategorized` | Open |
| ☐ | ✉️ | May 20, 2026 | Saily (eSIM) | United States 20 GB / 30-day eSIM data plan | 36.99 | USD | | `Uncategorized` | Open |

- **Thumbnail column:** the receipt photo for image receipts; ✉️ for PDFs and emailed text receipts; ✏️ for manual entries.
- **Sortable columns:** Date (default newest first), Vendor, Amount, Cur, Category, Company.
- **Amount** is shown exactly as stored, a plain decimal string with no thousands separator. Fixing that is a display decision for the design (§5).
- **Date marker:** ⚠ (red) beside the date for a month jump; • (amber) for a day gap. The tooltip reads, for example: *"This receipt is in a different month from the day it was photographed. Receipt dated 3 Aug 2026, photographed 3 Sep 2026 (31 days)."*
- **Row tints:** failed or no-amount; possible duplicate / edited-vs-OCR; over limit (orange); month jump (red); day gap (amber).
- **Company chip:** a coloured pill. The colour is hashed from the name into a 10-colour palette. Personal is always slate. "Uncategorized" is grey.
- **Issues and Date check views:** an issue chip with the reason is prefixed to Description, and possible duplicates are grouped next to each other. The exact reason strings are:
  - "OCR failed"
  - "Wrong month? Filed earlier than the photo"
  - "Wrong month? Dated after the photo"
  - "Possible duplicate"
  - "No amount"
  - "Currency can't be converted — left out of report totals"
  - "Over category limit"
  - "Edited values differ from OCR"
  - "Photographed days after the receipt date"
- **Bulk bar (desktop only, when rows are ticked):** "**3** selected", "Reassign company…" (including "— Clear company —"), "Reassign category…" (including "— Clear category —"), "Delete (3)", "Clear selection". During the action the delete button reads "Working…".

**Phone list (< 900 px today): cards, with no selection and no sorting (newest first).**

```
[thumb]  Sr. Marujo                         EUR 171.07
         Sep 3, 2026            [Meals] [Waraba Gold]
         with Alice Singh
         (badge) Reading…  |  OCR failed  |  <issue reason>
```

The vendor falls back to "(unknown vendor)". The amount is shown as `CUR amount`, or "—" if there is none. Uncategorized cards have a distinct style.

**Footer hint while OCR runs:** *"2 receipt(s) still being read by Claude — refresh in a moment."* Nothing refreshes automatically.

**Floating button:** "✨ Smart AI", bottom-right. It opens a docked chat panel with the header "✨ Smart AI" and ×. See 2.13.

**First-visit tour:** five spotlight steps over the real dashboard. See 2.14.

**States:**
- **Loading:** "Loading…"
- **Empty, first use:** "No receipts yet." + "Capture your first one →"
- **Empty, filtered:** "No receipts match these filters." + "✕ Clear filters"
- **Error:** a red box with the raw server message (for example "HTTP 500" or "report generation failed: …"). Today the whole list is replaced by nothing and the error sits above.

**What the design must solve here:**
- No money total appears anywhere on the dashboard today. The data allows **per-currency** totals of the receipts in view (computed in the browser). It does **not** allow a single converted total: currency conversion exists only inside report generation, and the receipt API returns no rate. Totals must therefore be shown per currency, for example `EUR 1,284.60 · USD 36.99 · XOF 85,000`.
- **Only the 100 most recently uploaded receipts are loaded.** `GET /api/receipts` defaults to `limit=100`, and the dashboard doesn't pass a limit. Carl has about 585 receipts, so older receipts don't appear and every count, duplicate check and Date-check figure covers only those 100. The API accepts `limit` up to 500. There is **no pagination or search endpoint** (NOT BUILT). Design a "Showing newest 100 · Load more" pattern only if the build raises the limit; don't design server-side search.

**Phone vs desktop target:**
- **390 px:** pills as a horizontally scrollable row of tags; filters collapse behind one "Filter" control showing a count of active filters. Cards as above. Capture is a large primary button reachable by thumb (bottom bar or floating), with Manual secondary to it.
- **1440 px:** the table at full width with a fixed header, the totals strip above the table, and the bulk bar sticky at the bottom when rows are selected.

### 2.2 Capture (`/capture`)

**Purpose:** get a receipt photo or file into the app and read it.

**Idle screen:**
- "Snap a photo of your receipt — Claude will read it."
- Primary: **"Open camera"** (rear camera).
- Secondary: **"Pick photo(s) or PDF from files"** (multi-select; images or PDF).
- A tips block:
  - "**Multi-page invoice?** Open camera, take the first page, then tap "+ Add another page" on the preview to keep going. All pages are combined into one PDF receipt."
  - "**Bulk upload tip:** in the file picker, tap-and-hold on iPhone or Cmd-click on Mac to select multiple files at once. Each becomes its own receipt."
  - "No signal? Use your Camera app and email to `receipts@esprey.net`."

**After picking, one of four previews:**
1. **Single photo:** the full image. Actions: "Retake", "+ Add another page", **"Save"**.
2. **Multi-page:** "Multi-page document · 3 pages" with a list of "Page 1 · (camera shot) · 412 KB" rows and the note "Pages will be combined into a single PDF and saved as one receipt." Actions: "Start over", "+ Add another page", **"Save as 3-page PDF"**.
3. **Bulk:** "5 files selected" with a list of rows (📄/🖼️, filename, size) and progress "Uploading 2 of 5… · 1 failed". Actions: "Start over", **"Upload 5 files"**.
4. **Single PDF:** 📄 filename, "84 KB · application/pdf", "Claude will read the PDF contents." Actions: "Start over", **"Save"**.

**Busy labels:** "Uploading & reading…" (5–10 s, while OCR runs before the screen moves on), "Building PDF & uploading…", "Uploading 2/5…".

**After saving:**
- A single receipt or multi-page PDF goes **straight to the Receipt detail screen**, already read.
- A bulk upload goes back to the dashboard.

**Offline state:** "📡 No internet detected." followed by *"Photos taken in this app are not yet saved while offline — they'd be lost when the upload fails. As a fallback right now: take the photo with your phone's Camera app, then email it to receipts@esprey.net. Your mail app's outbox will queue and send it when you're back online."* An offline photo buffer is **NOT BUILT** (ROADMAP #13).

**Error state:** a red box with the server message. HEIC files on desktop Chrome can't be converted and fail with a server error.

**Phone vs desktop:**
- **Phone:** this is the most important phone screen. Preview edge to edge, actions in a bottom bar.
- **Desktop:** mostly the file-picker path. Show the drop zone and the bulk list (drag-and-drop is **NOT BUILT**; the picker is).

### 2.3 Manual entry (`/capture-manual`)

**Purpose:** a cash expense with no receipt.

**Fields:**
- Vendor (placeholder "e.g. Cash taxi, Coffee shop")
- **Amount \*** (placeholder "0.00")
- Currency (defaults to **EUR**)
- Date (defaults to today; future dates are clamped to today)
- Company
- Category
- People present
- Notes (placeholder "What was this for?")

**Action:** **"Save expense"** (busy: "Saving…"). It returns to the dashboard.

**Error:** "Amount must be a positive number (e.g. 12.50)." There is no tip selector here, unlike Receipt detail.

**Phone vs desktop:** a single column on both. On desktop, cap it as a centred form card.

### 2.4 Receipt detail (`/receipt/:id`), the most-used screen after the dashboard

**Purpose:** check what was read, fix it, assign a company and category, record who was there, and clear any flags.

**Header:** "← Back", the title "Receipt", and **"Delete"** (danger). Delete uses the native confirm *"Delete this receipt? It moves to Trash for 30 days, then it's gone for good."*

**Flag banners**, stacked above the content in this order. Each is shown only when it applies, and each records an audit flag when acknowledged:

1. **Date mismatch.** Red for a month jump, amber for a day gap.
   - Title: "⚠ This receipt is dated in an earlier month than its photo" / "… in a later month than its photo" / "This receipt was photographed well after its date".
   - Mini-table: Photo taken **Sep 3, 2026** · Date read from receipt **Aug 3, 2026** · Gap **1 calendar month · 31 days**.
   - Explainer: "Because expense reports are generated per month, a receipt in the wrong month lands in a report you may have already sent — and gets missed entirely. Worth a second look at the image."
   - Buttons: **"Change to Sep 3, 2026"** (the suggested fix) and "The date is right — dismiss".
   - Source note: one of "from the photo's own timestamp" / "from the photo file's date" / "from the date the email was sent" / "approximate — taken from when it was uploaded, not the photo itself".
2. **Why this receipt is flagged.** Amber.
   - "OCR failed to process this receipt. Fill in the amount, currency, and date manually below." with the button **"🔄 Try reading it again"**.
   - Or: "No amount was extracted from this receipt. Enter the amount manually in the Amount field below."
   - Or: "Possible duplicate — same vendor, amount, and date as this receipt: Sep 3, 2026 · Sr. Marujo · 171.07 EUR." with the button **"Acknowledge — this is a separate expense"** and the note "Clicking confirms you're intentionally claiming this even though it matches another receipt. If it really is a duplicate, delete one instead."
3. **Over the spending limit — Meals.** Amber.
   - "This receipt is EUR 171.07 — over the EUR 80.00 limit for Meals."
   - Button: **"Acknowledge — I know this is over the limit"**.
   - Note: "Clicking records that you're knowingly claiming an over-limit expense and clears the Issues flag. The acknowledgement stays on the receipt's record."
4. **OCR vs your edits — please review.** A three-column table: field | OCR extracted | You entered (for example Amount | 171.07 | 117.07).
   - Button: **"Acknowledge override"**.
   - Note: "Clicking confirms your values are correct. The receipt will no longer appear under Issues."

Design rule from Carl: a banner **never** suggests editing the amount or date to make a warning go away, because that would invite double claims. Keep that.

**Receipt viewer (left on desktop, top on phone):**
- An image, rotatable in 90° steps with "⟳ Rotate"; the rotation is saved.
- Or an embedded PDF (attachments and rendered emails).
- Or "✉️ Email receipt" with the plain text of the email body.
- Or "✏️ Manual entry — No receipt image — entered manually. Fill in details on the right."
- Under it: "Uploaded Sep 3, 2026 · OCR: success". This shows the raw status word: pending / success / failed / manual.

**Form (right on desktop, below on phone):**
- Vendor
- Amount + Currency side by side. The Amount box takes the **bill** as printed; commas become dots.
- Date (max today)
- Company: a select with "— pick a company —", **Personal** always first, the person's permitted companies, and "+ Add new company…" (admins only).
- Category: the same pattern, with "+ Add new category…" for admins.
- **Tip.** Appears only when the category name contains meal, restaurant, food, dining, drinks, bar, taxi, uber, lyft, cab or rideshare.
  - Choices: No tip / 5% / 10% / 15% / 20% / Custom amount… (with a "Tip amount" field, "e.g. 5.00").
  - It shows a live breakdown:
    ```
    Bill (from receipt):        18.40
    Tip (10%):                   1.84
    Total (saved to report):    20.24
    ```
- **People present:** selected names as removable chips; search "Type a name — pick from the list, or hit Add to create"; an inline **+ Add "Alice Singh"** button; groups "Favourites" (★) and "Others"; empty state "No people yet — type a name above to add."
- Notes (3 lines).
- **"Save & close"** (busy: "Saving…"). It returns to the dashboard.

**Errors:**
- "Amount must be a positive number (e.g. 12.50). Letters aren't allowed."
- "Receipt date is in the future — please pick today or earlier."
- A server message for anything else.

**Loading:** "Loading…" under the header.

**Data on the row but not shown in the UI** (available if the design wants it):
- `source`: camera / email / manual.
- `source_meta` for email receipts: sender address, subject, and the email's Date header.
- `fx_rate_date`: the day the exchange rate is locked to. The **rate value itself is not returned** by the receipt API (DATA DOES NOT EXIST on this endpoint).
- `uploaded_at` and `captured_at`.

**Phone vs desktop:**
- **Phone:** the receipt image first, collapsible to a strip once scrolled. Banners are compact with one primary action each. The Save action is sticky at the bottom.
- **1440 px:** today this is two equal columns inside 720 px, which wastes the screen. The target is the image large on the left (pinch or zoom) with banners and the form on the right.

### 2.5 Monthly reports (`/reports`), the month-end export

**Purpose:** produce the month's invoice PDF (and a ZIP of the originals) for one company, then download or email it.

**Warning banner** (red), shown when receipts dated in the chosen month were photographed in a later month:
- "⚠ 2 receipts in this month were photographed later".
- "Their date may have been misread, which would put them in the wrong report. Check each one before generating."
- Up to 8 linked lines, for example "Sr. Marujo · 171.07 EUR — Receipt dated 3 Aug 2026, photographed 3 Sep 2026", then "…and 3 more."
- Button: "Review all date mismatches (5)".

**Form ("Generate a report"):**
- **Month:** 24 months back, defaulting to **last month** ("September 2026").
- **Company:** "All companies (combined PDF)", "Personal", then each company.
- **Currency:** "All currencies", or a target such as "USD — US Dollar" (converts every line).
- **Report language:** English / Français / Português (Portugal). With a non-English choice the hint reads "Descriptions and categories are translated. Establishment names stay exactly as printed on the receipts."
- **"Generate"** (busy: "Generating…", 5–15 s).

The company, currency and language choices are remembered on the device.

**Result card:**
- "✅ Generated **September 2026 — Waraba Gold — USD** · 14 receipts · 2.3 MB"
- "Open PDF" · "Download PDF" · "📧 Email PDF". Emails go **only to the signed-in user**; the confirmation reads "📧 PDF emailed to cesprey@gmail.com."
- "Download originals (14 files, 18.6 MB)" · "📧 Email ZIP"
- Warnings:
  - "This PDF is 31.2 MB — too big to email (limit ~28 MB). Use Download instead."
  - "ZIP build failed: …"
  - "Email failed: …"

**Filenames when a report leaves the app** (fixed convention, do not change):
- `Expense Report - Waraba Gold - September 2026 - USD.pdf`
- `Receipts - Waraba Gold - September 2026.zip`
- All companies: `Expense Report - September 2026.pdf`

**Empty state:** none today. A month with zero receipts still generates a near-empty invoice. Design an honest pre-check ("No receipts for Waraba Gold in September 2026"). The data for that exists client-side if the 100-row limit is raised.

**Half-built:** `GET /api/reports` returns the list of **previously generated reports** (file, month, company slug, size, generated time, download URL), and `DELETE /api/reports/delete` exists. **No screen uses either.** Today a past report can only be re-downloaded by regenerating it. A "Past reports" list below the form is supported by real data. Design it.

**Phone vs desktop:**
- **Phone:** form fields stacked; Generate full width; the result card with three big actions.
- **Desktop:** the form on the left and the past-reports table on the right (Month | Company | Currency | Size | Generated | Open · Download · Email).

### 2.6 PDF viewer (`/pdf?file=…`)

**Purpose:** read a generated report inside the app (PDF.js, page by page).

**Layout:**
- Bar: "← Back", the filename, "Save".
- Canvas.
- Pager: "‹ Prev", "Page 2 of 9", "Next ›".

**States:** "Loading PDF…"; an error box with the pdf.js or server message.

**Phone vs desktop:** full screen on both; the page fits the width (max 1200 px).

### 2.7 Settings (`/settings`)

One long scrolling page of sections today. Section titles, in order:

1. **My profile.** A row "Personal details · Name, address, bank details (used on invoices)" → [Edit].
2. **Team** (admins only). "Manage team members · Add or remove people who can sign in" → [Open].
3. **How this works.** "Help & FAQ · Searchable answers + ask-a-question box" → [Open].
4. **Companies.**
   - The list (name, with the full legal name beside it if it differs).
   - Admins: tap a name to edit it; [Delete] with a native confirm; an input "+ Add company" + [Add]; the hint "Tap a company name to edit address & full legal name (used in invoices)."
   - Members: "Companies are managed by the admin. Ask Carl to add a new one if you need it."
5. **People** (the person's own attendee list). Rows with a ★ favourite toggle, the name and [Delete]; an input "Add a person" + [Add].
6. **Categories.**
   - Admins: each row has a right-aligned **spending limit** input (placeholder "No limit", saves on blur), plus [Delete].
   - Hint: "Spending limit is per receipt. Anything over it gets flagged in Issues until the team member acknowledges it."
   - Members see "· limit 80.00" beside each name.
   - Add: "New category name" + [+ Add category].
   - **Spending limits have no currency.** A limit of 80.00 is compared to the receipt's own amount whatever its currency (so 80 XOF and 80 EUR are treated alike). This is a known gap; show the limit as a bare number and flag it, don't invent a currency.
7. **Currencies.** Rows "EUR — Euro". Admins get [Delete] and an add row (CODE, max 4 characters, plus "Currency name", plus [Add]).
8. **Trash.**
   - "Deleted receipts appear here for 30 days, then they're gone for good."
   - Rows "**Sr. Marujo** · EUR 171.07 · Sep 3, 2026" with [Restore] (busy: "Restoring…").

**Empty states:** "No entries yet." per list.

**Errors:** an inline red line per section.

**Phone vs desktop:**
- **Phone:** a grouped list with each section as its own drill-in page, instead of one 8-section scroll.
- **Desktop:** a left section rail with the content on the right.

### 2.8 My profile (`/settings/user`)

**Intro:** "These details appear at the top of every monthly invoice (BILL FROM block) and in the payment-details footer."

**Sections:**
- **Language / Langue / Idioma.** "App language" (English / Français / Português (Portugal)), with the hint "Receipt descriptions are also written in this language." Button **"Translate my existing receipt descriptions"**; it uses a native confirm and reports a result such as "✅ 143 — descriptions translated."
- **Identity.** Full name; Business name ("Optional — if you invoice through a company"); Email ("Contact email shown on invoice"); Phone.
- **Address.** Address line 1; Address line 2 ("City, region, postcode"); Country; VAT / Tax number.
- **Payment details.** "Payment instructions", a monospace textarea of 8 lines with the placeholder:
  ```
  Bank name:
  IBAN / Account number:
  SWIFT / BIC / Sort code / Routing:
  Account holder:
  ```
  It is printed word-for-word on every invoice.

**Action:** **"Save & back"**.

**Phone vs desktop:** a single-column form on both; on desktop, a preview of the invoice header beside it would help. The data exists for that.

### 2.9 Company detail (`/companies/:name`), admin, English only

**Purpose:** set the legal details printed in the invoice's BILLED TO block.

**Intro:** "Short name (used in the app dropdowns): **Waraba Gold**. Edit the longer-form details below — these appear on the invoice's BILLED TO block."

**Fields:**
- Full legal name (placeholder "e.g. Waraba Gold Limited")
- Address line 1
- Address line 2
- Country ("e.g. Canada")
- VAT / Tax number

**Action:** **"Save & back"**.

**States:** "Loading…"; an error box.

### 2.10 Team (`/settings/team`), admin, English only

**Add a team member:**
- Explainer paragraph (about one-time codes, private data, shared dropdowns).
- Fields: Email ("alice@example.com"), Display name (optional, "Alice Singh"), Language (EN/FR/PT).
- **"Add member"** (busy: "Adding…").
- Result: "✅ Added alice@example.com. Cloudflare Access updated. Welcome email sent to alice@example.com."

**Current members (9).** One card per member:
- Name · email; badges **admin**, **you**, **not in CF** (warning).
- [Remove], which uses a long native confirm explaining that the data is kept.
- [Wipe & remove], a permanent wipe that requires typing the email into a native prompt; the result shows in a native alert.
- Aliases: "↳ alice.work@example.com" [Remove alias]; "+ Add another email for this person".
- **Company access** (non-admins): a checkbox grid of companies with "Save access" / "Cancel" and "Saved — user can pick: Waraba Gold, Lithium Africa, and Personal."

**Cloudflare Access drift** (only when it applies): emails on the allow list but not in the team table, and members missing from the allow list.

**States:** "Loading…"; "No members yet."; an error box.

**Phone vs desktop:**
- **Phone:** member cards stacked; destructive actions inside an overflow menu.
- **Desktop:** a member table with an expandable row for aliases and company access.

### 2.11 Help & FAQ (`/instructions`)

**Layout, top to bottom:**
1. **"🚀 Show me around again"**, which relaunches the tour.
2. **How do I…?** An input ("Ask anything — e.g. how do I forward a receipt by email?") with [Ask] (busy: "Thinking…"); the answer box; the hint "Answers usage questions only — it can't see your receipts or change anything."
3. **FAQ search** ("Search the FAQ… (e.g. duplicate, email, tip)") with **19 accordion questions**:
   - "How do I add an expense?"
   - "How do I email a receipt in?"
   - "How do I capture a multi-page receipt or invoice?"
   - "What does the Issues count on the dashboard mean?"
   - "What is a possible duplicate and how do I clear it?"
   - "What is the Date check pill, and why is a date flagged?"
   - "Why does it say my edited values differ from OCR?"
   - "What is a spending limit and why is my receipt over it?"
   - "How do I delete a receipt, and what is Trash?"
   - "How do tips work on meals and taxis?"
   - "How do I generate a monthly report?"
   - "Can reports be in a different language from the app?"
   - "Do attendees show up in reports?"
   - "How does currency conversion in reports work?"
   - "What's private to me and what's shared?"
   - "What should I set up first?"
   - "How do I install the app on my phone?"
   - "What if I have no signal when I get a receipt?"
   - "Who do I contact for help?"

**Empty search:** *Nothing matches "xyz". Try the question box above, or email Carl.*

### 2.12 Concierge, full page (`/concierge`)

The same chat as 2.13 at full page. **The route exists but nothing links to it.** Everyone reaches the chat through the Smart AI button. Either give it an entry point (for example on phone) or drop it from the canvas, and say which.

### 2.13 Smart AI panel (floating, over the dashboard)

**Purpose:** ask questions about your own receipts, or have it record or edit one.

**Contents:**
- Empty state: "Ask me about your expenses, or tell me to record one:" followed by three examples:
  - "How much did I spend on meals last month?"
  - "Record a 4.50 coffee at Starbeans today, category Meals"
  - "Which receipts still have issues?"
- The note "I can only see and change YOUR receipts. Team and settings changes happen in Settings."
- User and assistant bubbles; a "Thinking…" bubble while it works.
- **Delete confirmation card:** "⚠️ Delete Starbeans · 4.50 EUR · 2026-08-29?" with [Confirm delete] (busy: "Working…") and [Cancel]. The results are "✅ Done — moved to Trash (restorable for 30 days)." or "Okay — cancelled, nothing was deleted." Pending actions expire after 10 minutes.
- Input: "Message the Concierge…" + [Send].

History persists per user.

**Phone vs desktop:**
- **Phone:** the panel becomes a full-height sheet.
- **Desktop:** a docked side panel of about 380 px that doesn't cover the table's Amount column.

### 2.14 Guided tour (overlay, first visit and on demand)

**Behaviour:** five steps that spotlight real dashboard elements, with step dots and the controls Skip / Back / Next / "Got it!".

**Steps:**
1. **Add receipts.** "Tap + Capture to photograph a receipt — the amount, vendor and date are read for you. You can also email receipts in, or add cash expenses manually."
2. **Your counters.** "Receipts shows everything. Uncategorized still needs a company. Issues turns red when something needs your attention — tap it to see why."
3. **Monthly reports.** "At month-end, generate a polished PDF of your expenses here — in the language of your choice."
4. **Your assistant.** "Ask anything — "how much did I spend on meals?" — or tell it to record an expense for you. It only ever sees your own receipts."
5. **Need help?** "The ? opens the FAQ with an ask-a-question box. You can rerun this tour from there anytime."

**Rule:** the redesign must keep elements the tour can point at: Capture, the pills row, Reports, Smart AI and Help.

### 2.15 Reference only: the report PDF (the export, do not redesign)

Generated server-side with pdf-lib and **out of scope**. It is listed here so the in-app result card and preview make sense.

**Page 1, the invoice:**
- BILL FROM (left): business or person name in large type, address, VAT, email, phone.
- Right: "I N V O I C E", No. **EX-202609-WARABAGOLD-USD**, Issue date **1 October 2026**.
- A gold rule.
- BILLED TO: full legal name, address, VAT.
- FOR: "Reimbursable expenses — September 2026 (USD)".
- The line table: Date | Vendor | Category | Description | Amount | Currency. **Landscape** when converting: Date | Vendor | Description | Original | Cur. | Rate | Amount (target).
- Subtotal / Tax **—** / **Total due**, and "2 row(s) could not be converted — excluded from total".
- "Exchange rates: … · locked to each receipt's own date".
- PAYMENT DETAILS.
- Footer: "Thank you for your business."

**Following pages:** "Breakdown by category": uppercase category headings with a gold rule, lines with "with Alice Singh" underneath, and per-currency subtotals.

**Then:** "Appendix — original receipts", one receipt per page.

### 2.16 Reference only: emails

All are sent by the system and **out of scope**:
- **Report:** "Expense report — September 2026".
- **Bounce** to unknown senders: "Receipt not saved — your email address isn't registered".
- **Welcome email** (EN/FR/PT) to new members.

Successful emailed receipts get **no confirmation email**. They simply appear on the dashboard.

### 2.17 Unknown URL

Any unmatched route renders the dashboard. There is no 404 screen.

---

## 3. The flows that matter

### 3.1 Submit a receipt with a photo (built)

1. Dashboard → **+ Capture** → **Open camera** → take the photo.
2. Preview → optionally **+ Add another page** (repeat) → **Save** / **Save as 3-page PDF**.
3. The phone holds on "Uploading & reading…" for **5–10 s** while Claude reads the image. In the background the EXIF shutter time is captured for the Date check.
4. It lands on **Receipt detail**, already filled in: vendor, amount, currency, date, and a short note in the user's language.
5. The user picks **Company** (otherwise the receipt sits in *Uncategorized*) and **Category**, chooses a tip if it's a meal or taxi, adds **People present**, and checks the date.
6. If a banner appears, they resolve it (fix, or acknowledge).
7. **Save & close** → back to the dashboard, with the filters restored.

**Alternatives:**
- **Email:** forward the receipt to `receipts@esprey.net` from a registered address. It appears within about a minute with `source = email`, but with **no company set**, so it lands in Uncategorized.
- **Manual:** + Manual → the form → Save expense.

**Where people get stuck today:**
- **The month slip.** OCR reads "03/08" as 3 August on a receipt photographed on 3 September. The receipt files itself into a month whose report has already gone, and it's never claimed. This is the most expensive failure in the app. Date check, the red marker, the receipt banner and the Reports warning all exist because of it. The design must make it impossible to miss without making every screen red.
- **Uncategorized pile-up.** Emailed and bulk-uploaded receipts arrive with no company. Assigning one at a time on a phone is tedious, and bulk reassign exists only on desktop.
- **The 5–10 s wait** after Save with no feedback beyond the button label, then another full form.
- **No signal:** in-app capture fails outright; the workaround is email.
- **Four banners can stack** on one receipt, each with its own button.
- **Broken link:** the duplicate banner links to `/receipts/<id>` (plural), but the route is `/receipt/<id>`. The link drops the user on the dashboard. It's a code bug; the design should show sibling duplicates side by side so the link matters less.
- **Older receipts don't show** (the 100-row limit, §2.1).
- **Delete copy is stale:** the bulk-delete confirm says "This also removes the originals from R2.", which is no longer true (they go to Trash).
- **Native browser dialogs** (`confirm`, `prompt`, `alert`) for delete, translate, remove and wipe.
- **HEIC from desktop Chrome** fails.
- **Raw status words** show in the UI ("OCR: manual").
- **Emoji are used as icons** throughout (⚙ 📄 ✨ 📅 ✏️ ✉️ 📧 🔄 🚀).
- The logo is hidden on phones.

### 3.2 Approve or reject: **NOT BUILT**

The app has no approver, no submission step and no approve or reject action. An admin cannot see a team member's receipts. "Approval workflow" sits in ROADMAP §5 (unprioritised ideas). Today, approval happens outside the app: the company or accountant looks at the emailed PDF and replies by email. **Do not draw an approval queue.** If the redesign wants to anticipate one, list it in the "chose not to follow" notes with the data it would need (§9).

What does exist is **self-review**: the Issues pill plus the acknowledge buttons. That is the only gate before a report goes out.

### 3.3 Mark as paid: **NOT BUILT, and removed on purpose**

Carl removed "reimbursement status" from the roadmap on 4 July 2026. Payment is tracked outside the app. **Do not design a paid state.**

### 3.4 Month-end export (built)

1. In the first days of the month: Dashboard → 📄 **Reports**.
2. The page defaults to **last month** and to the company, currency and language last used on this device.
3. A red banner lists any receipts dated in that month but photographed later → open each one, fix or confirm it → come back.
4. Recommended before generating: Dashboard → **Issues** to clear flags, and **Uncategorized** to assign companies. **Nothing enforces this**: the report generates with flags open, uncategorized receipts land under "Uncategorized" in an all-companies report, and unconvertible currencies are left out of the total, with a red line on the invoice.
5. Choose company (e.g. Waraba Gold), target currency (e.g. USD or none), language → **Generate** (5–15 s).
6. **Open PDF** to check it → **📧 Email PDF** (to yourself) and/or **Download PDF**; **Download originals** / **📧 Email ZIP** if the payer wants the files.
7. Forward the email to the company or accountant (outside the app). They pay to the bank details on the invoice.
8. Repeat for each company. There's one report per company per month, or one combined "All companies" PDF.

**Where people get stuck today:**
- There's **no checklist before Generate**: the user has to know to visit Issues and Uncategorized first.
- **No history:** a report generated last week can't be found again without regenerating it (the API exists, the UI doesn't).
- "Email PDF" sends **only to yourself**, so a forward is always needed.
- PDFs over about **28 MB** (photo-heavy months) can't be emailed.
- Nothing records **which receipts went into which report**, so nothing warns that "this receipt changed after September's report was sent" (DATA DOES NOT EXIST).

### 3.5 A claim that bounces back for more information: **NOT BUILT as a claim state**

The two real things closest to it:
- **Email bounce.** A receipt forwarded from an unregistered address is not saved, and the sender gets "Receipt not saved — your email address isn't registered". The fix is an admin adding that address as an alias (Team → "+ Add another email for this person").
- **Flags that need the owner's answer:** OCR failed → "🔄 Try reading it again" or fill it in by hand; no amount; possible duplicate; over limit; edited-vs-OCR; date mismatch. Each one sits in **Issues** until it's fixed or acknowledged.

A query from the company or accountant about a sent report happens by email. The app has no record of it.

---

## 4. States

### 4.1 The states a receipt can actually be in

| State (what the user should see) | Defined in code by | Member (owner) can | Admin can (own receipts only) | Accountant / payer |
|---|---|---|---|---|
| **Reading** | `ocr_status = pending` (mostly emailed receipts; camera uploads wait for OCR) | open, wait, refresh | same | no access |
| **Read** | `ocr_status = success`, amount > 0 | edit everything, assign company and category, add people, delete | same, plus add new companies, categories and currencies inline | no access |
| **Needs details** | `ocr_status = failed`, **or** no amount / amount ≤ 0 | retry OCR (failed only), type the amount, currency and date | same | — |
| **Edited** | `ocr_status = manual` (any content edit) — not a problem in itself | as Read | same | — |
| **Manual entry** | `source = manual` (no image; exempt from the Date check) | as Read | same | — |
| **Uncategorized** | `company` empty | assign a company (one at a time; bulk on desktop) | same | — |
| **Flagged** (one or more, independently): *Possible duplicate* (same vendor + amount + date, `duplicate_acknowledged = 0`) · *Over category limit* (`policy_acknowledged = 0`) · *Edited values differ from OCR* (`override_acknowledged = 0`) · *Wrong month* / *Photographed days after* (`date_mismatch_acknowledged = 0`) · *Currency can't be converted* | computed in the browser on every load | fix it, or **acknowledge** it (writes a permanent audit flag; can't be undone in the UI); delete a true duplicate | same | — |
| **Acknowledged** | the corresponding `*_acknowledged = 1` | nothing further; the flag stays on record and the receipt leaves Issues | same | — |
| **In Trash** | `deleted_at` set; hidden everywhere, excluded from reports | **Restore** within 30 days | same | — |
| **Purged** | 30 days after `deleted_at` (row and file removed) | — | **Wipe & remove** a member purges all their receipts at once | — |
| **Included in a report** | **DATA DOES NOT EXIST**: no link between receipts and generated reports | — | — | receives the PDF by email, outside the app |

### 4.2 The states of a report

| State | Defined by | Member | Admin | Accountant / payer |
|---|---|---|---|---|
| Not generated | no R2 object for month × company × currency | Generate | Generate own | — |
| Generated | `reports/<user>/<month>__<company>[__<ccy>].pdf` + `.zip` in R2 (regenerating overwrites it) | Open, Download, Email PDF / ZIP to self | same, own only | — |
| Emailed | **not recorded** | — | — | gets it only if the member forwards it |
| Deleted | API exists, **no UI** | — | — | — |

### 4.3 States the brief asked for that do not exist

**Draft → Submitted → Approved / Rejected / Needs more information → Paid.** None of these exist. They would need a new `status` field per report or per receipt, a submitted-at and decided-at timestamp, an approver role, a way for the approver to see another person's receipts (forbidden by the current per-user isolation), a comment thread, and a payment reference. **Not to be designed** (see §9).

---

## 5. Numbers and formatting

**Currencies.** Any ISO 4217 code an admin adds to the shared list (`code`, `name`), and OCR can save codes that aren't on the list (they show as "GHS — (not in shared list)"). Codes that appear in this app's life: **EUR** (Portugal, the default for manual entry), **USD**, **GBP**, **XOF** (West African CFA franc: Côte d'Ivoire, Mali), **XAF**, **KMF**, **GHS**. Conversion covers about 160 currencies from the daily table; anything else is flagged "Currency can't be converted".

**Storage and arithmetic:**
- Amounts are stored as decimal strings ("171.07").
- All arithmetic is done in integer minor units (×100) and converted back with exactly **two decimals**.
- That means a zero-decimal currency like XOF currently displays as **85000.00**. The design may show XOF, XAF, KMF and JPY without decimals (**XOF 85,000**), but this is a display rule only; storage stays two decimals.

**Amounts in the app today:**
- Desktop table: the raw stored string with the code in its own column (`171.07` | `EUR`).
- Phone cards: `EUR 171.07`.
- No thousands separators anywhere in the app.
- The PDF uses `1,234.56`.

**Target rule for the redesign:**
- Amounts are always in **IBM Plex Mono**, tabular, right-aligned in tables.
- The ISO code comes first: `EUR 1,284.60`.
- A thin space or comma for thousands (pick one and use it everywhere).
- Decimals aligned in columns.
- The code is lighter or smaller than the figure.

**Negative numbers:** none. Amounts must be > 0 to save, and refunds and credits aren't supported. If a design element needs a negative (for example a difference in the OCR banner), use a true minus sign (−) in mono, not red alone.

**Rounding:**
- Tips: bill × (100 + pct) / 100, rounded half-up to the cent. The bill is recovered from the total by the inverse.
- FX: each line converted, then rounded to the cent. **Total = sum of rounded lines.**
- Duplicate and OCR comparisons tolerate 1 cent.

**Exchange rates:**
- Locked to **the receipt's own date**: ECB historical rates via frankfurter.dev; XOF, XAF and KMF derived from the fixed EUR peg (1 EUR = 655.957 XOF); fallback to the daily open.er-api.com table.
- Rates are **shown only in reports**, as "1 unit of source = X target":
  - ≥ 100 → 2 decimals
  - ≥ 1 → 4 decimals (`1.1712`)
  - < 1 → 4 significant figures (`0.001524`)
- The source line is printed at the foot of the invoice.
- The app UI never shows a rate today.

**VAT:** **not captured.** Carl removed net/VAT/gross separation on 4 July 2026. The only VAT data is the VAT *number* on the user profile and on each company. The invoice prints a "Tax" row with "—". **Do not design VAT fields.**

**Dates:**
- Stored as ISO `2026-09-03`.
- The app displays them with the device locale (`Sep 3, 2026` on a US-set iPhone, `3 Sept 2026` on en-GB), so they vary between people.
- Month labels: "September 2026".
- The PDF uses ISO in tables and "1 October 2026" for the issue date.
- **Target rule:** one fixed format in mono, `03 Sep 2026` (day first, three-letter month, translated in FR and PT), with ISO in machine contexts.
- Future dates are rejected; "today" is clamped on iOS.

**What goes in IBM Plex Mono:**
- Every amount
- Currency codes
- Dates
- Invoice numbers (`EX-202609-WARABAGOLD-USD`)
- Report filenames
- Counts inside pills (`(12)`)
- File sizes (`2.3 MB`)
- Email addresses in the Team screen
- Exchange rates
- The payment-instructions textarea

Everything else uses Schibsted Grotesk.

**Totals and subtotals:**
- Dashboard (new): a **per-currency** total of the receipts in view, never a converted grand total (no rates in the app).
- Report invoice: one converted total when a target currency is chosen; otherwise "Subtotals by currency".
- Category breakdown: per-category, per-currency subtotals.
- A total must always say what it covers: "14 receipts · September 2026 · Waraba Gold". If some lines are excluded (unconvertible or no amount), say so beside the total, never silently.

---

## 6. Design direction

**Family.** Esprey Expenses is the **third app in a family** with Esprey Travel and Esprey Health. It must feel like a **sibling, not a clone**: someone who uses all three should know they're from the same hand, and should never confuse one for another.

**Shared with the family (non-negotiable):**
- **Type:** **Schibsted Grotesk** for words; **IBM Plex Mono** for amounts, references and dates (§5 lists exactly what).
- **Construction:**
  - Ink text on a **warm stone** background.
  - **White cards.**
  - **One signal colour.**
  - **Tokens for every colour and every radius.** No literal hex values in components.
  - **Light mode only.**
  - **Phone first.**
  - **44 px minimum touch targets.**
  - **No fake iOS status bar** in the mockups.

**Its own identity:**
- **Signal colour:** its own, distinct from the Travel and Health signals (check against the attached token files). It has to sit beside a status palette of red (wrong month, OCR failed), amber (needs attention, over limit, day gap) and green (clear) without being mistaken for any of them. That rules out red, amber and green as the signal. The signal is for the primary action (Capture, Generate, Save) and the current selection, never for status.
- **Company identity is separate from status.** Today company chips are hashed into ten saturated colours, including red and amber, which collide with status. Propose a calmer scheme (for example a neutral chip with a small colour dot from a muted palette, Personal always neutral), and keep the colour stable per company name.

**The mark:**
- A **rounded ink tile like the Travel one**, carrying a **simple geometric symbol that says "money accounted for"**.
- **Not** a dollar, euro or any currency sign. **Not** receipt clip-art.
- Starting points, not prescriptions:
  - The accountant's **double rule under a total**
  - A **tally that closes** (four strokes and the bar)
  - Two **balanced stacks**
  - A **tick resolving a column**
- **Show three marks to choose from**, each at **1024 px**, as a **180 px app icon** (iOS home screen), as a **32 px favicon**, and at the **20 px top-bar size**. At 20 px and 32 px the symbol must survive as one clean shape.
- The current icon (`icon-source.png`, a rasterised placeholder) is being replaced.

**Language:** the app name is "Esprey Expenses"; the short name under the home-screen icon is "Expenses". Copy is plain, short and specific, matching what's quoted throughout §2. Keep the existing strings unless a change is clearly better; the FR and PT dictionaries depend on them.

---

## 7. What makes an accounting app feel good rather than boring

- **Calm tables that scan in a glance:**
  - Hairline rows and generous row height.
  - Amounts right-aligned in mono with the decimals lined up.
  - Dates in mono, left.
  - Vendor in Grotesk at a confident weight.
  - Description in a muted ink.
  - No zebra stripes, no grid.
  - A flagged row is shown by a status tag and a thin coloured edge, not a tinted row (today's tints compete with each other).
- **Status as colour-coded tags, not paragraphs.** Every reason in §2.1 becomes a short tag ("Wrong month", "Duplicate?", "Over limit", "No amount", "Can't convert", "Edited", "Reading…"). The explanation lives on the receipt, one tap away. The four detail banners become one consistent pattern: tag, one sentence, one primary action, one secondary.
- **The next action is always obvious:**
  - Dashboard with issues → "Resolve 7".
  - Uncategorized receipts → "Assign 12".
  - Clean month → "Generate September report".
  - Receipt detail → the one thing still missing (company, then category).
  - Reports → a short pre-flight list (date mismatches, open issues, uncategorized for this company and month) before Generate. It's built from data the page already loads.
- **Totals you can trust:** per currency, labelled with what they cover, never mixing currencies, stating exclusions.
- **Receipts you can actually see:**
  - Real thumbnails on every row and card. Today the full-size image is used as the thumbnail; `thumb_r2_key` exists but isn't populated.
  - A large, zoomable image on detail.
  - PDFs and emails rendered legibly.
  - The photo and the read values side by side on desktop.

**Tables at 390 px** (state what collapses and what stays):

- **Stays on every row:** thumbnail (40 px), vendor (one line, truncated), amount + code (mono, right), date (mono, small), and one status tag if flagged.
- **Collapses into a second line:** category · company chip. Attendees appear as a third muted line only if present.
- **Hidden at 390 (visible on open):** description/notes, source icon, sort controls (replaced by a single "Sort: Date ▾" control), selection checkboxes (replaced by a long-press or "Select" mode if bulk reassign is offered on phone; today it isn't).
- **Group headers by month** ("September 2026 · EUR 1,284.60") so the month the receipt will be reported in is always visible. This is the phone-sized answer to the month-slip problem.
- The same rules apply to the Reports history, the Team list and Trash.

---

## 8. Outputs needed from Claude Design

1. **A canvas with every screen in §2.0–§2.14 at 390 px and 1440 px.** Include the states that matter:
   - Dashboard: empty, filtered-empty, loading, error, Issues view, Date check view, bulk selection (desktop), Smart AI open.
   - Capture: idle, single preview, multi-page, bulk with progress, offline.
   - Receipt detail: clean, with each of the four banners, with tip, with the people picker open.
   - Reports: with the date warning, with a result, with the over-28 MB warning, and the new past-reports list.
   - Settings at section level, My profile, Company detail, Team, Help & FAQ, the Concierge sheet, and one tour step.
   - The login customisation (logo + colour) as a small spec card.
2. **DESIGN.md** with tokens:
   - Colours: stone background, card, ink ramp, lines, the signal and its states, status red/amber/green (each with background and foreground), and the company-chip palette.
   - Radii.
   - Type scale for both families, including the mono sizes for table amounts versus total amounts.
   - Spacing scale.
   - Elevation (if any).
   - Touch-target and breakpoint values.
   - Named in the same style as the Travel and Health token files.
3. **Logo files:** an **SVG master** of the chosen mark, plus the three candidates. **App icon** PNGs at 1024 / 512 / 256 / 192 / 180 (the PWA manifest uses 192, 256, 512, 1024 and a 512 maskable; iOS uses 180). **Favicon** at 32 px (SVG and PNG). The 20 px top-bar version.
4. **A short list of anything in this brief it chose not to follow, and why**, including any place the design assumes data marked NOT BUILT or DATA DOES NOT EXIST.

---

## 9. What is not to change

- **The backend:** Cloudflare Pages Functions, the email worker, OCR, the FX logic, Cloudflare Access sign-in, Resend emails. The redesign is front-end only (`src/`).
- **The data model:** the `receipts`, `companies`, `categories`, `currencies`, `people`, `team_members`, `team_member_aliases`, `team_member_companies`, `user_profile`, `fx_rates` and `concierge_*` tables and their columns. No new fields.
- **The rules:**
  - Per-user isolation: nobody sees anyone else's receipts, admin included.
  - Admin-only editing of the shared companies, categories and currencies.
  - "Personal" is always available and never a real company.
  - The acknowledge-don't-edit audit pattern for duplicates, over-limit, OCR overrides and date mismatches.
  - The date-mismatch rules (different month always flags; same month only beyond 3 days; weaker capture sources get weaker rules).
  - Soft delete with 30-day Trash.
  - The Concierge can only delete via an in-app confirm.
  - Spending limits are per receipt.
  - (The app has no approval rules; there are none to keep or invent.)
- **The export format:** the report PDF layout (invoice, category breakdown, appendix, landscape when converted, the gold rule), the invoice number format `EX-YYYYMM-COMPANY[-CCY]`, the filenames `Expense Report - <Company> - <Month YYYY>[ - CCY].pdf` and `Receipts - <Company> - <Month YYYY>.zip`, the ZIP contents, and the email subjects.
- **Languages:** English, French and Portuguese for every member-facing screen. Team and Company detail stay English.

**Flagged: screens or elements that would need data that does not exist** (don't design around these quietly):

| Wanted | Status |
|---|---|
| Approval queue, approver role, approve / reject / needs-info | **NOT BUILT**; would need a status field, an approver role, cross-user visibility, comments |
| Mark as paid, payment reference | **NOT BUILT**; removed by Carl |
| VAT / net / gross on a receipt | **NOT BUILT**; removed by Carl |
| CSV or accounting export | **NOT BUILT**; parked |
| Which receipts were in which report; "changed since sent" | **DATA DOES NOT EXIST** |
| Converted grand total on the dashboard; the rate on a receipt | **DATA DOES NOT EXIST** in the app (rates live only in report generation) |
| Search by text; server-side pagination | **NOT BUILT** (the list is capped at 100 by default, 500 max) |
| Offline capture queue | **NOT BUILT** (ROADMAP #13) |
| Small thumbnails | Column exists, **not populated** |
| Currency on a spending limit | **DATA DOES NOT EXIST** |
| Dark mode | Out of scope (light only) |
| Past reports list | **Data exists, UI missing**: design it |
| Per-currency dashboard totals, Reports pre-flight checklist, month group headers | **Data exists**: design them |
