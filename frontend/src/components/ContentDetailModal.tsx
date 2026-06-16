import type { ContentItem } from "../api/content";

interface Props {
  item: ContentItem;
  onClose: () => void;
}

export default function ContentDetailModal({ item, onClose }: Props) {
  const meta = item.poster_metadata as Record<string, string>;
  const imageUrl = item.background_url || item.thumbnail_url;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: "1rem",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="animate-fade-in"
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "12px",
          overflow: "hidden",
          width: "100%",
          maxWidth: "860px",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Landscape image */}
        {imageUrl && (
          <div style={{ position: "relative", aspectRatio: "16/9", backgroundColor: "var(--border)" }}>
            <img
              src={imageUrl}
              alt={item.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: "0.75rem",
                right: "0.75rem",
                background: "rgba(0,0,0,0.6)",
                border: "none",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Metadata */}
        <div style={{ padding: "1.5rem" }}>
          <h2 style={{ fontFamily: "Bebas Neue", fontSize: "1.8rem", color: "var(--text)", marginBottom: "0.5rem" }}>
            {item.title || "Untitled"}
          </h2>

          {meta?.tagline && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", marginBottom: "1rem", fontStyle: "italic" }}>
              {meta.tagline}
            </p>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {meta?.emotion && (
              <span style={pill}>{meta.emotion}</span>
            )}
            {meta?.genre && (
              <span style={pill}>{meta.genre}</span>
            )}
            {item.source === "wikimedia" && (
              <span style={{ ...pill, color: "var(--text-muted)" }}>Wikimedia</span>
            )}
            <span style={{ ...pill, color: "var(--amber)", borderColor: "var(--amber)" }}>
              {item.status}
            </span>
          </div>

          {meta?.description && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "1rem", lineHeight: 1.6 }}>
              {meta.description}
            </p>
          )}

          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "1rem" }}>
            Uploaded by <strong style={{ color: "var(--text)" }}>{item.uploaded_by ?? "unknown"}</strong>
            {item.processed_at && (
              <> · Processed {new Date(item.processed_at).toLocaleDateString()}</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

const pill: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  padding: "3px 10px",
  borderRadius: "999px",
  backgroundColor: "var(--bg-btn)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
