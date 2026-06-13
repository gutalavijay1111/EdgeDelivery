import { useEffect, useState } from "react";
import type { ContentItem } from "../api/content";

function useLatency(url: string) {
  const [result, setResult] = useState<{ miss: number; hit: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;

    (async () => {
      try {
        // MISS — bypass cache
        const t1 = performance.now();
        await fetch(url, { cache: "no-store", mode: "no-cors" });
        const miss = Math.round(performance.now() - t1);

        // HIT — served from browser/CDN cache
        const t2 = performance.now();
        await fetch(url, { cache: "force-cache", mode: "no-cors" });
        const hit = Math.round(performance.now() - t2);

        if (active) setResult({ miss, hit });
      } catch {
        // silently skip if CORS blocks the fetch (image still loads via <img>)
      }
    })();

    return () => { active = false; };
  }, [url]);

  return result;
}

export default function ContentCard({ item }: { item: ContentItem }) {
  const [hovered, setHovered] = useState(false);
  const latency = useLatency(item.thumbnail_url);
  const meta = item.poster_metadata as Record<string, string>;

  const src = hovered && item.background_url ? item.background_url : item.thumbnail_url;

  return (
    <div
      className="animate-fade-in"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
              {item.status === "processing" ? "Generating…" : "No image"}
            </span>
          </div>
        )}

        {/* Latency badges */}
        {latency && (
          <div style={{ position: "absolute", bottom: "6px", left: "6px", display: "flex", gap: "4px" }}>
            <span style={{
              fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.75)", color: "var(--miss)", fontFamily: "monospace",
            }}>
              MISS {latency.miss}ms
            </span>
            <span style={{
              fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
              backgroundColor: "rgba(0,0,0,0.75)", color: "var(--hit)", fontFamily: "monospace",
            }}>
              HIT {latency.hit}ms
            </span>
          </div>
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
