import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCountries,
  getPresignedUrl,
  confirmUpload,
  fetchFromExternal,
  openContentSSE,
} from "../api/content";
import { useAuth } from "../contexts/AuthContext";

type Tab = "file" | "url" | "unsplash";

interface Props {
  onClose: () => void;
  onUploaded: (contentId: string) => void;
  defaultCountry?: string;
}

export default function UploadModal({ onClose, onUploaded, defaultCountry }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("file");
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState(defaultCountry || user?.country || "");
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamContentId = useRef<string | null>(null);

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });

  // If modal unmounts while SSE is running, abort and fall back to polling
  useEffect(() => {
    return () => {
      if (abortRef.current && streamContentId.current) {
        abortRef.current.abort();
        onUploaded(streamContentId.current);
      }
    };
  }, [onUploaded]);

  const handleClose = () => {
    if (streaming && streamContentId.current) {
      abortRef.current?.abort();
      onUploaded(streamContentId.current);
      streamContentId.current = null;
      abortRef.current = null;
    }
    onClose();
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setErrorMsg("");
  };

  // ── File upload (existing presigned-URL flow) ──────────────────────────────
  const handleFileUpload = async () => {
    if (!file || !country) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const { upload_url, content_id } = await getPresignedUrl(file.name, country);
      await fetch(upload_url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      await confirmUpload(content_id);
      onUploaded(content_id);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed. Try again.");
      setUploading(false);
    }
  };

  // ── URL / Unsplash: POST → SSE ────────────────────────────────────────────
  const handleExternalUpload = async () => {
    if (!country) return;
    if (tab === "url" && !urlInput.trim()) return;
    setUploading(true);
    setErrorMsg("");

    try {
      const { content_id } = await fetchFromExternal({
        country,
        source: tab === "url" ? "url" : "unsplash",
        url: tab === "url" ? urlInput.trim() : undefined,
        unsplash_keyword: tab === "unsplash" ? keyword.trim() : undefined,
      });

      streamContentId.current = content_id;
      setUploading(false);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      openContentSSE(
        content_id,
        (event) => {
          if (event.status === "ready") {
            streamContentId.current = null;
            abortRef.current = null;
            onUploaded(content_id);
            onClose();
          } else if (event.status === "failed") {
            streamContentId.current = null;
            abortRef.current = null;
            setStreaming(false);
            setErrorMsg("Poster generation failed. Please try again.");
          }
        },
        ctrl.signal
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Request failed. Try again.");
      setUploading(false);
    }
  };

  // ── Shared styles ──────────────────────────────────────────────────────────
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
  const labelStyle: React.CSSProperties = {
    display: "block", color: "var(--text-muted)", fontSize: "0.8rem",
    marginBottom: "0.4rem", letterSpacing: "0.05em",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem",
    backgroundColor: "var(--bg-btn)", border: "1px solid var(--border)",
    borderRadius: "6px", color: "var(--text)", fontFamily: "DM Sans", fontSize: "0.9rem",
    boxSizing: "border-box",
  };
  const btnStyle = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "0.65rem",
    backgroundColor: disabled ? "var(--bg-btn)" : "var(--amber)",
    color: disabled ? "var(--text-muted)" : "#fff",
    border: "none", borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "DM Sans", fontSize: "0.95rem", fontWeight: 600,
  });

  const header = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
      <h2 style={{ fontFamily: "Bebas Neue", fontSize: "1.6rem", color: "var(--text)" }}>Upload Image</h2>
      <button onClick={handleClose} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>
        ✕
      </button>
    </div>
  );

  // ── Spinner screen shown while SSE is active ───────────────────────────────
  if (streaming) {
    return (
      <div style={overlay}>
        <div style={modal}>
          {header}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "2rem 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              border: "3px solid var(--border)", borderTopColor: "var(--amber)",
              animation: "spin 0.8s linear infinite", marginBottom: "1.5rem",
            }} />
            <p style={{ color: "var(--text)", fontWeight: 600, marginBottom: "0.4rem" }}>
              Generating your poster…
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              This may take a minute or two.
            </p>
          </div>
          {errorMsg && (
            <p style={{ color: "var(--miss)", fontSize: "0.8rem", marginTop: "0.75rem", textAlign: "center" }}>
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    );
  }

  const countrySelect = (
    <div style={{ marginBottom: "1.5rem" }}>
      <label style={labelStyle}>COUNTRY</label>
      <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
        <option value="">Select a country…</option>
        {countries?.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </div>
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "file", label: "File Upload" },
    { key: "url", label: "From URL" },
    { key: "unsplash", label: "Unsplash" },
  ];

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={modal}>
        {header}

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "0.25rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              style={{
                background: "none", border: "none",
                borderBottom: tab === key ? "2px solid var(--amber)" : "2px solid transparent",
                color: tab === key ? "var(--text)" : "var(--text-muted)",
                padding: "0.4rem 0.75rem", marginBottom: "-1px",
                cursor: "pointer", fontFamily: "DM Sans", fontSize: "0.82rem",
                fontWeight: tab === key ? 600 : 400,
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* File Upload tab */}
        {tab === "file" && (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>IMAGE FILE</label>
              <div
                onClick={() => inputRef.current?.click()}
                style={{
                  border: "2px dashed var(--border)", borderRadius: "8px",
                  padding: "1.5rem", textAlign: "center", cursor: "pointer",
                  color: file ? "var(--text)" : "var(--text-muted)", transition: "border-color 0.2s",
                }}
              >
                {file ? `✓ ${file.name}` : "Click to select .jpg / .png / .webp"}
              </div>
              <input
                ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                style={{ display: "none" }}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {countrySelect}
            {errorMsg && <p style={{ color: "var(--miss)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{errorMsg}</p>}
            <button
              onClick={handleFileUpload}
              disabled={!file || !country || uploading}
              style={btnStyle(!file || !country || uploading)}
            >
              {uploading ? "Uploading…" : "Generate Poster"}
            </button>
          </>
        )}

        {/* From URL tab */}
        {tab === "url" && (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>IMAGE URL</label>
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={inputStyle}
              />
            </div>
            {countrySelect}
            {errorMsg && <p style={{ color: "var(--miss)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{errorMsg}</p>}
            <button
              onClick={handleExternalUpload}
              disabled={!urlInput.trim() || !country || uploading}
              style={btnStyle(!urlInput.trim() || !country || uploading)}
            >
              {uploading ? "Fetching…" : "Generate Poster"}
            </button>
          </>
        )}

        {/* Unsplash tab */}
        {tab === "unsplash" && (
          <>
            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>KEYWORD (OPTIONAL)</label>
              <input
                type="text"
                placeholder="landscapes, mountains, ocean…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={inputStyle}
              />
              <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.4rem" }}>
                Leave blank for a completely random photo.
              </p>
            </div>
            {countrySelect}
            {errorMsg && <p style={{ color: "var(--miss)", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{errorMsg}</p>}
            <button
              onClick={handleExternalUpload}
              disabled={!country || uploading}
              style={btnStyle(!country || uploading)}
            >
              {uploading ? "Fetching from Unsplash…" : "Get Random Image"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
