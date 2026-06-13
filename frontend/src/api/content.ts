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
