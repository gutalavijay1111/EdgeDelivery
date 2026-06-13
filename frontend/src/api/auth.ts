import { api } from "./client";

export interface TokenPair { access: string; refresh: string }
export interface UserProfile {
  id: number; username: string; email: string; country: string; avatar_url: string;
}

export const register = (data: {
  username: string; email: string; password: string; country: string;
}) => api.post<TokenPair>("/api/auth/register/", data).then((r) => r.data);

export const login = (username: string, password: string) =>
  api.post<TokenPair>("/api/auth/login/", { username, password }).then((r) => r.data);

export const googleAuth = (credential: string) =>
  api.post<TokenPair & { created: boolean }>("/api/auth/google/", { credential }).then((r) => r.data);

export const getMe = () =>
  api.get<UserProfile>("/api/auth/me/").then((r) => r.data);

export const updateMe = (data: Partial<UserProfile>) =>
  api.patch<UserProfile>("/api/auth/me/", data).then((r) => r.data);
