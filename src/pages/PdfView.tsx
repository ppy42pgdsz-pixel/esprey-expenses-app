import { useNavigate, useSearchParams } from "react-router-dom";

export default function PdfView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const file = params.get("file") ?? "";
  // viewUrl uses inline-disposition so iOS renders inside the iframe.
  // downloadUrl uses attachment-disposition for the explicit Save button.
  const viewUrl = `/api/reports/view?file=${encodeURIComponent(file)}#toolbar=1&view=FitH`;
  const downloadUrl = `/api/reports/download?file=${encodeURIComponent(file)}`;

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
          href={downloadUrl}
          download={file}
          className="download-link"
          aria-label="Save to Files"
        >Save</a>
      </header>
      <iframe
        src={viewUrl}
        title="Monthly report PDF"
        className="pdf-view-frame"
      />
    </div>
  );
}
