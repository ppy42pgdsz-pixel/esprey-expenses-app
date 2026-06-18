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

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    setFiles(list);
    setErr(null);
    if (list.length === 1 && list[0].type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(list[0]));
    } else {
      setPreviewUrl(null);
    }
  }

  async function onUpload() {
    if (files.length === 0) return;
    setUploading(true);
    setErr(null);

    // Single-file path: keep the original UX (navigate straight to the receipt
    // detail so the user can review/edit OCR).
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

    // Bulk path: upload sequentially, show progress, then dump the user on
    // the dashboard where they can spot any with failed OCR and edit them.
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

  const isPdf = files.length === 1 && files[0].type === "application/pdf";
  const isBulk = files.length > 1;

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

      {files.length === 0 ? (
        <div className="capture-cta">
          <p>Snap a photo of your receipt — Claude will read it.</p>
          <button
            className="primary-btn big"
            onClick={() => inputRef.current?.click()}
          >
            Open camera
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            style={{ display: "none" }}
          />
          <button
            className="ghost-btn"
            onClick={() => {
              const el = inputRef.current;
              if (!el) return;
              el.removeAttribute("capture");
              // Widen accept while picking from library, AND allow multi-select
              // so the user can bulk-upload a backlog of receipts.
              el.setAttribute("accept", "image/*,application/pdf");
              el.setAttribute("multiple", "");
              el.click();
              // restore for next time (next "Open camera" tap = single image, no multi)
              setTimeout(() => {
                el.setAttribute("capture", "environment");
                el.setAttribute("accept", "image/*");
                el.removeAttribute("multiple");
              }, 1000);
            }}
          >
            Pick photo(s) or PDF(s) from files
          </button>
          <div className="capture-tip">
            <strong>Bulk upload tip:</strong> in the file picker, tap-and-hold
            on iPhone or Cmd-click on Mac to select multiple files at once.
            Each one becomes its own receipt with OCR.
            <br />
            <br />
            No signal? Use your <strong>Camera app</strong> and email the photo to{" "}
            <code>receipts@esprey.net</code> — your mail app will send it when you're back online.
          </div>
        </div>
      ) : (
        <div className="capture-preview">
          {isBulk ? (
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
              onClick={() => { setFiles([]); setPreviewUrl(null); setProgress(null); }}
              disabled={uploading}
            >
              {isBulk || isPdf ? "Pick again" : "Retake"}
            </button>
            <button className="primary-btn" onClick={onUpload} disabled={uploading}>
              {uploading
                ? (isBulk ? `Uploading ${progress?.done ?? 0}/${progress?.total ?? files.length}…` : "Uploading & reading…")
                : isBulk ? `Upload ${files.length} files` : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
