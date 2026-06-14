// Thin client for the PDFShift HTML→PDF API.
// Used to render an email's HTML body as a proper PDF page (or pages) for the
// monthly-report appendix. Free tier covers ~50 conversions per month, which
// is plenty for a personal expense workflow.

export async function htmlToPdf(opts: {
  apiKey: string;
  html: string;
  format?: "A4" | "Letter";
  margin?: string;       // e.g. "20mm"
  landscape?: boolean;
}): Promise<Uint8Array> {
  const res = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // PDFShift accepts HTTP basic auth with username "api" and the key as password.
      "Authorization": "Basic " + btoa("api:" + opts.apiKey),
    },
    body: JSON.stringify({
      source: opts.html,
      format: opts.format ?? "A4",
      margin: opts.margin ?? "20mm",
      landscape: !!opts.landscape,
      sandbox: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`PDFShift ${res.status}: ${errText.slice(0, 400)}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
