import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, type UserProfile } from "../api/auth";

interface AuthCtx {
  token: string | null;
  user: UserProfile | null;
  isGuest: boolean;
  login: (access: string, refresh: string) => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("access"));
  const [user, setUser] = useState<UserProfile | null>(null);

  const login = (access: string, refresh: string) => {
    localStorage.setItem("access", access);
    localStorage.setItem("refresh", refresh);
    setToken(access);
  };

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    if (token) {
      getMe().then(setUser).catch(logout);
    }
  }, [token]);

  return (
    <Ctx.Provider value={{ token, user, isGuest: user?.is_guest ?? false, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
