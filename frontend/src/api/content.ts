import { api } from "./client";

export interface Country { code: string; name: string; content_count: number }

export interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string;
  background_url: string;
  source: "user" | "wikimedia";
  status: "pending" | "processing" | "ready" | "failed";
  uploaded_by: string | null;
  poster_metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface CountryContent { country: string; country_name: string; content: ContentItem[] }

export const getCountries = () =>
  api.get<Country[]>("/api/explore/").then((r) => r.data);

export const getCountryContent = (code: string) =>
  api.get<CountryContent>(`/api/explore/${code}/`).then((r) => r.data);

export const getPresignedUrl = (filename: string, country: string) =>
  api
    .get<{ content_id: string; upload_url: string; key: string }>(
      `/api/content/upload/presigned/?filename=${encodeURIComponent(filename)}&country=${country}`
    )
    .then((r) => r.data);

export const confirmUpload = (content_id: string) =>
  api.post("/api/content/upload/confirm/", { content_id }).then((r) => r.data);

export const getContentStatus = (content_id: string) =>
  api
    .get<{ id: string; status: string; thumbnail_url: string; background_url: string }>(
      `/api/content/${content_id}/status/`
    )
    .then((r) => r.data);

export const getMyContent = () =>
  api.get<ContentItem[]>("/api/content/my/").then((r) => r.data);

export const fetchFromExternal = (params: {
  country: string;
  source: "url" | "unsplash";
  url?: string;
  unsplash_keyword?: string;
}) =>
  api
    .post<{ content_id: string }>("/api/content/upload/from-url/", params)
    .then((r) => r.data);

export function openContentSSE(
  contentId: string,
  onEvent: (data: { status: string; thumbnail_url?: string; background_url?: string }) => void,
  signal: AbortSignal
): void {
  const token = localStorage.getItem("access");
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? "";

  fetch(`${baseUrl}/api/content/${contentId}/stream/`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
    signal,
  })
    .then(async (response) => {
      if (!response.ok || !response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const msg of messages) {
          for (const line of msg.split("\n")) {
            if (line.startsWith("data: ")) {
              try { onEvent(JSON.parse(line.slice(6))); } catch { /* skip */ }
            }
          }
        }
      }
    })
    .catch(() => { /* aborted or network error — caller handles cleanup */ });
}
