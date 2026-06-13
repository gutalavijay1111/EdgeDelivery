import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getCountries, getPresignedUrl, confirmUpload, getContentStatus } from "../api/content";
import { useQuery } from "@tanstack/react-query";

type Stage = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [country, setCountry] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: getCountries });

  const handleUpload = async () => {
    if (!file || !country) return;
    setStage("uploading");
    setErrorMsg("");

    try {
      const { upload_url, content_id } = await getPresignedUrl(file.name, country);

      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      await confirmUpload(content_id);
      setStage("processing");

      // Poll every 4 seconds until ready or failed
      const timer = setInterval(async () => {
        const { status } = await getContentStatus(content_id);
        if (status === "ready") {
          clearInterval(timer);
          setStage("done");
          queryClient.invalidateQueries({ queryKey: ["content"] });
        } else if (status === "failed") {
          clearInterval(timer);
          setErrorMsg("Poster generation failed. Try a different image.");
          setStage("error");
        }
      }, 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Upload failed");
      setStage("error");
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
  const btn = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "0.65rem",
    backgroundColor: disabled ? "var(--bg-btn)" : "var(--amber)",
    color: disabled ? "var(--text-muted)" : "#fff",
    border: "none", borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "DM Sans", fontSize: "0.95rem", fontWeight: 600,
  });

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

        {stage === "idle" && (
          <>
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

            <button onClick={handleUpload} disabled={!file || !country} style={btn(!file || !country)}>
              Generate Poster
            </button>
          </>
        )}

        {stage === "uploading" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ color: "var(--text-muted)" }}>Uploading to S3…</p>
          </div>
        )}

        {stage === "processing" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{
              width: "40px", height: "40px", margin: "0 auto 1rem",
              border: "3px solid var(--border)", borderTopColor: "var(--amber)",
              borderRadius: "50%", animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ color: "var(--text)", fontWeight: 600 }}>Generating poster…</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
              Gemini is analysing your image — usually 30–60 seconds
            </p>
          </div>
        )}

        {stage === "done" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ fontSize: "2rem" }}>🎬</p>
            <p style={{ color: "var(--hit)", fontWeight: 600, marginTop: "0.5rem" }}>Poster ready!</p>
            <button onClick={onClose} style={{ ...btn(), marginTop: "1rem" }}>View in explore</button>
          </div>
        )}

        {stage === "error" && (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <p style={{ color: "var(--miss)", fontWeight: 600 }}>Something went wrong</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: "0.5rem 0 1rem" }}>{errorMsg}</p>
            <button onClick={() => setStage("idle")} style={{ ...btn(), backgroundColor: "var(--bg-btn)", color: "var(--text)" }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
