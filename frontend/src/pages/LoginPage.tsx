import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { login, register, googleAuth, guestLogin } from "../api/auth";
import { useAuth } from "../contexts/AuthContext";

type Tab = "login" | "register";

const COUNTRIES = [
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "NL", name: "Netherlands" },
  { code: "US", name: "United States" },
];

const field: React.CSSProperties = {
  width: "100%", padding: "0.6rem 0.8rem",
  backgroundColor: "var(--bg-btn)", border: "1px solid var(--border)",
  borderRadius: "6px", color: "var(--text)", fontFamily: "DM Sans", fontSize: "0.9rem",
  outline: "none",
};

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("login");
  const [form, setForm] = useState({ username: "", email: "", password: "", country: "US" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const tokens =
        tab === "login"
          ? await login(form.username, form.password)
          : await register(form);
      setAuth(tokens.access, tokens.refresh);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(msg ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    try {
      const tokens = await googleAuth(credential);
      setAuth(tokens.access, tokens.refresh);
      navigate("/");
    } catch {
      setError("Google sign-in failed");
    }
  };

  const handleGuest = async () => {
    setGuestLoading(true);
    setError("");
    try {
      const tokens = await guestLogin();
      setAuth(tokens.access, tokens.refresh);
      navigate("/");
    } catch {
      setError("Could not start guest session. Please try again.");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: "calc(100vh - 60px)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: "400px",
          backgroundColor: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "12px", padding: "2rem", boxShadow: "var(--shadow-lg)",
        }}
      >
        <h1 style={{ fontFamily: "Bebas Neue", fontSize: "2rem", color: "var(--text)", marginBottom: "0.25rem" }}>
          EdgeDelivery
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginBottom: "1.5rem" }}>
          AI-generated posters • Real-time CDN metrics
        </p>

        {/* Guest CTA */}
        <button
          onClick={handleGuest}
          disabled={guestLoading}
          style={{
            width: "100%", padding: "0.7rem",
            backgroundColor: "transparent",
            border: "1.5px dashed var(--amber)",
            borderRadius: "8px", cursor: guestLoading ? "wait" : "pointer",
            color: "var(--amber)", fontFamily: "DM Sans", fontSize: "0.9rem",
            fontWeight: 600, marginBottom: "1.5rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(221,161,94,0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          {guestLoading ? (
            <>
              <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--amber)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
              Creating your guest session…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8S4.41 14.5 8 14.5 14.5 11.59 14.5 8 11.59 1.5 8 1.5zm0 2a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 9c-2 0-3.75-1.02-4.75-2.56C3.27 8.63 6.5 7.75 8 7.75s4.73.88 4.75 2.19C11.75 11.48 10 12.5 8 12.5z" fill="currentColor" />
              </svg>
              Try as Guest — no account needed
            </>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>or sign in</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["login", "register"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "0.5rem",
                backgroundColor: tab === t ? "var(--amber)" : "var(--bg-btn)",
                color: tab === t ? "#fff" : "var(--text-muted)",
                border: "1px solid var(--border)", borderRadius: "6px",
                cursor: "pointer", fontFamily: "DM Sans", fontSize: "0.9rem", fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {t === "login" ? "Sign in" : "Register"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <input
            placeholder="Username"
            value={form.username}
            onChange={set("username")}
            required
            style={field}
          />
          {tab === "register" && (
            <>
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={set("email")}
                required
                style={field}
              />
              <select value={form.country} onChange={set("country")} style={field}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </>
          )}
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
            style={field}
          />

          {error && (
            <p style={{ color: "var(--miss)", fontSize: "0.8rem" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.65rem", backgroundColor: "var(--amber)", color: "#fff",
              border: "none", borderRadius: "6px", cursor: "pointer",
              fontFamily: "DM Sans", fontSize: "0.95rem", fontWeight: 600,
            }}
          >
            {loading ? "…" : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ margin: "1.25rem 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>or</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "var(--border)" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <GoogleLogin
            onSuccess={(res) => res.credential && handleGoogle(res.credential)}
            onError={() => setError("Google sign-in failed")}
            theme="filled_black"
            shape="pill"
            text={tab === "login" ? "signin_with" : "signup_with"}
          />
        </div>
      </div>
    </div>
  );
}
