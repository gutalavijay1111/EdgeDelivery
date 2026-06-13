import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import UploadModal from "./components/UploadModal";
import LoginPage from "./pages/LoginPage";
import ExplorePage from "./pages/ExplorePage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

export default function App() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Navbar onUpload={() => setShowUpload(true)} />
            {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/explore/:country" element={<ExplorePage />} />
              <Route path="*" element={<Navigate to="/explore" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
