import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Capture() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setErr(null);
    if (f && f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setErr(null);
    try {
      const res = await api.uploadReceipt(file);
      navigate(`/receipt/${res.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const isPdf = !!file && file.type === "application/pdf";

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

      {!file ? (
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
              // Widen accept while picking from library so PDFs are also offered.
              el.setAttribute("accept", "image/*,application/pdf");
              el.click();
              // restore for next time
              setTimeout(() => {
                el.setAttribute("capture", "environment");
                el.setAttribute("accept", "image/*");
              }, 1000);
            }}
          >
            Pick photo or PDF from files
          </button>
          <div className="capture-tip">
            No signal? Use your <strong>Camera app</strong> and email the photo to{" "}
            <code>receipts@esprey.net</code> — your mail app will send it when you're back online.
          </div>
        </div>
      ) : (
        <div className="capture-preview">
          {isPdf ? (
            <div className="pdf-preview">
              <div className="pdf-preview-icon">📄</div>
              <div className="pdf-preview-meta">
                <strong>{file.name || "PDF file"}</strong>
                <small>{(file.size / 1024).toFixed(0)} KB · application/pdf</small>
                <small>Claude will read the PDF contents.</small>
              </div>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="preview" />
          ) : (
            <div className="empty">No preview available.</div>
          )}
          <div className="capture-actions">
            <button className="ghost-btn" onClick={() => { setFile(null); setPreviewUrl(null); }} disabled={uploading}>
              {isPdf ? "Pick another" : "Retake"}
            </button>
            <button className="primary-btn" onClick={onUpload} disabled={uploading}>
              {uploading ? "Uploading & reading…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
