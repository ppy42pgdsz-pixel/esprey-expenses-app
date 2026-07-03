import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Capture() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [isMultiPage, setIsMultiPage] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    function up()   { setOnline(true);  }
    function down() { setOnline(false); }
    window.addEventListener("online",  up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online",  up);
      window.removeEventListener("offline", down);
    };
  }, []);

  function onPickInitial(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles(list);
    setErr(null);
    setIsMultiPage(false);
    if (list.length === 1 && list[0].type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(list[0]));
    } else {
      setPreviewUrl(null);
    }
    // Reset the input so the same camera shot can be picked again later.
    e.target.value = "";
  }

  function onAddPage(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setFiles((prev) => [...prev, ...list]);
    setIsMultiPage(true);
    setPreviewUrl(null); // multi-page uses the thumbnail list, not a single big preview
    setErr(null);
    e.target.value = "";
  }

  function startCamera() {
    const el = inputRef.current;
    if (!el) return;
    el.setAttribute("capture", "environment");
    el.setAttribute("accept", "image/*");
    el.removeAttribute("multiple");
    el.click();
  }

  function startLibraryPicker() {
    const el = inputRef.current;
    if (!el) return;
    el.removeAttribute("capture");
    el.setAttribute("accept", "image/*,application/pdf");
    el.setAttribute("multiple", "");
    el.click();
    // Reset for next time the camera button is used.
    setTimeout(() => {
      el.setAttribute("capture", "environment");
      el.setAttribute("accept", "image/*");
      el.removeAttribute("multiple");
    }, 1000);
  }

  function startAddPage() {
    // Same as startCamera but the picked file is appended via onAddPage.
    const el = addPageRef.current;
    if (!el) return;
    el.click();
  }

  const addPageRef = useRef<HTMLInputElement | null>(null);

  async function onUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setErr(null);

    // Multi-page: combine images into a single PDF, upload as one receipt.
    if (isMultiPage) {
      try {
        const pdfBytes = await imagesToPdf(files);
        const pdfFile = new File(
          [new Blob([pdfBytes as unknown as BlobPart], { type: "application/pdf" })],
          `multi-page-${Date.now()}.pdf`,
          { type: "application/pdf" },
        );
        const res = await api.uploadReceipt(pdfFile);
        navigate(`/receipt/${res.id}`);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Single file: existing UX, lands on the receipt detail page.
    if (files.length === 1) {
      try {
        const res = await api.uploadReceipt(files[0]);
        navigate(`/receipt/${res.id}`);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Bulk path (multi-select from library): each file = its own receipt.
    setProgress({ done: 0, total: files.length, failed: 0 });
    for (let i = 0; i < files.length; i++) {
      try {
        await api.uploadReceipt(files[i]);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      } catch (e) {
        console.error(`bulk upload failed for ${files[i].name}`, e);
        setProgress((p) => (p ? { ...p, done: p.done + 1, failed: p.failed + 1 } : p));
      }
    }
    setUploading(false);
    navigate("/");
  }

  const isPdf = !isMultiPage && files.length === 1 && files[0].type === "application/pdf";
  const isSingleImage = !isMultiPage && files.length === 1 && files[0].type.startsWith("image/");
  const isBulk = !isMultiPage && files.length > 1;

  return (
    <div className="page capture">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Capture receipt</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {!online && (
        <div className="offline-warn">
          <strong>📡 No internet detected.</strong>
          <p>
            Photos taken in this app are <strong>not yet</strong> saved while offline — they'd be lost when the upload fails.
            As a fallback right now: take the photo with your phone's <strong>Camera app</strong>, then email it to{" "}
            <code>receipts@esprey.net</code>. Your mail app's outbox will queue and send it when you're back online.
          </p>
        </div>
      )}

      {/* Hidden inputs — initial pick (camera or library) and add-page (camera only). */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onPickInitial}
        style={{ display: "none" }}
      />
      <input
        ref={addPageRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onAddPage}
        style={{ display: "none" }}
      />

      {files.length === 0 ? (
        <div className="capture-cta">
          <p>Snap a photo of your receipt — Claude will read it.</p>
          <button className="primary-btn big" onClick={startCamera}>
            Open camera
          </button>
          <button className="ghost-btn" onClick={startLibraryPicker}>
            Pick photo(s) or PDF from files
          </button>
          <div className="capture-tip">
            <strong>Multi-page invoice?</strong> Open camera, take the first page,
            then tap <em>"+ Add another page"</em> on the preview to keep going.
            All pages are combined into one PDF receipt.
            <br /><br />
            <strong>Bulk upload tip:</strong> in the file picker, tap-and-hold on iPhone
            or Cmd-click on Mac to select multiple files at once. Each becomes its own receipt.
            <br /><br />
            No signal? Use your <strong>Camera app</strong> and email to{" "}
            <code>receipts@esprey.net</code>.
          </div>
        </div>
      ) : (
        <div className="capture-preview">
          {isMultiPage ? (
            <div className="multipage-preview">
              <div className="multipage-title">
                Multi-page document · {files.length} page{files.length === 1 ? "" : "s"}
              </div>
              <ul className="multipage-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <span className="multipage-num">Page {i + 1}</span>
                    <span className="multipage-name">{f.name || "(camera shot)"}</span>
                    <small>{(f.size / 1024).toFixed(0)} KB</small>
                  </li>
                ))}
              </ul>
              <p className="hint small" style={{ margin: "8px 0 0 0" }}>
                Pages will be combined into a single PDF and saved as one receipt.
              </p>
            </div>
          ) : isBulk ? (
            <div className="bulk-preview">
              <div className="bulk-preview-title">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </div>
              <ul className="bulk-preview-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <span className="bulk-preview-icon">
                      {f.type === "application/pdf" ? "📄" : "🖼️"}
                    </span>
                    <span className="bulk-preview-name">{f.name || "(no name)"}</span>
                    <small>{(f.size / 1024).toFixed(0)} KB</small>
                  </li>
                ))}
              </ul>
              {progress && (
                <div className="bulk-progress">
                  Uploading {progress.done} of {progress.total}…
                  {progress.failed > 0 && <span className="warn-text"> · {progress.failed} failed</span>}
                </div>
              )}
            </div>
          ) : isPdf ? (
            <div className="pdf-preview">
              <div className="pdf-preview-icon">📄</div>
              <div className="pdf-preview-meta">
                <strong>{files[0].name || "PDF file"}</strong>
                <small>{(files[0].size / 1024).toFixed(0)} KB · application/pdf</small>
                <small>Claude will read the PDF contents.</small>
              </div>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="preview" />
          ) : (
            <div className="empty">No preview available.</div>
          )}

          <div className="capture-actions">
            <button
              className="ghost-btn"
              onClick={() => {
                setFiles([]); setPreviewUrl(null); setProgress(null); setIsMultiPage(false);
              }}
              disabled={uploading}
            >
              {isMultiPage || isBulk || isPdf ? "Start over" : "Retake"}
            </button>

            {/* "Add another page" — available after a single camera image
                (single-document, possibly multi-page workflow) OR while
                already in multi-page mode. Not shown for bulk/library
                picks or for single PDFs. */}
            {(isSingleImage || isMultiPage) && (
              <button
                className="ghost-btn"
                onClick={startAddPage}
                disabled={uploading}
              >
                + Add another page
              </button>
            )}

            <button className="primary-btn" onClick={onUpload} disabled={uploading}>
              {uploading
                ? (isBulk
                    ? `Uploading ${progress?.done ?? 0}/${progress?.total ?? files.length}…`
                    : isMultiPage
                      ? `Building PDF & uploading…`
                      : "Uploading & reading…")
                : isMultiPage
                  ? `Save as ${files.length}-page PDF`
                  : isBulk
                    ? `Upload ${files.length} files`
                    : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- multi-page image → PDF (client-side, jsPDF lazy-loaded from CDN) -------- */
const JSPDF_VERSION = "2.5.1";
const JSPDF_SRC = `https://cdnjs.cloudflare.com/ajax/libs/jspdf/${JSPDF_VERSION}/jspdf.umd.min.js`;
declare global { interface Window { jspdf?: any; } }

async function ensureJsPdf(): Promise<any> {
  if (window.jspdf?.jsPDF) return window.jspdf;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JSPDF_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load jsPDF"));
    document.head.appendChild(s);
  });
  if (!window.jspdf?.jsPDF) throw new Error("jsPDF global not found after load");
  return window.jspdf;
}

async function imagesToPdf(images: File[]): Promise<Uint8Array> {
  const lib = await ensureJsPdf();
  const { jsPDF } = lib;
  // A4 portrait, mm units — works for nearly all receipt formats.
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    if (!file.type.startsWith("image/")) continue;
    const dataUrl = await fileToDataUrl(file);
    const dim = await getImageDimensions(dataUrl);
    if (i > 0) pdf.addPage();
    // Fit-to-page with margin, preserving aspect ratio.
    const margin = 5;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    const ratio = Math.min(maxW / dim.w, maxH / dim.h);
    const w = dim.w * ratio;
    const h = dim.h * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    const fmt = file.type === "image/png" ? "PNG" : "JPEG";
    pdf.addImage(dataUrl, fmt, x, y, w, h);
  }
  const ab = pdf.output("arraybuffer") as ArrayBuffer;
  return new Uint8Array(ab);
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("FileReader failed"));
    r.readAsDataURL(f);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = dataUrl;
  });
}
