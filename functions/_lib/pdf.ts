// Monthly expense report PDF builder.
// Grouping: by company, then by category. Appendix: every receipt's original
// (multi-page PDFs preserved, images embedded full-page).

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
  monthLabel: string;   // e.g. "June 2026"
  receipts: ReceiptRow[];
  fetchOriginal: OriginalLoader;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Expense Report — ${opts.monthLabel}`);
  pdf.setCreator("Esprey Expenses");
  pdf.setProducer("Esprey Expenses");
  const fonts: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  // --- COVER PAGE ---
  drawCoverPage(pdf, fonts, opts.monthLabel, opts.receipts, opts.generatedAt);

  // --- SUMMARY ---
  drawSummary(pdf, fonts, opts.receipts);

  // --- APPENDIX ---
  await drawAppendix(pdf, fonts, opts.receipts, opts.fetchOriginal);

  return pdf.save();
}

/* ----------------- Cover ----------------- */
function drawCoverPage(
  pdf: PDFDocument,
  fonts: Fonts,
  monthLabel: string,
  receipts: ReceiptRow[],
  generatedAt: Date
) {
  const page = pdf.addPage(PageSizes.A4);
  let y = PAGE_H - MARGIN - 40;

  page.drawText("Expense Report", { x: MARGIN, y, size: 24, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 30;
  page.drawText(monthLabel, { x: MARGIN, y, size: 18, font: fonts.reg, color: rgb(0.3, 0.3, 0.3) });
  y -= 40;

  const totals = sumByCurrency(receipts);
  page.drawText("Totals", { x: MARGIN, y, size: 12, font: fonts.bold });
  y -= LINE;
  if (totals.size === 0) {
    page.drawText("(no receipts)", { x: MARGIN, y, size: 11, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
    y -= LINE;
  } else {
    for (const [cur, amt] of totals) {
      page.drawText(`${cur || "(unknown)"}  ${fmtMoney(amt)}`, {
        x: MARGIN, y, size: 12, font: fonts.reg,
      });
      y -= LINE;
    }
  }
  y -= 20;

  const meta = [
    `Receipts: ${receipts.length}`,
    `Companies: ${unique(receipts.map(r => r.company || "(uncategorized)")).length}`,
    `Generated: ${generatedAt.toISOString().slice(0, 19).replace("T", " ")} UTC`,
  ];
  for (const line of meta) {
    page.drawText(line, { x: MARGIN, y, size: 10, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
    y -= LINE;
  }
}

/* ----------------- Summary tables ----------------- */
function drawSummary(pdf: PDFDocument, fonts: Fonts, receipts: ReceiptRow[]) {
  let page = pdf.addPage(PageSizes.A4);
  let y = PAGE_H - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdf.addPage(PageSizes.A4);
      y = PAGE_H - MARGIN;
    }
  }

  page.drawText("Summary by company", { x: MARGIN, y, size: 16, font: fonts.bold });
  y -= 22;

  // Group: company -> category -> receipts
  const byCompany = groupBy(receipts, r => r.company || "Uncategorized");
  const companyNames = Array.from(byCompany.keys()).sort((a, b) => a.localeCompare(b));

  for (const company of companyNames) {
    const cReceipts = byCompany.get(company)!;
    ensureSpace(40);
    page.drawText(company, { x: MARGIN, y, size: 14, font: fonts.bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 4;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 14;

    const byCat = groupBy(cReceipts, r => r.category || "Uncategorized");
    const catNames = Array.from(byCat.keys()).sort();

    for (const cat of catNames) {
      const items = byCat.get(cat)!;
      ensureSpace(30 + (items.length + 2) * LINE);
      page.drawText(cat, { x: MARGIN, y, size: 11, font: fonts.bold });
      y -= LINE;

      // Column headers
      const cols = { date: MARGIN, vendor: MARGIN + 70, desc: MARGIN + 200, amt: PAGE_W - MARGIN };
      page.drawText("Date", { x: cols.date, y, size: 9, font: fonts.bold, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("Vendor", { x: cols.vendor, y, size: 9, font: fonts.bold, color: rgb(0.4, 0.4, 0.4) });
      page.drawText("Description", { x: cols.desc, y, size: 9, font: fonts.bold, color: rgb(0.4, 0.4, 0.4) });
      drawRightText(page, "Amount", cols.amt, y, 9, fonts.bold, rgb(0.4, 0.4, 0.4));
      y -= LINE - 2;

      // Rows
      for (const r of items) {
        ensureSpace(LINE);
        page.drawText(truncate(r.receipt_date ?? "", 10), { x: cols.date, y, size: 10, font: fonts.reg });
        page.drawText(truncate(r.vendor ?? "—", 22), { x: cols.vendor, y, size: 10, font: fonts.reg });
        page.drawText(truncate(r.notes ?? "", 32), { x: cols.desc, y, size: 10, font: fonts.reg, color: rgb(0.3, 0.3, 0.3) });
        const amtStr = `${r.currency ?? ""} ${r.amount ?? "—"}`.trim();
        drawRightText(page, amtStr, cols.amt, y, 10, fonts.reg);
        y -= LINE;
      }

      // Subtotal per currency for this category
      const subs = sumByCurrency(items);
      const subStr = subs.size === 0 ? "—" : Array.from(subs).map(([c, a]) => `${c || "?"} ${fmtMoney(a)}`).join("   ");
      ensureSpace(LINE);
      drawRightText(page, `Subtotal: ${subStr}`, PAGE_W - MARGIN, y, 9, fonts.bold, rgb(0.2, 0.2, 0.2));
      y -= LINE + 6;
    }

    // Company total
    const cTotals = sumByCurrency(cReceipts);
    const cStr = cTotals.size === 0 ? "—" : Array.from(cTotals).map(([c, a]) => `${c || "?"} ${fmtMoney(a)}`).join("   ");
    ensureSpace(LINE);
    drawRightText(page, `Company total: ${cStr}`, PAGE_W - MARGIN, y, 10, fonts.bold);
    y -= LINE + 16;
  }
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

  // Sort by company → category → date for a sensible flow that matches the summary
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
    const header = `${index}.  ${r.company ?? "Uncategorized"} · ${r.category ?? "—"} · ${r.vendor ?? "—"} · ${r.receipt_date ?? ""}  ${r.currency ?? ""} ${r.amount ?? ""}`.trim();

    if (r.source === "manual" || (r.r2_key && r.r2_key.startsWith("manual:"))) {
      // No image — single text page noting it was manual.
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
        // Merge all pages of the original PDF, captioning the first.
        const src = await PDFDocument.load(obj.bytes);
        const copied = await pdf.copyPages(src, src.getPageIndices());
        let first = true;
        for (const p of copied) {
          pdf.addPage(p);
          if (first) {
            drawHeader(p, fonts, header);
            first = false;
          }
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
    width: w,
    height: h,
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
    x: MARGIN,
    y: PAGE_H - MARGIN + 6,
    size: 9,
    font: fonts.bold,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });
}

/* ----------------- Helpers ----------------- */
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
    v.push(t);
    m.set(k, v);
  }
  return m;
}

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function drawRightText(page: PDFPage, text: string, xRight: number, y: number, size: number, font: PDFFont, color = rgb(0, 0, 0)) {
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
      } else {
        line = tentative;
      }
    }
    if (line) out.push(line);
    out.push("");
  }
  return out;
}
