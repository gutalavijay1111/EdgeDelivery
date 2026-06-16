import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCountries, getCountryContent } from "../api/content";
import type { ContentItem } from "../api/content";
import ContentCard from "../components/ContentCard";
import ContentDetailModal from "../components/ContentDetailModal";

interface Props {
  onCountryChange?: (code: string) => void;
}

export default function ExplorePage({ onCountryChange }: Props) {
  const [selected, setSelected] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  const { data: countries, isLoading: loadingCountries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    staleTime: 30_000,
  });

  const { data: countryData, isLoading: loadingContent } = useQuery({
    queryKey: ["content", selected],
    queryFn: () => getCountryContent(selected),
    enabled: !!selected,
  });

  const handleCountryChange = (code: string) => {
    setSelected(code);
    onCountryChange?.(code);
  };

  return (
    <div style={{ minHeight: "calc(100vh - 60px)" }}>
      {/* Country selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem 2rem",
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg)",
        }}
      >
        <label style={{ color: "var(--text-muted)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
          Region
        </label>
        <select
          value={selected}
          onChange={(e) => handleCountryChange(e.target.value)}
          disabled={loadingCountries}
          style={{
            padding: "0.45rem 0.75rem",
            backgroundColor: "var(--bg-btn)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            fontFamily: "DM Sans",
            fontSize: "0.9rem",
            cursor: "pointer",
            minWidth: "200px",
          }}
        >
          <option value="">Select a region…</option>
          {countries?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} ({c.content_count})
            </option>
          ))}
        </select>

        {selected && countryData && (
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            {countryData.content.length} poster{countryData.content.length !== 1 ? "s" : ""} · images via CloudFront CDN
          </span>
        )}
      </div>

      {/* Content grid */}
      <div style={{ padding: "1.5rem 2rem" }}>
        {!selected && !loadingCountries && (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <p style={{ fontFamily: "Bebas Neue", fontSize: "1.8rem", color: "var(--text)", marginBottom: "0.5rem" }}>
              Pick a region
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
              Hover a card to see CDN edge latency vs browser cache.
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
            {countryData.content.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", marginTop: "2rem" }}>
                No content yet for this region. Upload an image to get started.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}>
                {countryData.content.map((item) => (
                  <ContentCard key={item.id} item={item} onClick={setSelectedItem} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedItem && (
        <ContentDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
