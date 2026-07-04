// Single source of truth for in-app help. Rendered by the FAQ page
// (src/pages/Instructions.tsx) AND fed to the "How do I…" AI help widget
// (functions/api/help/ask.ts) as its ONLY knowledge source — keeping the two
// in sync by construction. Plain text only: no JSX, no markdown.

export interface FaqItem {
  q: string;
  a: string;
  keywords?: string; // extra search terms not present in q/a
}

export const FAQ: FaqItem[] = [
  {
    q: "How do I add an expense?",
    a: "Three ways. 1) Camera: tap the camera button on the home screen and snap the receipt — vendor, amount, date and currency are read automatically. 2) Email: forward any receipt to receipts@esprey.net from a registered address. 3) Manual entry: for cash with no receipt, tap Manual entry and fill in at least the amount.",
    keywords: "capture photo scan new receipt create",
  },
  {
    q: "How do I email a receipt in?",
    a: "Forward it to receipts@esprey.net from one of your registered email addresses. PDFs, photos, and text-only confirmations (Uber, Airbnb, airlines) all work — it appears in your dashboard within a minute, fully read. If you forward from an address the app doesn't know, you get a bounce-back; ask the admin (cesprey@gmail.com) to add that address as an alias on your account.",
    keywords: "forward inbox alias bounce unregistered",
  },
  {
    q: "How do I capture a multi-page receipt or invoice?",
    a: "After the first photo, the preview screen shows an \"+ Add another page\" button. Keep snapping — all pages are combined into a single PDF receipt and the total is found wherever it appears.",
    keywords: "pages long invoice combine pdf",
  },
  {
    q: "What does the Issues count on the dashboard mean?",
    a: "Issues collects receipts that need your attention, each with a reason chip: OCR failed (couldn't read the receipt), no amount extracted, possible duplicate, edited values differ from what was read off the receipt, or over the category spending limit. Fix the data or acknowledge the flag and the receipt drops out of Issues.",
    keywords: "flagged orange red highlight warning pill",
  },
  {
    q: "What is a possible duplicate and how do I clear it?",
    a: "Two receipts with the same vendor, amount and date get flagged as possible duplicates. Open the receipt and check the matching ones linked in the banner. If it really is the same expense twice, delete one. If they're genuinely separate (two identical coffees, say), press Acknowledge — this records that you're intentionally claiming both, and the flag clears.",
    keywords: "duplicate same twice acknowledge",
  },
  {
    q: "Why does it say my edited values differ from OCR?",
    a: "If you change the amount, currency or date away from what was read off the receipt image, the app asks you to acknowledge the difference. This is an audit trail: it records that the change was deliberate. Press Acknowledge in the banner if your edit is correct.",
    keywords: "mismatch override changed edited banner",
  },
  {
    q: "What is a spending limit and why is my receipt over it?",
    a: "The admin can set a per-receipt limit on any category (for example 80 for Meals). A receipt over its category's limit is flagged in Issues and shows an orange banner. You can still claim it — press Acknowledge to record that you know it's over the limit. The acknowledgement stays on the receipt's record.",
    keywords: "policy limit cap over budget category",
  },
  {
    q: "How do I delete a receipt, and what is Trash?",
    a: "Open the receipt and press Delete. It moves to Trash (Settings → Trash) where it stays for 30 days — press Restore there if you change your mind. After 30 days it's permanently gone, including the stored image.",
    keywords: "remove undo restore recover bin",
  },
  {
    q: "How do tips work on meals and taxis?",
    a: "For meal and taxi categories a Tip selector appears. Enter the bill exactly as printed on the receipt, then pick a percentage (5–20%) or enter a custom tip amount. The report shows the total (bill + tip); the receipt image still matches the bill, which is what the OCR checks against.",
    keywords: "gratuity service percentage restaurant",
  },
  {
    q: "How do I generate a monthly report?",
    a: "Go to Reports from the home screen. Pick the month (defaults to last month), optionally one company (otherwise a combined report), and optionally a target currency. Press Generate, then use the buttons: Open PDF to view, Download PDF to save it, Email PDF to send it to yourself, and Download originals for a ZIP of the receipt files. Nothing is emailed unless you press the email button.",
    keywords: "invoice month pdf zip send export",
  },
  {
    q: "Do attendees show up in reports?",
    a: "Yes. Tag people on a receipt (the People field) and the monthly report's category-breakdown page shows a small \"with …\" line under that receipt, so meal and hotel claims carry their context. Your people list is private to you.",
    keywords: "people guests who was present breakdown",
  },
  {
    q: "How does currency conversion in reports work?",
    a: "If you pick a target currency, every receipt is converted using the exchange rate from the day the receipt was captured — not today's rate — so regenerating an old report gives the same numbers. Receipts from before this feature use current rates. The rate source and dates are printed at the bottom of the report.",
    keywords: "fx exchange rate convert eur usd gbp",
  },
  {
    q: "What's private to me and what's shared?",
    a: "Private to you: your receipts, your reports, your people/attendees list, and your profile (name, address, bank details). Shared team-wide and curated by the admin: the companies list, the categories list (and their spending limits), and supported currencies. Need a new company or alias? Ask the admin at cesprey@gmail.com.",
    keywords: "privacy who can see admin visibility",
  },
  {
    q: "What should I set up first?",
    a: "Go to Settings → My Profile and fill in your name, address, VAT number if you have one, and bank details (free text — IBAN, sort code, whatever the payer needs). These appear at the top of every invoice you generate, so do it once before your first report.",
    keywords: "profile bank details onboarding first time setup",
  },
  {
    q: "How do I install the app on my phone?",
    a: "iPhone: open expenses.esprey.net in Safari, tap Share, then \"Add to Home Screen\". Android: open it in Chrome and choose \"Install app\". The icon then opens the app full-screen like a native app.",
    keywords: "pwa home screen icon ios android install",
  },
  {
    q: "What if I have no signal when I get a receipt?",
    a: "Take the photo with your phone's normal Camera app, then email it to receipts@esprey.net. Your mail app queues the send and delivers it when you're back online — no expense lost.",
    keywords: "offline no internet airplane remote field",
  },
  {
    q: "Who do I contact for help?",
    a: "Email Carl Esprey at cesprey@gmail.com — for anything the app can't answer: adding a company, registering an email alias, changing spending limits, or fixing your account.",
    keywords: "support contact admin problem stuck",
  },
];

/** The FAQ as one plain-text block — used as the AI help widget's grounding. */
export function faqAsText(): string {
  return FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}
