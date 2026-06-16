import { useEffect } from "react";

export interface ToastData {
  id: string;
  message: string;
  type: "info" | "success" | "error";
}

interface Props {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: Props) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        zIndex: 100,
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.type !== "info") {
      const timer = setTimeout(() => onDismiss(toast.id), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.type, onDismiss]);

  const colors: Record<ToastData["type"], string> = {
    info: "var(--amber)",
    success: "var(--hit)",
    error: "var(--miss)",
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        backgroundColor: "var(--bg-card)",
        border: `1px solid ${colors[toast.type]}`,
        borderLeft: `4px solid ${colors[toast.type]}`,
        borderRadius: "8px",
        boxShadow: "var(--shadow-lg)",
        minWidth: "280px",
        maxWidth: "360px",
      }}
    >
      <span style={{ color: "var(--text)", fontSize: "0.9rem", flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}
