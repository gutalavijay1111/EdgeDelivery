import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCountries, getCountryContent } from "../api/content";
import ContentCard from "../components/ContentCard";

export default function ExplorePage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: countries, isLoading: loadingCountries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    staleTime: 30_000,
  });

  const { data: countryData, isLoading: loadingContent } = useQuery({
    queryKey: ["content", selected],
    queryFn: () => getCountryContent(selected!),
    enabled: !!selected,
  });

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Country selector strip */}
      <div
        style={{
          display: "flex", gap: "0.5rem", padding: "1rem 2rem",
          borderBottom: "1px solid var(--border)", overflowX: "auto",
          backgroundColor: "var(--bg)",
        }}
      >
        {loadingCountries && (
          <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading…</span>
        )}
        {countries?.map((c) => (
          <button
            key={c.code}
            onClick={() => setSelected(c.code)}
            style={{
              padding: "0.45rem 1.1rem", borderRadius: "999px", whiteSpace: "nowrap",
              border: "1px solid var(--border)",
              backgroundColor: selected === c.code ? "var(--amber)" : "var(--bg-btn)",
              color: selected === c.code ? "#fff" : "var(--text)",
              cursor: "pointer", fontFamily: "DM Sans", fontSize: "0.88rem",
              transition: "background-color 0.15s, color 0.15s",
            }}
          >
            {c.name}
            <span style={{ marginLeft: "0.4rem", opacity: 0.6, fontSize: "0.8em" }}>
              {c.content_count}
            </span>
          </button>
        ))}
      </div>

      {/* Content grid */}
      <div style={{ padding: "1.5rem 2rem" }}>
        {!selected && (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "1rem" }}>
              Select a country to explore content served from that region's CDN edge.
            </p>
          </div>
        )}

        {selected && loadingContent && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "2/3", borderRadius: "8px",
                  backgroundColor: "var(--border)", animation: "pulse 1.5s ease infinite",
                }}
              />
            ))}
          </div>
        )}

        {countryData && (
          <>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginBottom: "1rem" }}>
              {countryData.content.length} title{countryData.content.length !== 1 ? "s" : ""} from{" "}
              <strong style={{ color: "var(--text)" }}>{countryData.country_name}</strong> —
              images served via CloudFront. Hover a card to see latency difference between a CDN
              cache MISS and HIT.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              {countryData.content.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
            </div>

            {countryData.content.length === 0 && (
              <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "2rem" }}>
                No content yet for this region. Upload an image to get started.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
