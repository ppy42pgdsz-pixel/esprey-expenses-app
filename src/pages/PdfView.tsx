import { useNavigate, useSearchParams } from "react-router-dom";

export default function PdfView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const file = params.get("file") ?? "";
  const url = `/api/reports/download?file=${encodeURIComponent(file)}#toolbar=1&view=FitH`;

  return (
    <div className="pdf-view">
      <header className="pdf-view-bar">
        <button
          type="button"
          className="back-btn"
          onClick={() => (history.length > 1 ? navigate(-1) : navigate("/reports"))}
        >
          ← Back
        </button>
        <span className="pdf-view-title">{file}</span>
        <a
          href={url}
          download={file}
          className="download-link"
          aria-label="Save to Files"
        >Save</a>
      </header>
      <iframe
        src={url}
        title="Monthly report PDF"
        className="pdf-view-frame"
      />
    </div>
  );
}
