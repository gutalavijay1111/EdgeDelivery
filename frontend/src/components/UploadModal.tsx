import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCountries, getPresignedUrl, confirmUpload } from "../api/content";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  onClose: () => void;
  onUploaded: (contentId: string) => void;
  defaultCountry?: string;
}

export default function UploadModal({ onClose, onUploaded, defaultCountry }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [country, setCountry] = useState(
    defaultCountry || user?.country || ""
  );
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });

  const handleUpload = async () => {
    if (!file || !country) return;
    setUploading(true);
    setErrorMsg("");

    try {
      const { upload_url, content_id } = await getPresignedUrl(file.name, country);

      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await confirmUpload(content_id);

      // Hand off to parent for background polling + toast, then close
      onUploaded(content_id);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed. Try again.");
      setUploading(false);
    }
  };

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
  };
  const modal: React.CSSProperties = {
    backgroundColor: "var(--bg-modal)", borderRadius: "12px",
    padding: "2rem", width: "420px", maxWidth: "92vw",
    border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)",
    animation: "fade-in 0.2s ease both",
  };
  const label: React.CSSProperties = {
    display: "block", color: "var(--text-muted)", fontSize: "0.8rem",
    marginBottom: "0.4rem", letterSpacing: "0.05em",
  };
  const input: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    backgroundColor: "var(--bg-btn)", border: "1px solid var(--border)",
    borderRadius: "6px", color: "var(--text)", fontFamily: "DM Sans", fontSize: "0.9rem",
  };
  const btnStyle = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "0.65rem",
    backgroundColor: disabled ? "var(--bg-btn)" : "var(--amber)",
    color: disabled ? "var(--text-muted)" : "#fff",
    border: "none", borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "DM Sans", fontSize: "0.95rem", fontWeight: 600,
  });

  const isDisabled = !file || !country || uploading;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "Bebas Neue", fontSize: "1.6rem", color: "var(--text)" }}>
            Upload Image
          </h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>
            ✕
          </button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={label}>IMAGE FILE</label>
          <div
            onClick={() => inputRef.current?.click()}
            style={{
              border: "2px dashed var(--border)", borderRadius: "8px",
              padding: "1.5rem", textAlign: "center", cursor: "pointer",
              color: file ? "var(--text)" : "var(--text-muted)",
              transition: "border-color 0.2s",
            }}
          >
            {file ? `✓ ${file.name}` : "Click to select .jpg / .png / .webp"}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={label}>COUNTRY</label>
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={input}>
            <option value="">Select a country…</option>
            {countries?.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <p style={{ color: "var(--miss)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{errorMsg}</p>
        )}

        <button onClick={handleUpload} disabled={isDisabled} style={btnStyle(isDisabled)}>
          {uploading ? "Uploading…" : "Generate Poster"}
        </button>
      </div>
    </div>
  );
}
