import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function Capture() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setErr(null);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
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

  return (
    <div className="page capture">
      <header className="topbar">
        <Link to="/" className="back">← Back</Link>
        <h1>Capture receipt</h1>
        <span />
      </header>

      {err && <div className="err">{err}</div>}

      {!previewUrl ? (
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
              el.click();
              // restore for next time
              setTimeout(() => el.setAttribute("capture", "environment"), 1000);
            }}
          >
            Pick from photo library
          </button>
        </div>
      ) : (
        <div className="capture-preview">
          <img src={previewUrl} alt="preview" />
          <div className="capture-actions">
            <button className="ghost-btn" onClick={() => { setFile(null); setPreviewUrl(null); }} disabled={uploading}>
              Retake
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
