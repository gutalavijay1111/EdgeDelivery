import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import UploadModal from "./components/UploadModal";
import Toast, { type ToastData } from "./components/Toast";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import { getContentStatus } from "./api/content";
import type { ContentItem } from "./api/content";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

export default function App() {
  const [showUpload, setShowUpload] = useState(false);
  const [uploadDefaultCountry, setUploadDefaultCountry] = useState("");
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  // Track content IDs being processed in background
  const pollingJobs = useRef<Set<string>>(new Set());
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((message: string, type: ToastData["type"]) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startPolling = useCallback(() => {
    if (pollingInterval.current) return;
    pollingInterval.current = setInterval(async () => {
      if (pollingJobs.current.size === 0) {
        clearInterval(pollingInterval.current!);
        pollingInterval.current = null;
        return;
      }
      for (const contentId of Array.from(pollingJobs.current)) {
        try {
          const { status } = await getContentStatus(contentId);
          if (status === "ready") {
            pollingJobs.current.delete(contentId);
            queryClient.invalidateQueries({ queryKey: ["my-content"] });
            queryClient.invalidateQueries({ queryKey: ["countries"] });
            queryClient.invalidateQueries({ queryKey: ["content"] });
            addToast("Poster ready! Check your uploads.", "success");
          } else if (status === "failed") {
            pollingJobs.current.delete(contentId);
            addToast("Poster generation failed.", "error");
          }
        } catch {
          // silently ignore transient errors
        }
      }
    }, 5000);
  }, [addToast]);

  const handleUploaded = useCallback((contentId: string) => {
    pollingJobs.current.add(contentId);
    addToast("Generating your poster in the background…", "info");
    startPolling();
  }, [addToast, startPolling]);

  useEffect(() => {
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, []);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Navbar onUpload={() => setShowUpload(true)} />

            {showUpload && (
              <UploadModal
                onClose={() => setShowUpload(false)}
                onUploaded={handleUploaded}
                defaultCountry={uploadDefaultCountry}
              />
            )}

            <Toast toasts={toasts} onDismiss={dismissToast} />

            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <HomePage
                    onCardSelect={setSelectedItem}
                    selectedItem={selectedItem}
                    onCloseDetail={() => setSelectedItem(null)}
                  />
                }
              />
              <Route
                path="/explore"
                element={<ExplorePage onCountryChange={setUploadDefaultCountry} />}
              />
              <Route
                path="/explore/:country"
                element={<ExplorePage onCountryChange={setUploadDefaultCountry} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
