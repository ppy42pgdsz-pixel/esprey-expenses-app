// Monthly expense report PDF — invoice-style layout.
// Page 1: invoice header (company name top-left, "INVOICE" + period top-right,
//   bank-details placeholder on the left), then expense line items flowing down.
// Subsequent pages: continued line items.
// Final summary: totals on the last summary page.
// Appendix: every original receipt (multi-page PDFs preserved, images full-page).

import {
  PDFDocument,
  StandardFonts,
  rgb,
  PageSizes,
  PDFFont,
  PDFImage,
  PDFPage,
} from "pdf-lib";
import type { ReceiptRow } from "./types";

const PAGE_W = PageSizes.A4[0]; // 595
const PAGE_H = PageSizes.A4[1]; // 842
const MARGIN = 40;
const LINE = 14;

interface Fonts {
  reg: PDFFont;
  bold: PDFFont;
}

interface OriginalLoader {
  (r2_key: string): Promise<{ mime: string; bytes: Uint8Array } | null>;
}

export async function buildMonthlyReport(opts: {
  monthLabel: string;          // e.g. "June 2026"
  reportLabel: string;         // e.g. "June 2026 — Waraba Gold — EUR"
  companyName: string | null;  // null = "All companies"
  currencyFilter: string | null;
  receipts: ReceiptRow[];
  fetchOriginal: OriginalLoader;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Expense Report — ${opts.reportLabel}`);
  pdf.setCreator("Esprey Expenses");
  pdf.setProducer("Esprey Expenses");
  const fonts: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  // Invoice + line items (may span multiple pages).
  drawInvoice(pdf, fonts, opts);

  // Appendix.
  await drawAppendix(pdf, fonts, opts.receipts, opts.fetchOriginal);

  return pdf.save();
}

/* ---------------- Invoice page(s) ---------------- */
function drawInvoice(
  pdf: PDFDocument,
  fonts: Fonts,
  opts: {
    monthLabel: string;
    companyName: string | null;
    currencyFilter: string | null;
    receipts: ReceiptRow[];
    generatedAt: Date;
  }
) {
  let page = pdf.addPage(PageSizes.A4);
  let y = PAGE_H - MARGIN;

  // ----- Header band -----
  // Top-left: bank-details placeholder block (visually muted).
  const placeholderH = 86;
  page.drawRectangle({
    x: MARGIN, y: y - placeholderH,
    width: 230, height: placeholderH,
    borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5,
    color: rgb(0.98, 0.98, 0.97),
  });
  page.drawText("[ Your business details + bank info ]", {
    x: MARGIN + 8, y: y - 20, size: 9, font: fonts.reg, color: rgb(0.55, 0.55, 0.55),
  });
  page.drawText("(add via Settings later)", {
    x: MARGIN + 8, y: y - 34, size: 8, font: fonts.reg, color: rgb(0.65, 0.65, 0.65),
  });

  // Top-right: "INVOICE" title + period + generated date + invoice number.
  const rightX = PAGE_W - MARGIN;
  page.drawText("INVOICE", {
    x: rightX - fonts.bold.widthOfTextAtSize("INVOICE", 22),
    y: y - 18, size: 22, font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
  });
  const invoiceNo = buildInvoiceNumber(opts.companyName, opts.monthLabel, opts.generatedAt);
  drawRight(page, `No. ${invoiceNo}`, rightX, y - 36, 10, fonts.reg, rgb(0.4, 0.4, 0.4));
  drawRight(page, `Period: ${opts.monthLabel}`, rightX, y - 52, 10, fonts.reg);
  drawRight(page, `Issued: ${opts.generatedAt.toISOString().slice(0, 10)}`, rightX, y - 66, 10, fonts.reg);
  if (opts.currencyFilter) {
    drawRight(page, `Currency: ${opts.currencyFilter}`, rightX, y - 80, 10, fonts.bold);
  }

  y -= placeholderH + 24;

  // ----- Bill To -----
  page.drawText("BILL TO", { x: MARGIN, y, size: 9, font: fonts.bold, color: rgb(0.45, 0.45, 0.45) });
  y -= 16;
  const billTo = opts.companyName ?? "Multiple companies";
  page.drawText(billTo, { x: MARGIN, y, size: 14, font: fonts.bold });
  y -= 22;

  // ----- Line items table -----
  // Column layout
  const cols = {
    date: MARGIN,
    vendor: MARGIN + 70,
    cat: MARGIN + 200,
    desc: MARGIN + 290,
    amt: PAGE_W - MARGIN,
  };

  function drawTableHeader(p: PDFPage, yy: number) {
    p.drawLine({
      start: { x: MARGIN, y: yy + 12 }, end: { x: PAGE_W - MARGIN, y: yy + 12 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
    p.drawText("Date",     { x: cols.date,   y: yy, size: 9, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
    p.drawText("Vendor",   { x: cols.vendor, y: yy, size: 9, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
    p.drawText("Category", { x: cols.cat,    y: yy, size: 9, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
    p.drawText("Description", { x: cols.desc, y: yy, size: 9, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
    drawRight(p, "Amount", cols.amt, yy, 9, fonts.bold, rgb(0.3, 0.3, 0.3));
    p.drawLine({
      start: { x: MARGIN, y: yy - 4 }, end: { x: PAGE_W - MARGIN, y: yy - 4 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 60) { // leave space for totals/footer
      page = pdf.addPage(PageSizes.A4);
      y = PAGE_H - MARGIN;
      // Continuation header
      page.drawText(billTo, { x: MARGIN, y, size: 12, font: fonts.bold, color: rgb(0.3, 0.3, 0.3) });
      drawRight(page, `Period: ${opts.monthLabel}  (continued)`, PAGE_W - MARGIN, y, 9, fonts.reg, rgb(0.4, 0.4, 0.4));
      y -= 24;
      drawTableHeader(page, y);
      y -= 14;
    }
  }

  drawTableHeader(page, y);
  y -= 14;

  // If filtering to a single company, no need to sub-group.
  // If "All companies", group by company → category.
  const showCompanyGroups = !opts.companyName;
  const groups = showCompanyGroups
    ? groupBy(opts.receipts, r => r.company || "Uncategorized")
    : new Map([[opts.companyName ?? "Receipts", opts.receipts]]);
  const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  for (const gName of groupNames) {
    const gReceipts = groups.get(gName)!;
    if (showCompanyGroups) {
      ensureSpace(20);
      page.drawText(gName, { x: MARGIN, y, size: 11, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE;
    }

    // Sort by date inside the group.
    const sorted = [...gReceipts].sort((a, b) =>
      (a.receipt_date ?? "").localeCompare(b.receipt_date ?? "")
    );
    for (const r of sorted) {
      ensureSpace(LINE);
      const amtStr = formatAmount(r);
      page.drawText(truncate(r.receipt_date ?? "—", 10), { x: cols.date,   y, size: 10, font: fonts.reg });
      page.drawText(truncate(r.vendor ?? "—",        18), { x: cols.vendor, y, size: 10, font: fonts.reg });
      page.drawText(truncate(r.category ?? "—",      13), { x: cols.cat,    y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
      page.drawText(truncate(r.notes ?? "",          28), { x: cols.desc,   y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
      drawRight(page, amtStr, cols.amt, y, 10, fonts.reg);
      y -= LINE;
    }

    if (showCompanyGroups) {
      // small breathing room between companies
      y -= 4;
    }
  }

  // ----- Totals -----
  ensureSpace(60);
  y -= 6;
  page.drawLine({
    start: { x: PAGE_W - MARGIN - 240, y: y + 6 },
    end:   { x: PAGE_W - MARGIN,       y: y + 6 },
    thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
  });

  const totals = sumByCurrency(opts.receipts);
  if (totals.size === 0) {
    drawRight(page, "TOTAL: —", PAGE_W - MARGIN, y, 12, fonts.bold);
    y -= LINE;
  } else if (opts.currencyFilter || totals.size === 1) {
    // Single currency — invoice-style total
    const [cur, amt] = Array.from(totals)[0];
    drawRight(page, `TOTAL  ${cur || ""} ${fmtMoney(amt)}`, PAGE_W - MARGIN, y, 14, fonts.bold);
    y -= LINE + 4;
  } else {
    // Mixed currencies — list each, last line is "TOTAL (mixed)"
    drawRight(page, "Subtotals by currency", PAGE_W - MARGIN, y, 10, fonts.bold, rgb(0.35, 0.35, 0.35));
    y -= LINE;
    for (const [cur, amt] of totals) {
      drawRight(page, `${cur || "(unknown)"}  ${fmtMoney(amt)}`, PAGE_W - MARGIN, y, 11, fonts.reg);
      y -= LINE;
    }
  }

  // Footer note
  ensureSpace(20);
  page.drawText(
    `${opts.receipts.length} line item${opts.receipts.length === 1 ? "" : "s"} · Generated ${opts.generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC · Originals attached in appendix`,
    { x: MARGIN, y: MARGIN, size: 8, font: fonts.reg, color: rgb(0.55, 0.55, 0.55) }
  );
}

function buildInvoiceNumber(company: string | null, monthLabel: string, when: Date): string {
  // EX-YYYYMM-COMPANY  (short, deterministic-ish for one company per month)
  const ym = `${when.getUTCFullYear()}${String(when.getUTCMonth() + 1).padStart(2, "0")}`;
  const co = company
    ? slugifyShort(company).toUpperCase()
    : "ALL";
  return `EX-${ym}-${co}`;
}

function slugifyShort(s: string): string {
  return s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 10);
}

/* ----------------- Appendix ----------------- */
async function drawAppendix(
  pdf: PDFDocument,
  fonts: Fonts,
  receipts: ReceiptRow[],
  fetchOriginal: OriginalLoader
) {
  if (receipts.length === 0) return;
  const sep = pdf.addPage(PageSizes.A4);
  sep.drawText("Appendix — original receipts", {
    x: MARGIN, y: PAGE_H / 2, size: 18, font: fonts.bold, color: rgb(0.2, 0.2, 0.2),
  });

  const sorted = [...receipts].sort((a, b) => {
    const c = (a.company ?? "").localeCompare(b.company ?? "");
    if (c) return c;
    const k = (a.category ?? "").localeCompare(b.category ?? "");
    if (k) return k;
    return (a.receipt_date ?? "").localeCompare(b.receipt_date ?? "");
  });

  let index = 0;
  for (const r of sorted) {
    index++;
    const header = `${index}.  ${r.company ?? "Uncategorized"} · ${r.category ?? "—"} · ${r.vendor ?? "—"} · ${r.receipt_date ?? ""}  ${formatAmount(r)}`.trim();

    if (r.source === "manual" || (r.r2_key && r.r2_key.startsWith("manual:"))) {
      const p = pdf.addPage(PageSizes.A4);
      drawHeader(p, fonts, header);
      p.drawText("(Manually entered — no original receipt)", {
        x: MARGIN, y: PAGE_H / 2, size: 12, font: fonts.reg, color: rgb(0.4, 0.4, 0.4),
      });
      continue;
    }

    let obj;
    try { obj = await fetchOriginal(r.r2_key); } catch { obj = null; }
    if (!obj) {
      const p = pdf.addPage(PageSizes.A4);
      drawHeader(p, fonts, header);
      p.drawText("(Original could not be loaded from storage)", {
        x: MARGIN, y: PAGE_H / 2, size: 12, font: fonts.reg, color: rgb(0.6, 0.2, 0.2),
      });
      continue;
    }

    const mime = obj.mime.toLowerCase();
    try {
      if (mime === "application/pdf") {
        const src = await PDFDocument.load(obj.bytes);
        const copied = await pdf.copyPages(src, src.getPageIndices());
        let first = true;
        for (const p of copied) {
          pdf.addPage(p);
          if (first) { drawHeader(p, fonts, header); first = false; }
        }
      } else if (mime === "image/jpeg" || mime === "image/jpg") {
        const img = await pdf.embedJpg(obj.bytes);
        addImagePage(pdf, fonts, header, img);
      } else if (mime === "image/png") {
        const img = await pdf.embedPng(obj.bytes);
        addImagePage(pdf, fonts, header, img);
      } else if (mime === "text/plain") {
        const text = new TextDecoder().decode(obj.bytes);
        addTextPage(pdf, fonts, header, text);
      } else {
        const p = pdf.addPage(PageSizes.A4);
        drawHeader(p, fonts, header);
        p.drawText(`(Unsupported format: ${mime})`, {
          x: MARGIN, y: PAGE_H / 2, size: 12, font: fonts.reg, color: rgb(0.6, 0.2, 0.2),
        });
      }
    } catch (e) {
      const p = pdf.addPage(PageSizes.A4);
      drawHeader(p, fonts, header);
      p.drawText(`(Could not render: ${(e as Error).message})`, {
        x: MARGIN, y: PAGE_H / 2, size: 12, font: fonts.reg, color: rgb(0.6, 0.2, 0.2),
      });
    }
  }
}

function addImagePage(pdf: PDFDocument, fonts: Fonts, header: string, img: PDFImage) {
  const page = pdf.addPage(PageSizes.A4);
  drawHeader(page, fonts, header);
  const maxW = PAGE_W - 2 * MARGIN;
  const maxH = PAGE_H - 2 * MARGIN - 24;
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * ratio;
  const h = img.height * ratio;
  page.drawImage(img, {
    x: (PAGE_W - w) / 2,
    y: (PAGE_H - h) / 2 - 10,
    width: w, height: h,
  });
}

function addTextPage(pdf: PDFDocument, fonts: Fonts, header: string, text: string) {
  const page = pdf.addPage(PageSizes.A4);
  drawHeader(page, fonts, header);
  const lines = wrapText(text, fonts.reg, 9, PAGE_W - 2 * MARGIN);
  let y = PAGE_H - MARGIN - 30;
  for (const line of lines) {
    if (y < MARGIN) break;
    page.drawText(line, { x: MARGIN, y, size: 9, font: fonts.reg, color: rgb(0.2, 0.2, 0.2) });
    y -= 12;
  }
}

function drawHeader(page: PDFPage, fonts: Fonts, header: string) {
  page.drawText(header, {
    x: MARGIN, y: PAGE_H - MARGIN + 6,
    size: 9, font: fonts.bold, color: rgb(0.3, 0.3, 0.3),
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN },
    end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
  });
}

/* ----------------- Helpers ----------------- */
function formatAmount(r: ReceiptRow): string {
  const cur = (r.currency ?? "").trim();
  const amt = (r.amount ?? "").trim();
  if (!amt) return "—";
  return cur ? `${cur} ${amt}` : amt;
}

function sumByCurrency(rs: ReceiptRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rs) {
    const cur = (r.currency ?? "").trim();
    const amt = parseFloat((r.amount ?? "").replace(",", "."));
    if (!isFinite(amt)) continue;
    m.set(cur, (m.get(cur) ?? 0) + amt);
  }
  return m;
}

function groupBy<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const t of arr) {
    const k = key(t);
    const v = m.get(k) ?? [];
    v.push(t); m.set(k, v);
  }
  return m;
}

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function drawRight(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = rgb(0, 0, 0)) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - w, y, size, font, color });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const tentative = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(tentative, size) > maxWidth) {
        if (line) out.push(line);
        line = word;
      } else { line = tentative; }
    }
    if (line) out.push(line);
    out.push("");
  }
  return out;
}
