import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentItem } from "../api/content";

interface LatencyResult { miss: number; hit: number }

function useLatency(url: string) {
  const [result, setResult] = useState<LatencyResult | null>(null);
  const measured = useRef(false);

  const onLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (measured.current || !url) return;
    measured.current = true;

    // MISS: read from PerformanceResourceTiming — this is the actual first-fetch time
    // (no extra network request needed; the <img> already fetched it)
    const entries = performance.getEntriesByName(
      e.currentTarget.src,
      "resource"
    ) as PerformanceResourceTiming[];
    const entry = entries[entries.length - 1];
    const miss = entry ? Math.round(entry.responseEnd - entry.fetchStart) : 0;

    // HIT: load the same URL again via Image() — should come from browser cache
    const t = performance.now();
    const img = new Image();
    img.onload = img.onerror = () => {
      const hit = Math.round(performance.now() - t);
      setResult({ miss, hit });
    };
    img.src = url;
  }, [url]);

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

  // Preload the background image so hover switches instantly without a new network request
  useEffect(() => {
    if (item.background_url) {
      const img = new Image();
      img.src = item.background_url;
    }
  }, [item.background_url]);

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
        border: "1px solid var(--border-card)",
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
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {item.status === "processing" || item.status === "pending" ? "Generating…" : "No image"}
            </span>
          </div>
        )}

        {/* Latency badges — MISS is first-fetch from CDN, HIT is browser cache read */}
        {latency && (
          <div style={{ position: "absolute", bottom: "6px", left: "6px", display: "flex", gap: "4px" }}>
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

        {/* Status badge for non-ready items */}
        {item.status !== "ready" && (
          <span style={{
            position: "absolute", top: "6px", left: "6px",
            fontSize: "9px", padding: "2px 6px", borderRadius: "3px",
            backgroundColor: item.status === "failed" ? "var(--miss)" : "var(--amber)",
            color: "#fff", fontFamily: "monospace", textTransform: "uppercase",
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
          fontFamily: "Bebas Neue", fontSize: "1rem", color: "var(--text)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {item.title || "Untitled"}
        </h3>
        {meta?.tagline && (
          <p style={{
            fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px",
            display: "-webkit-box", WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {meta.tagline}
          </p>
        )}
        {meta?.emotion && (
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
