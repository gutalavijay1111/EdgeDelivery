import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyContent } from "../api/content";
import type { ContentItem } from "../api/content";
import { useAuth } from "../contexts/AuthContext";
import ContentCard from "../components/ContentCard";
import ContentDetailModal from "../components/ContentDetailModal";
import { useState } from "react";

interface Props {
  onCardSelect: (item: ContentItem) => void;
  selectedItem: ContentItem | null;
  onCloseDetail: () => void;
}

export default function HomePage({ onCardSelect, selectedItem, onCloseDetail }: Props) {
  const { token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["my-content"],
    queryFn: getMyContent,
    enabled: !!token,
    // Poll while any item is still processing
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasProcessing = data.some(
        (i) => i.status === "pending" || i.status === "processing"
      );
      return hasProcessing ? 5000 : false;
    },
  });

  if (!token) return null;

  const processing = items?.filter((i) => i.status === "pending" || i.status === "processing") ?? [];
  const ready = items?.filter((i) => i.status === "ready") ?? [];
  const failed = items?.filter((i) => i.status === "failed") ?? [];

  return (
    <div style={{ minHeight: "calc(100vh - 60px)", padding: "1.5rem 2rem" }}>
      {isLoading && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1rem",
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              aspectRatio: "2/3", borderRadius: "8px",
              backgroundColor: "var(--border)", animation: "pulse 1.5s ease infinite",
            }} />
          ))}
        </div>
      )}

      {!isLoading && items?.length === 0 && (
        <div style={{ textAlign: "center", padding: "6rem 0" }}>
          <p style={{ fontFamily: "Bebas Neue", fontSize: "2rem", color: "var(--text)", marginBottom: "0.5rem" }}>
            No uploads yet
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
            Click <strong>+ Upload</strong> to generate your first Netflix-style poster.
          </p>
        </div>
      )}

      {processing.length > 0 && (
        <Section title="Generating">
          {processing.map((item) => (
            <ContentCard key={item.id} item={item} onClick={onCardSelect} />
          ))}
        </Section>
      )}

      {ready.length > 0 && (
        <Section title="My Posters">
          {ready.map((item) => (
            <ContentCard key={item.id} item={item} onClick={onCardSelect} />
          ))}
        </Section>
      )}

      {failed.length > 0 && (
        <Section title="Failed">
          {failed.map((item) => (
            <ContentCard key={item.id} item={item} onClick={onCardSelect} />
          ))}
        </Section>
      )}

      {selectedItem && (
        <ContentDetailModal item={selectedItem} onClose={onCloseDetail} />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{
        fontFamily: "Bebas Neue", fontSize: "1.2rem", color: "var(--text-muted)",
        letterSpacing: "0.08em", marginBottom: "1rem",
      }}>
        {title}
      </h2>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "1rem",
      }}>
        {children}
      </div>
    </div>
  );
}
