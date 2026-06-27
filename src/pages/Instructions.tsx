import { Link } from "react-router-dom";

export default function Instructions() {
  return (
    <div className="page instructions">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>How this works</h1>
        <span />
      </header>

      <div className="instructions-body">

        <section>
          <h2>What this is</h2>
          <p>
            Esprey Expenses is a simple app for tracking your business expenses and generating
            monthly invoices billed to client companies. Everything you submit runs through OCR
            automatically — you don't have to type out receipt details yourself.
          </p>
        </section>

        <section>
          <h2>What's private to you, what's shared</h2>
          <p><strong>Private to you (the admin cannot see these):</strong></p>
          <ul>
            <li>Your receipts and the reports you generate from them</li>
            <li>The list of "people" you tag as attendees on expenses (and your favourites)</li>
            <li>Your profile details — name, business name, address, VAT number, bank details</li>
          </ul>
          <p><strong>Shared across the whole team (admins curate):</strong></p>
          <ul>
            <li>The list of <em>companies</em> you can bill expenses to</li>
            <li>The list of <em>categories</em> (Meals, Travel, etc.)</li>
            <li>The list of supported <em>currencies</em></li>
          </ul>
          <p>
            If you need a new company or category that isn't in the dropdown, ask the admin (
            <a href="mailto:cesprey@gmail.com">Carl Esprey</a>) to add it. Categories are open for
            anyone to add directly via Settings → Categories if you need to.
          </p>
        </section>

        <section>
          <h2>First-time setup: your profile</h2>
          <p>
            Before generating any reports, go to <Link to="/settings/user"><strong>Settings → My
            Profile</strong></Link> and fill in:
          </p>
          <ul>
            <li>Your name (and business name, if you invoice through a company)</li>
            <li>Address, VAT number, phone, contact email</li>
            <li>
              <strong>Bank details</strong> — a free-form text block. Paste your IBAN, SWIFT, account
              name, sort code, or anything else the paying company needs to wire you money. Multiple
              lines OK.
            </li>
          </ul>
          <p>
            This information appears at the top of every monthly invoice you generate, so the
            recipient knows who to pay and how. Get it right once and you're done.
          </p>
        </section>

        <section>
          <h2>Three ways to add an expense</h2>

          <h3>1. Take a photo (camera)</h3>
          <p>
            Tap the <strong>camera button</strong> on the home screen. Snap the receipt. The app
            reads vendor, amount, date and currency automatically — you just confirm, tag it with a
            company/category/attendees, and save.
          </p>
          <p>
            <strong>Multi-page invoice?</strong> After the first photo, the preview screen shows a{" "}
            <em>"+ Add another page"</em> button. Tap it to keep snapping. All pages get combined
            into a single PDF receipt — OCR reads across all of them and finds the total wherever
            it appears.
          </p>

          <h3>2. Forward an email</h3>
          <p>
            Forward any receipt to <code>receipts@esprey.net</code> from one of your <strong>registered
            email addresses</strong>. Works with PDFs, images, and even text-only confirmations from
            services like Uber, Airbnb, restaurant bookings, airline tickets. The receipt appears in
            your dashboard within a minute, fully OCR'd.
          </p>
          <p>
            If you have more than one email address you might forward from (work, personal,
            another business), ask the admin to add them as <strong>aliases</strong> on your
            account so any of them work.
          </p>
          <p>
            <em>If you forward from an unregistered address, you'll get a bounce-back email asking
            you to contact the admin.</em>
          </p>

          <h3>3. Manual entry (no receipt)</h3>
          <p>
            For cash spent where you didn't get a receipt. Tap <strong>"Manual entry"</strong> on the
            home screen, fill in vendor, amount, date — at minimum amount is required.
          </p>
        </section>

        <section>
          <h2>Tagging your expenses</h2>
          <p>Every receipt has these fields you can edit:</p>
          <ul>
            <li>
              <strong>Company</strong> — which client this expense is billable to. Shared
              dropdown; only admins add new entries.
            </li>
            <li>
              <strong>Category</strong> — e.g. Meals, Travel, Hotels. Shared dropdown; anyone can
              add via Settings → Categories.
            </li>
            <li>
              <strong>People</strong> — who you were with. <em>Your own private list</em>. Tap the
              star to favourite someone so they appear at the top of the dropdown.
            </li>
            <li><strong>Notes</strong> — free text for anything else.</li>
          </ul>
        </section>

        <section>
          <h2>Generating a monthly report</h2>
          <p>
            Go to <Link to="/reports"><strong>Reports</strong></Link> from the home screen. Pick:
          </p>
          <ul>
            <li>The <strong>month</strong> you want to invoice for</li>
            <li>Optionally a specific <strong>company</strong> (otherwise one combined report)</li>
            <li>
              Optionally a <strong>target currency</strong> — every receipt's amount gets converted
              to that currency using the live FX rate that day, alongside the original figure
            </li>
          </ul>
          <p>Hit Generate. You get:</p>
          <ul>
            <li>A polished <strong>PDF invoice</strong> with your profile + bank details at the top, every receipt itemised, plus full-resolution copies of every original receipt in an appendix</li>
            <li>A <strong>ZIP file</strong> with all the original receipt images/PDFs (for the recipient's records)</li>
            <li>Both are emailed to you automatically; you can also re-download anytime from the Reports page</li>
          </ul>
        </section>

        <section>
          <h2>Add to home screen (iPhone)</h2>
          <p>
            Open <code>expenses.esprey.net</code> in Safari → tap the <strong>Share</strong> button
            (square with arrow up) → <strong>"Add to Home Screen"</strong>. The app icon appears
            with the others; tapping it opens the app full-screen, no browser chrome. Same flow on
            Android via Chrome's "Install app" option.
          </p>
        </section>

        <section>
          <h2>If you're offline</h2>
          <p>
            No signal at a restaurant or in the field? Take the photo with your phone's regular
            Camera app, then email it to <code>receipts@esprey.net</code> from one of your
            registered addresses. Your mail app will queue the send and deliver it when you're
            back online — no expense lost.
          </p>
        </section>

        <section>
          <h2>Need help?</h2>
          <p>
            Email <a href="mailto:cesprey@gmail.com">Carl Esprey</a>. He'll fix it, add a missing
            company, register a new alias for you, or change your role.
          </p>
        </section>

      </div>
    </div>
  );
}
