import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const CDN = import.meta.env.VITE_CDN_DOMAIN ? `https://${import.meta.env.VITE_CDN_DOMAIN}` : "";

export default function Navbar({ onUpload }: { onUpload: () => void }) {
  const { user, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark"
  );
  const [logoError, setLogoError] = useState(false);

  const toggleTheme = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setDark(!dark);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 2rem",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--bg)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Logo + nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <button
          onClick={() => navigate(user ? "/" : "/login")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          {CDN && !logoError ? (
            <img
              src={`${CDN}/assets/logo.png`}
              alt="EdgeDelivery"
              style={{ height: "32px" }}
              onError={() => setLogoError(true)}
            />
          ) : (
            <span style={{ fontFamily: "Bebas Neue", fontSize: "1.5rem", color: "var(--text)" }}>
              EDGE
            </span>
          )}
        </button>

        {user && (
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <NavLink to="/" end style={({ isActive }) => navLinkStyle(isActive)} data-tutorial="my-uploads">
              My Uploads
            </NavLink>
            <NavLink to="/explore" style={({ isActive }) => navLinkStyle(isActive)} data-tutorial="explore">
              Explore
            </NavLink>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          onClick={toggleTheme}
          style={{
            background: "var(--bg-btn)", border: "1px solid var(--border)",
            borderRadius: "6px", padding: "0.4rem 0.75rem", cursor: "pointer",
            color: "var(--text-muted)", fontSize: "0.85rem",
          }}
        >
          {dark ? "☀ Light" : "☾ Dark"}
        </button>

        {user ? (
          <>
            <button
              data-tutorial="upload"
              onClick={onUpload}
              style={{
                backgroundColor: "var(--amber)", color: "#fff",
                border: "none", borderRadius: "6px",
                padding: "0.4rem 1rem", cursor: "pointer", fontSize: "0.9rem",
              }}
            >
              + Upload
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover", backgroundColor: "var(--border)" }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1 }}>{user.username}</span>
                {isGuest && (
                  <span style={{
                    fontSize: "0.6rem", color: "var(--amber)",
                    fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase",
                    lineHeight: 1,
                  }}>
                    guest
                  </span>
                )}
              </div>
            </div>

            {isGuest ? (
              <button
                onClick={() => navigate("/login")}
                style={{
                  backgroundColor: "var(--amber)", color: "#fff",
                  border: "none", borderRadius: "6px",
                  padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
                }}
              >
                Create Account
              </button>
            ) : (
              <button
                onClick={handleLogout}
                style={{
                  background: "none", border: "1px solid var(--border)",
                  borderRadius: "6px", padding: "0.4rem 0.75rem", cursor: "pointer",
                  color: "var(--text-muted)", fontSize: "0.85rem",
                }}
              >
                Logout
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => navigate("/login")}
            style={{
              backgroundColor: "var(--amber)", color: "#fff",
              border: "none", borderRadius: "6px",
              padding: "0.4rem 1rem", cursor: "pointer", fontSize: "0.9rem",
            }}
          >
            Sign in
          </button>
        )}
      </div>
    </nav>
  );
}

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.88rem",
    fontFamily: "DM Sans",
    fontWeight: isActive ? 600 : 400,
    color: isActive ? "var(--text)" : "var(--text-muted)",
    backgroundColor: isActive ? "var(--bg-btn)" : "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
    transition: "color 0.15s, background-color 0.15s",
  };
}
