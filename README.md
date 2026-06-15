# Esprey Expenses

A personal expense-tracking PWA. Phone-camera or email-forwarded receipts get OCR'd by Claude, stored, and bundled into a monthly PDF report.

## Stack

- **Frontend**: React + Vite, deployed to Cloudflare Pages
- **Backend**: Cloudflare Pages Functions (Workers runtime), in `functions/`
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (original receipt images)
- **Vision OCR**: Anthropic Claude API
- **Email ingest**: Cloudflare Email Routing → Email Worker (Stage 3)

## Status 

v0.1 — scaffold only. Deploys a "hello world" page that pings the backend health endpoint. Used to verify the deploy pipeline works before adding features.

## Deploy pipeline overview (one-time setup)

These steps are done once by you (Carl). After this, every code change auto-deploys when you push.

### 1. Push this folder to GitHub

- Open **GitHub Desktop**.
- *File → Add Local Repository* → pick this folder (`esprey-expenses/`).
- It'll say "this isn't a git repo yet — Create a repository?". Click that.
- Name: `esprey-expenses`. Local path: keep as-is. Click *Create Repository*.
- In the top bar, click **Publish repository**. Uncheck "Keep this code private" only if you're sure; otherwise leave it private (recommended).
- After publish, the repo lives at `github.com/<your-username>/esprey-expenses`.

### 2. Connect Cloudflare Pages to the repo

- Go to https://dash.cloudflare.com → *Workers & Pages* → *Create application* → *Pages* → *Connect to Git*.
- Authorize Cloudflare to access your GitHub. Pick the `esprey-expenses` repo.
- Build settings:
  - **Framework preset**: Vite
  - **Build command**: `npm run build`
  - **Build output directory**: `dist`
  - **Root directory**: leave blank
- Click *Save and Deploy*. First build takes 1–2 minutes.
- Once deployed, you'll see a URL like `esprey-expenses.pages.dev`. Open it on your phone — you should see "If you can read this, the frontend deployed." and a `Backend health: {…}` line.

### 3. Add a D1 database

- *Workers & Pages* → *D1* → *Create database* → name `esprey-expenses`. Click *Create*.
- Cloudflare shows the database ID; copy it.
- *Workers & Pages* → your Pages project → *Settings* → *Functions* → *D1 database bindings*.
- Add binding: *Variable name* `DB`, *Database* `esprey-expenses`. Save.

### 4. Add an R2 bucket

- *Workers & Pages* → *R2* → *Create bucket* → name `esprey-expenses-receipts`. Click *Create*.
- Back in your Pages project → *Settings* → *Functions* → *R2 bucket bindings*.
- Add binding: *Variable name* `RECEIPTS`, *Bucket* `esprey-expenses-receipts`. Save.

### 5. Add environment variables / secrets

In *Settings* → *Environment variables*, add (for both *Production* and *Preview*):

| Name | Value | Type |
|------|-------|------|
| `CARL_EMAIL` | `cesprey@gmail.com` | Plain text |
| `ANTHROPIC_API_KEY` | (your key from console.anthropic.com) | **Encrypted** |
| `RESEND_API_KEY` | (added in Stage 2b) | Encrypted |
| `SESSION_SECRET` | (any random 32+ character string) | Encrypted |

### 6. Connect the custom domain

- *Workers & Pages* → your Pages project → *Custom domains* → *Set up a custom domain*.
- Enter `expenses.esprey.net`. Cloudflare detects the domain is on its DNS and adds the CNAME automatically.
- Wait ~1 minute. Visit https://expenses.esprey.net — should show the same scaffold page.

## After Stage 2 scaffold deploys successfully

Tell Claude in chat: "scaffold deployed, URL is X". Claude will then layer in the actual features (camera capture, OCR, dashboard, auth) by editing files in this same repo. Each change you pull in GitHub Desktop and push will auto-deploy via Cloudflare Pages.
