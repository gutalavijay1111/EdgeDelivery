# EdgeDelivery — Features

## Auth
- Google OAuth login with JWT-based session management (access + refresh tokens, auto-rotation)

## Image Sourcing
- **File upload** — direct-to-S3 upload via presigned PUT URLs (browser never touches the server for the payload)
- **URL import** — provide any public image URL; backend downloads and stores it in S3
- **Unsplash integration** — fetch a random photo by keyword (or fully random) via the Unsplash API

## Poster Generation
- Celery worker downloads raw image from S3, calls Google Gemini to extract concept, emotion, and title
- Renders a Netflix-style thumbnail + widescreen background using Pillow
- Uploads processed images back to S3 and invalidates the CloudFront cache paths

## Delivery
- Processed posters served via **CloudFront CDN** with `max-age=31536000` cache headers
- CloudFront invalidation triggered after each poster is ready to bust stale edges

## Real-time Status
- URL/Unsplash uploads stream progress via **SSE** (Server-Sent Events) — client polls the DB every 2 s server-side and pushes `{ status, thumbnail_url, background_url }` events
- SSE uses the Fetch API with a `Bearer` token header (bypasses `EventSource`'s lack of custom-header support)
- File uploads and early-closed SSE sessions fall back to **client-side polling** (5 s interval) managed in the background

## Reliability
- Celery tasks retry up to 3 times with **exponential backoff** (60 s → 120 s → 240 s)
- Celery broker: **AWS SQS** in production, **Redis** in local dev
- Content status tracked in PostgreSQL (`pending → processing → ready / failed`)
