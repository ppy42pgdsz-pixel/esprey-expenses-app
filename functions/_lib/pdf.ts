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
import type { BankDetails, BillFrom, ReceiptRow } from "./types";
import { convert, type FxRates } from "./fx";

export interface BilledToCompany {
  name: string;
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_country: string | null;
  vat_number: string | null;
}

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
  billedToCompany?: BilledToCompany | null;
  currencyFilter: string | null;
  fxRates?: FxRates | null;    // set when currencyFilter is non-null
  fxError?: string | null;
  receipts: ReceiptRow[];
  billFrom: BillFrom;
  bank: BankDetails;
  fetchOriginal: OriginalLoader;
  generatedAt: Date;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Expense Report — ${opts.reportLabel}`);
  pdf.setAuthor(opts.billFrom.name || "Esprey Expenses");
  pdf.setCreator("Esprey Expenses");
  pdf.setProducer("Esprey Expenses");
  const fonts: Fonts = {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  // Invoice + line items (may span multiple pages).
  drawInvoice(pdf, fonts, opts);

  // Category breakdown (new page after the invoice, before the appendix).
  drawCategoryBreakdown(pdf, fonts, opts.receipts);

  // Appendix.
  await drawAppendix(pdf, fonts, opts.receipts, opts.fetchOriginal);

  return pdf.save();
}

/* ---------------- Category breakdown ---------------- */
function drawCategoryBreakdown(pdf: PDFDocument, fonts: Fonts, receipts: ReceiptRow[]) {
  if (receipts.length === 0) return;

  let page = pdf.addPage(PageSizes.A4);
  let y = PAGE_H - MARGIN;

  page.drawText("Breakdown by category", {
    x: MARGIN, y, size: 16, font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
  });
  y -= 24;

  // Group by category (Uncategorized at the end, otherwise alphabetical).
  const byCat = groupBy(receipts, (r) => r.category || "Uncategorized");
  const catNames = Array.from(byCat.keys()).sort((a, b) => {
    if (a === "Uncategorized") return 1;
    if (b === "Uncategorized") return -1;
    return a.localeCompare(b);
  });

  // Column layout — give as much space as possible to "Name".
  const cols = {
    date: MARGIN,                                  //   x = 40
    name: MARGIN + 65,                             //   x = 105 → wide
    amt:  PAGE_W - MARGIN - 50,                    //   x = 505 (right-aligned anchor)
    cur:  PAGE_W - MARGIN,                         //   x = 555 (right-aligned anchor)
  };
  const nameMaxWidth = cols.amt - cols.name - 12;  // ~388px of space for the name

  function newPage(continued: boolean) {
    page = pdf.addPage(PageSizes.A4);
    y = PAGE_H - MARGIN;
    if (continued) {
      page.drawText("Breakdown by category (continued)", {
        x: MARGIN, y, size: 11, font: fonts.bold, color: rgb(0.4, 0.4, 0.4),
      });
      y -= 20;
    }
  }
  function ensureSpace(needed: number) {
    if (y - needed < MARGIN + 30) newPage(true);
  }
  function drawTableHeader() {
    page.drawLine({
      start: { x: MARGIN, y: y + 12 }, end: { x: PAGE_W - MARGIN, y: y + 12 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
    const c = rgb(0.3, 0.3, 0.3);
    page.drawText("Date", { x: cols.date, y, size: 9, font: fonts.bold, color: c });
    page.drawText("Name", { x: cols.name, y, size: 9, font: fonts.bold, color: c });
    drawRight(page, "Amount",   cols.amt, y, 9, fonts.bold, c);
    drawRight(page, "Currency", cols.cur, y, 9, fonts.bold, c);
    page.drawLine({
      start: { x: MARGIN, y: y - 4 }, end: { x: PAGE_W - MARGIN, y: y - 4 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
    y -= LINE;
  }

  for (const cat of catNames) {
    const items = (byCat.get(cat) || []).slice().sort(
      (a, b) => (a.receipt_date ?? "").localeCompare(b.receipt_date ?? "")
    );

    ensureSpace(60);
    // Category heading
    page.drawText(cat.toUpperCase(), {
      x: MARGIN, y, size: 14, font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
    });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y }, end: { x: MARGIN + 60, y },
      thickness: 1.5, color: rgb(0.78, 0.55, 0.20),
    });
    y -= 18;

    drawTableHeader();

    for (const r of items) {
      const name = (r.vendor && r.vendor.trim()) || "—";
      const nameLines = wrapText(name, fonts.reg, 10, nameMaxWidth);
      const rowH = LINE * Math.max(1, nameLines.length);
      ensureSpace(rowH);
      // Date and amount/currency align with the FIRST line of the wrapped name.
      page.drawText(r.receipt_date ?? "—", { x: cols.date, y, size: 10, font: fonts.reg });
      const amtNum = parseFloat((r.amount ?? "").replace(",", "."));
      drawRight(page, isFinite(amtNum) ? fmtMoney(amtNum) : "—", cols.amt, y, 10, fonts.reg);
      drawRight(page, (r.currency ?? "").toUpperCase().slice(0, 4) || "—",
        cols.cur, y, 10, fonts.reg, rgb(0.35, 0.35, 0.35));
      for (let i = 0; i < nameLines.length; i++) {
        page.drawText(nameLines[i], { x: cols.name, y, size: 10, font: fonts.reg });
        y -= LINE;
      }
    }

    // Per-currency subtotals for this category.
    const subs = sumByCurrency(items);
    ensureSpace(LINE * (subs.size + 1) + 10);
    y -= 4;
    page.drawLine({
      start: { x: cols.name, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 },
      thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
    });
    if (subs.size === 0) {
      drawRight(page, "Subtotal —", PAGE_W - MARGIN, y, 9, fonts.bold, rgb(0.3, 0.3, 0.3));
      y -= LINE;
    } else {
      for (const [cur, amt] of subs) {
        drawRight(page, `Subtotal  ${fmtMoney(amt)}`, cols.amt, y, 9, fonts.bold, rgb(0.3, 0.3, 0.3));
        drawRight(page, cur || "—", cols.cur, y, 9, fonts.bold, rgb(0.35, 0.35, 0.35));
        y -= LINE;
      }
    }
    y -= 14; // gap before next category
  }
}

/* ---------------- Invoice page(s) ---------------- */
function drawInvoice(
  pdf: PDFDocument,
  fonts: Fonts,
  opts: {
    monthLabel: string;
    companyName: string | null;
    billedToCompany?: BilledToCompany | null;
    currencyFilter: string | null;
    fxRates?: FxRates | null;
    fxError?: string | null;
    receipts: ReceiptRow[];
    billFrom: BillFrom;
    bank: BankDetails;
    generatedAt: Date;
  }
) {
  let page = pdf.addPage(PageSizes.A4);
  let y = PAGE_H - MARGIN;
  const rightX = PAGE_W - MARGIN;

  // ----- TOP BAND: BILL FROM (left) + INVOICE title (right) -----
  // Left: name big, address smaller below.
  page.drawText(opts.billFrom.name || "—", {
    x: MARGIN, y: y - 22, size: 22, font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
  });
  let addrY = y - 42;
  for (const line of [opts.billFrom.line1, opts.billFrom.line2, opts.billFrom.country]) {
    if (line) {
      page.drawText(line, { x: MARGIN, y: addrY, size: 9, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
      addrY -= 12;
    }
  }

  // Right: "INVOICE" label + No. (big) + Issue date.
  page.drawText("I N V O I C E", {
    x: rightX - fonts.reg.widthOfTextAtSize("I N V O I C E", 11),
    y: y - 16, size: 11, font: fonts.reg, color: rgb(0.4, 0.4, 0.4),
  });
  const invoiceNo = buildInvoiceNumber(opts.companyName, opts.monthLabel, opts.generatedAt);
  drawRight(page, `No. ${invoiceNo}`, rightX, y - 38, 18, fonts.bold);
  drawRight(page, "Issue date", rightX, y - 64, 9, fonts.reg, rgb(0.4, 0.4, 0.4));
  drawRight(page, opts.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    rightX, y - 76, 11, fonts.reg);

  // Horizontal accent line.
  y -= 100;
  page.drawLine({
    start: { x: MARGIN, y }, end: { x: MARGIN + 80, y },
    thickness: 1.5, color: rgb(0.78, 0.55, 0.20),
  });
  y -= 22;

  // ----- MID BAND: BILLED TO (left) + FOR (right) -----
  const midTopY = y;
  page.drawText("B I L L E D   T O", {
    x: MARGIN, y: midTopY, size: 9, font: fonts.reg, color: rgb(0.45, 0.45, 0.45),
  });

  // Use the full legal name if we have it, otherwise the short name.
  const co = opts.billedToCompany;
  const billToTitle = (co?.full_name && co.full_name.trim()) || opts.companyName || "Multiple companies";
  page.drawText(billToTitle, {
    x: MARGIN, y: midTopY - 18, size: 12, font: fonts.bold, color: rgb(0.1, 0.1, 0.1),
  });

  // Address lines under the name (if set).
  let billToY = midTopY - 33;
  const addrLines: string[] = [];
  if (co?.address_line1) addrLines.push(co.address_line1);
  if (co?.address_line2) addrLines.push(co.address_line2);
  if (co?.address_country) addrLines.push(co.address_country);
  for (const line of addrLines) {
    page.drawText(line, { x: MARGIN, y: billToY, size: 9, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
    billToY -= 12;
  }
  if (co?.vat_number) {
    page.drawText(`VAT: ${co.vat_number}`, { x: MARGIN, y: billToY, size: 9, font: fonts.reg, color: rgb(0.45, 0.45, 0.45) });
    billToY -= 12;
  }

  // FOR block on the right, vertically aligned to billing block top.
  page.drawText("F O R", {
    x: PAGE_W / 2 + 20, y: midTopY, size: 9, font: fonts.reg, color: rgb(0.45, 0.45, 0.45),
  });
  const forText = `Reimbursable expenses — ${opts.monthLabel}${opts.currencyFilter ? ` (${opts.currencyFilter})` : ""}`;
  page.drawText(forText, {
    x: PAGE_W / 2 + 20, y: midTopY - 18, size: 11, font: fonts.reg, color: rgb(0.2, 0.2, 0.2),
  });

  // Advance y past the taller of the two columns (addresses can push down).
  y = Math.min(midTopY - 60, billToY - 8);

  // ----- Line items table -----
  const useFx = !!(opts.currencyFilter && opts.fxRates);
  const targetCur = (opts.currencyFilter ?? "").toUpperCase();

  // Column layout depends on whether we're converting currencies.
  // Without conversion:  Date | Vendor | Category | Description | Amount
  // With conversion:     Date | Vendor | Description | Original | Code | Converted
  const cols = useFx ? {
    date: MARGIN,
    vendor: MARGIN + 60,
    desc: MARGIN + 160,
    origAmt: MARGIN + 305,
    code: MARGIN + 360,
    conv: PAGE_W - MARGIN,
  } : {
    date: MARGIN,
    vendor: MARGIN + 70,
    cat: MARGIN + 200,
    desc: MARGIN + 290,
    amt: PAGE_W - MARGIN,
  } as any;

  function drawTableHeader(p: PDFPage, yy: number) {
    p.drawLine({
      start: { x: MARGIN, y: yy + 12 }, end: { x: PAGE_W - MARGIN, y: yy + 12 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
    const c = rgb(0.3, 0.3, 0.3);
    p.drawText("Date",     { x: cols.date,   y: yy, size: 9, font: fonts.bold, color: c });
    p.drawText("Vendor",   { x: cols.vendor, y: yy, size: 9, font: fonts.bold, color: c });
    if (useFx) {
      p.drawText("Description", { x: cols.desc, y: yy, size: 9, font: fonts.bold, color: c });
      drawRight(p, "Original", (cols as any).origAmt + 40, yy, 9, fonts.bold, c);
      p.drawText("Cur",     { x: (cols as any).code, y: yy, size: 9, font: fonts.bold, color: c });
      drawRight(p, `${targetCur}`, cols.conv, yy, 9, fonts.bold, c);
    } else {
      p.drawText("Category",    { x: (cols as any).cat,  y: yy, size: 9, font: fonts.bold, color: c });
      p.drawText("Description", { x: cols.desc, y: yy, size: 9, font: fonts.bold, color: c });
      drawRight(p, "Amount", (cols as any).amt, yy, 9, fonts.bold, c);
    }
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
      page.drawText(truncate(r.receipt_date ?? "—", 10), { x: cols.date,   y, size: 10, font: fonts.reg });
      if (useFx) {
        page.drawText(truncate(r.vendor ?? "—",   16), { x: cols.vendor, y, size: 10, font: fonts.reg });
        const descStr = r.notes && r.notes.trim()
          ? truncate(r.notes, 24)
          : truncate(r.category ?? "", 24);
        page.drawText(descStr, { x: cols.desc, y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
        const origAmt = parseFloat((r.amount ?? "").replace(",", "."));
        if (isFinite(origAmt)) {
          drawRight(page, fmtMoney(origAmt), (cols as any).origAmt + 40, y, 10, fonts.reg);
        } else {
          drawRight(page, "—", (cols as any).origAmt + 40, y, 10, fonts.reg, rgb(0.5, 0.5, 0.5));
        }
        const code = (r.currency ?? "").toUpperCase().slice(0, 4);
        page.drawText(code, { x: (cols as any).code, y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
        const converted = isFinite(origAmt)
          ? convert(origAmt, code, targetCur, opts.fxRates!)
          : null;
        if (converted !== null) {
          drawRight(page, fmtMoney(converted), cols.conv, y, 10, fonts.reg);
        } else {
          drawRight(page, "—", cols.conv, y, 10, fonts.reg, rgb(0.6, 0.2, 0.2));
        }
      } else {
        const amtStr = formatAmount(r);
        page.drawText(truncate(r.vendor ?? "—",    18), { x: cols.vendor, y, size: 10, font: fonts.reg });
        page.drawText(truncate(r.category ?? "—",  13), { x: (cols as any).cat,  y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
        page.drawText(truncate(r.notes ?? "",      28), { x: cols.desc, y, size: 10, font: fonts.reg, color: rgb(0.35, 0.35, 0.35) });
        drawRight(page, amtStr, (cols as any).amt, y, 10, fonts.reg);
      }
      y -= LINE;
    }

    if (showCompanyGroups) {
      // small breathing room between companies
      y -= 4;
    }
  }

  // ----- Totals (right-aligned, just under the table) -----
  // Reserve enough vertical room for totals (~90) + payment block (~70) + footer.
  ensureSpace(190);
  y -= 18; // gap from the last table row

  const labelX = PAGE_W - MARGIN - 200;
  const totalLineLeftX = labelX - 8;
  const totalLineRightX = PAGE_W - MARGIN;

  if (useFx) {
    // Converted totals in target currency.
    let convertedTotal = 0;
    let unconvertibleCount = 0;
    for (const r of opts.receipts) {
      const amt = parseFloat((r.amount ?? "").replace(",", "."));
      if (!isFinite(amt)) continue;
      const v = convert(amt, (r.currency ?? "").toUpperCase(), targetCur, opts.fxRates!);
      if (v === null) unconvertibleCount++;
      else convertedTotal += v;
    }
    // Subtotal & Tax rows (no rule above; matches Carl's invoice template).
    page.drawText("Subtotal", { x: labelX, y, size: 10, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
    drawRight(page, `${targetCur} ${fmtMoney(convertedTotal)}`, totalLineRightX, y, 10, fonts.reg);
    y -= LINE;
    page.drawText("Tax", { x: labelX, y, size: 10, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
    drawRight(page, "—", totalLineRightX, y, 10, fonts.reg, rgb(0.5, 0.5, 0.5));
    // Gap, then divider rule clearly above the Total row.
    y -= LINE + 10;
    page.drawLine({
      start: { x: totalLineLeftX, y: y + 18 }, end: { x: totalLineRightX, y: y + 18 },
      thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
    });
    // Total row — label and amount the same size for clean baseline alignment.
    page.drawText("Total due", { x: labelX, y, size: 13, font: fonts.bold });
    drawRight(page, `${targetCur} ${fmtMoney(convertedTotal)}`, totalLineRightX, y, 13, fonts.bold);
    y -= LINE + 6;
    if (unconvertibleCount > 0) {
      drawRight(page, `${unconvertibleCount} row(s) could not be converted — excluded from total`,
        PAGE_W - MARGIN, y, 8, fonts.reg, rgb(0.6, 0.2, 0.2));
      y -= LINE;
    }
    // Rates source line, so accountants can verify.
    const rateNote = `Exchange rates: ${opts.fxRates!.source} · as of ${opts.fxRates!.date}`;
    page.drawText(rateNote, { x: MARGIN, y, size: 8, font: fonts.reg, color: rgb(0.5, 0.5, 0.5) });
    y -= LINE;
  } else if (opts.fxError) {
    drawRight(page, `(FX rate fetch failed: ${opts.fxError})`, PAGE_W - MARGIN, y, 9, fonts.reg, rgb(0.6, 0.2, 0.2));
    y -= LINE;
  } else {
    // No target currency selected — fall back to per-original-currency subtotals.
    const totals = sumByCurrency(opts.receipts);
    if (totals.size === 0) {
      drawRight(page, "TOTAL —", PAGE_W - MARGIN, y, 12, fonts.bold);
      y -= LINE;
    } else if (totals.size === 1) {
      const [cur, amt] = Array.from(totals)[0];
      page.drawText("Subtotal", { x: labelX, y, size: 10, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
      drawRight(page, `${cur || ""} ${fmtMoney(amt)}`, totalLineRightX, y, 10, fonts.reg);
      y -= LINE;
      page.drawText("Tax", { x: labelX, y, size: 10, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
      drawRight(page, "—", totalLineRightX, y, 10, fonts.reg, rgb(0.5, 0.5, 0.5));
      y -= LINE + 10;
      page.drawLine({
        start: { x: totalLineLeftX, y: y + 18 }, end: { x: totalLineRightX, y: y + 18 },
        thickness: 0.5, color: rgb(0.6, 0.6, 0.6),
      });
      page.drawText("Total due", { x: labelX, y, size: 13, font: fonts.bold });
      drawRight(page, `${cur || ""} ${fmtMoney(amt)}`, totalLineRightX, y, 13, fonts.bold);
      y -= LINE + 6;
    } else {
      drawRight(page, "Subtotals by currency", PAGE_W - MARGIN, y, 10, fonts.bold, rgb(0.35, 0.35, 0.35));
      y -= LINE;
      for (const [cur, amt] of totals) {
        drawRight(page, `${cur || "(unknown)"}  ${fmtMoney(amt)}`, PAGE_W - MARGIN, y, 11, fonts.reg);
        y -= LINE;
      }
    }
  }

  // ----- Payment details block (always on the LAST invoice page) -----
  drawPaymentDetailsAndFooter(page, fonts, opts);
}

function drawPaymentDetailsAndFooter(
  page: PDFPage,
  fonts: Fonts,
  opts: { bank: BankDetails; receipts: ReceiptRow[] }
) {
  // Fixed position near the bottom of the current page.
  const bottomBlockY = MARGIN + 70; // leave room for "Thank you" line under it

  // Separator line
  page.drawLine({
    start: { x: MARGIN, y: bottomBlockY + 30 },
    end:   { x: PAGE_W - MARGIN, y: bottomBlockY + 30 },
    thickness: 0.5, color: rgb(0.85, 0.85, 0.85),
  });

  page.drawText("P A Y M E N T   D E T A I L S", {
    x: MARGIN, y: bottomBlockY + 14, size: 9, font: fonts.reg, color: rgb(0.45, 0.45, 0.45),
  });

  let yy = bottomBlockY - 2;
  const labelX = MARGIN;
  const valueX = MARGIN + 60;
  const rows: Array<[string, string]> = [
    ["Bank",  opts.bank.name  || "—"],
    ["IBAN",  opts.bank.iban  || "—"],
    ["SWIFT", opts.bank.swift || "—"],
  ];
  for (const [label, val] of rows) {
    page.drawText(label, { x: labelX, y: yy, size: 9, font: fonts.reg, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(val,   { x: valueX, y: yy, size: 9, font: fonts.reg });
    yy -= 12;
  }

  // Centered footer
  const footer = "Thank you for your business.";
  const fw = fonts.reg.widthOfTextAtSize(footer, 9);
  page.drawText(footer, {
    x: (PAGE_W - fw) / 2, y: MARGIN - 14, size: 9, font: fonts.reg, color: rgb(0.5, 0.5, 0.5),
  });
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
  let page = pdf.addPage(PageSizes.A4);
  drawHeader(page, fonts, header);
  const lines = wrapText(text, fonts.reg, 9, PAGE_W - 2 * MARGIN);
  let y = PAGE_H - MARGIN - 30;
  let pageNum = 1;
  for (const line of lines) {
    if (y < MARGIN + 12) {
      // Start a new page when we run out of room.
      pageNum++;
      page = pdf.addPage(PageSizes.A4);
      drawHeader(page, fonts, `${header} (cont. p${pageNum})`);
      y = PAGE_H - MARGIN - 30;
    }
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
