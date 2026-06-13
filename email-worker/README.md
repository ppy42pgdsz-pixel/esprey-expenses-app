# Esprey Expenses — Email Worker

This is the separate Cloudflare Worker that handles incoming email at `receipts@esprey.net`. It runs alongside the Pages app (which lives at `esprey-expenses-app/`) and writes to the same D1 database and R2 bucket.

## What it does

1. Email arrives at `receipts@esprey.net` (or whatever address you bind in Email Routing).
2. Cloudflare's Email Routing hands the raw message to this Worker.
3. The Worker parses the MIME, finds any image/PDF attachments, and saves each to R2.
4. For each attachment, it calls Claude vision to extract vendor / amount / currency / date.
5. Writes a row to the `receipts` table — same shape as camera uploads, with `source='email'`.
6. If there are no attachments, it OCRs the email body text instead.
7. All receipts show up in the same dashboard at `esprey-expenses-app.pages.dev`.

## Deploy (one-time, ~5 minutes)

### 1. Push the code

Open GitHub Desktop. You should see ~10 new files under `email-worker/`. Commit message: `Add email worker for receipt ingestion`. Commit → Push.

### 2. Create a Worker in Cloudflare

- Cloudflare → *Workers & Pages* → *Create* → *Workers* → *Connect to Git*.
- Pick the `esprey-expenses-app` repo (the same one).
- Project name: `esprey-expenses-email`.
- Build & deploy settings:
  - **Root directory**: `email-worker`
  - **Build command**: `npm install`
  - **Deploy command**: `npx wrangler deploy`
- *Save and Deploy*. First build takes 1–2 minutes.

The Worker URL doesn't matter — nothing accesses it via HTTP; Cloudflare invokes it on incoming email.

### 3. Add the Anthropic API key as a secret

- Cloudflare → *Workers & Pages* → `esprey-expenses-email` → *Settings* → *Variables and Secrets*.
- Add: `ANTHROPIC_API_KEY` = (paste your key from console.anthropic.com), Type: **Secret**.
- After saving, click the latest deployment's three-dot menu → *Retry deployment* so the secret is picked up.

### 4. Route receipts@esprey.net to the Worker

- Cloudflare → *Email* → *Email Routing* → *Routes* tab.
- *Custom addresses* → *Create address*.
- Address: `receipts@esprey.net`.
- Action: *Send to a Worker*.
- Worker: `esprey-expenses-email`.
- Save.

### 5. Test it

Send an email to `receipts@esprey.net`:

- **From your Mac**: forward a recent receipt email to it.
- **From your phone**: take a photo of a receipt in Photos → Share → Mail → To: `receipts@esprey.net` → Send. The Mail app's outbox will buffer it if you're offline; it sends when you get connectivity back. This is the "I'm at a restaurant with no wifi" workaround.

Within ~10 seconds, a new row should appear in the dashboard at `esprey-expenses-app.pages.dev` with `source: email` and the extracted fields pre-filled.

## Future cleanups

- Refactor the `anthropic.ts` and `util.ts` files so they're shared with the Pages project instead of duplicated.
- Add allowlist on `from:` addresses (so random spam to `receipts@esprey.net` doesn't create receipt rows).
