import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentItem } from "../api/content";

interface LatencyResult { miss: number; hit: number }

function useLatency(thumbnailUrl: string) {
  const [result, setResult] = useState<LatencyResult | null>(null);
  const measured = useRef(false);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only measure the thumbnail on its first load, not the hover background image
    if (measured.current || !thumbnailUrl) return;
    if (e.currentTarget.src !== thumbnailUrl) return;
    measured.current = true;

    // MISS: entry.duration is always exposed even cross-origin (unlike responseEnd/fetchStart
    // which are zeroed without Timing-Allow-Origin). It equals the full fetch time.
    const entries = performance.getEntriesByName(thumbnailUrl, "resource") as PerformanceResourceTiming[];
    const entry = entries[entries.length - 1];
    const miss = entry && entry.duration > 0 ? Math.round(entry.duration) : null;

    // HIT: load the same URL again — should be served from browser cache instantly
    const t = performance.now();
    const img = new Image();
    img.onload = img.onerror = () => {
      const hit = Math.round(performance.now() - t);
      if (miss !== null) setResult({ miss, hit });
    };
    img.src = thumbnailUrl;
  }, [thumbnailUrl]);

  return { result, onLoad };
}

interface Props {
  item: ContentItem;
  onClick: (item: ContentItem) => void;
}

export default function ContentCard({ item, onClick }: Props) {
  const [hovered, setHovered] = useState(false);
  const { result: latency, onLoad } = useLatency(item.thumbnail_url);
  const meta = item.poster_metadata as Record<string, string>;

  const src = hovered && item.background_url ? item.background_url : item.thumbnail_url;

  useEffect(() => {
    if (item.background_url) {
      const img = new Image();
      img.src = item.background_url;
    }
  }, [item.background_url]);

  const isFailed = item.status === "failed";
  const isGenerating = item.status === "pending" || item.status === "processing";

  return (
    <div
      className="animate-fade-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onClick(item)}
      style={{
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${isFailed ? "rgba(192,98,42,0.4)" : "var(--border-card)"}`,
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s",
        transform: hovered ? "translateY(-4px) scale(1.01)" : "none",
        boxShadow: hovered ? "var(--shadow-lg)" : "var(--shadow)",
      }}
    >
      {/* Poster image */}
      <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", backgroundColor: "var(--border)" }}>
        {src ? (
          <img
            src={src}
            alt={item.title}
            loading="lazy"
            onLoad={onLoad}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : isFailed ? (
          /* Failed state — clear, unmistakable, not "Generating" */
          <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(160deg, rgba(192,98,42,0.12) 0%, rgba(192,98,42,0.04) 100%)",
            gap: "0.6rem",
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.7 }}>
              <circle cx="18" cy="18" r="16" stroke="var(--miss)" strokeWidth="1.5" />
              <path d="M12 12L24 24M24 12L12 24" stroke="var(--miss)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ color: "var(--miss)", fontSize: "0.7rem", fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Generation Failed
            </span>
          </div>
        ) : isGenerating ? (
          /* Generating state — spinner with pulsing rings */
          <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "0.75rem",
          }}>
            <div style={{ position: "relative", width: 40, height: 40 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: "2px solid var(--border)", borderTopColor: "var(--amber)",
                animation: "spin 0.9s linear infinite",
              }} />
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "0.68rem", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Generating…
            </span>
          </div>
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>No image</span>
          </div>
        )}

        {/* CDN + Cache latency badges — only when real timing data is available */}
        {latency && (
          <div data-tutorial="cdn-metric" style={{ position: "absolute", bottom: "6px", left: "6px", display: "flex", gap: "4px" }}>
            <span style={{
              fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.75)", color: "var(--miss)", fontFamily: "monospace",
            }}>
              CDN {latency.miss}ms
            </span>
            <span style={{
              fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.75)", color: "var(--hit)", fontFamily: "monospace",
            }}>
              CACHE {latency.hit}ms
            </span>
          </div>
        )}

        {/* Status badge — only for non-ready items that have a visible image */}
        {item.status !== "ready" && !isFailed && !isGenerating && (
          <span style={{
            position: "absolute", top: "6px", left: "6px",
            fontSize: "9px", padding: "2px 6px", borderRadius: "3px",
            backgroundColor: "var(--amber)", color: "#fff",
            fontFamily: "monospace", textTransform: "uppercase",
          }}>
            {item.status}
          </span>
        )}

        {/* Source badge */}
        {item.source === "wikimedia" && (
          <span style={{
            position: "absolute", top: "6px", right: "6px",
            fontSize: "9px", padding: "2px 5px", borderRadius: "3px",
            backgroundColor: "rgba(0,0,0,0.65)", color: "#aaa", fontFamily: "monospace",
          }}>
            WIKI
          </span>
        )}
      </div>

      {/* Metadata */}
      <div style={{ padding: "0.65rem 0.75rem" }}>
        <h3 style={{
          fontFamily: "Bebas Neue", fontSize: "1rem", color: isFailed ? "var(--text-muted)" : "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.title || (isFailed ? "Failed" : isGenerating ? "Generating…" : "Untitled")}
        </h3>
        {meta?.tagline && !isFailed && (
          <p style={{
            fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {meta.tagline}
          </p>
        )}
        {isFailed && (
          <p style={{ fontSize: "0.7rem", color: "var(--miss)", marginTop: "2px", opacity: 0.8 }}>
            Could not generate poster
          </p>
        )}
        {meta?.emotion && !isFailed && (
          <span style={{
            display: "inline-block", marginTop: "6px",
            fontSize: "9px", padding: "2px 6px", borderRadius: "3px",
            backgroundColor: "var(--bg-btn)", color: "var(--text-muted)",
            border: "1px solid var(--border)", textTransform: "uppercase",
          }}>
            {meta.emotion}
          </span>
        )}
      </div>
    </div>
  );
}
