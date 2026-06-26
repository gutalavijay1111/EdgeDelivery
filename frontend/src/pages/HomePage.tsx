import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteContent, getMyContent } from "../api/content";
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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["my-content"],
    queryFn: getMyContent,
    enabled: !!token,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return data.some((i) => i.status === "pending" || i.status === "processing") ? 5000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteContent,
    onSuccess: (_, contentId) => {
      queryClient.setQueryData<ContentItem[]>(["my-content"], (old) =>
        old?.filter((i) => i.id !== contentId) ?? []
      );
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
            <ContentCard
              key={item.id}
              item={item}
              onClick={onCardSelect}
              onDelete={() => deleteMutation.mutate(item.id)}
            />
          ))}
        </Section>
      )}

      {/* Failed items — compact rows, not full cards */}
      {failed.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{
            fontFamily: "Bebas Neue", fontSize: "1.2rem", color: "var(--text-muted)",
            letterSpacing: "0.08em", marginBottom: "0.75rem",
          }}>
            Failed ({failed.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {failed.map((item) => (
              <FailedRow
                key={item.id}
                item={item}
                onDelete={() => deleteMutation.mutate(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedItem && (
        <ContentDetailModal item={selectedItem} onClose={onCloseDetail} />
      )}
    </div>
  );
}

function FailedRow({ item, onDelete }: { item: ContentItem; onDelete: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.75rem",
      padding: "0.5rem 0.75rem",
      backgroundColor: "rgba(192,98,42,0.05)",
      border: "1px solid rgba(192,98,42,0.18)",
      borderRadius: "6px",
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
        <circle cx="7" cy="7" r="6" stroke="var(--miss)" strokeWidth="1.2" />
        <path d="M4.5 4.5L9.5 9.5M9.5 4.5L4.5 9.5" stroke="var(--miss)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span style={{ flex: 1, color: "var(--text-muted)", fontSize: "0.82rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.title || "Untitled"} — generation failed
      </span>
      <button
        onClick={onDelete}
        style={{
          background: "none", border: "1px solid rgba(192,98,42,0.3)",
          borderRadius: "4px", padding: "0.2rem 0.6rem",
          color: "var(--miss)", fontSize: "0.75rem", cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Delete
      </button>
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
