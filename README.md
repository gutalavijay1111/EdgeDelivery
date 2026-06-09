# EdgePipeline

A production-inspired static asset delivery platform built on AWS S3, CloudFront, and GitHub Actions — modeled after how Netflix, YouTube, and other large-scale services deliver geo-targeted content from the edge.

The goal is not image hosting itself, but to learn how modern internet-scale systems deliver, cache, invalidate, and publish static assets through automated pipelines and CDN optimization techniques.

---

## Project Checklist

Each item is a concrete, testable learning milestone.

### Phase 1 — Foundation
- [ ] S3 static website hosting
- [ ] CloudFront distribution wired to S3
- [ ] GitHub Actions deploy pipeline on every push to `main`
- [ ] `manifest.json` generated at deploy time (no browser AWS credentials)
- [ ] Smart invalidation — only `/manifest.json` and `/index.html`, not `/*`
- [ ] Immutable cache headers on images (`max-age=31536000,immutable`)
- [ ] `no-cache` on manifest so browsers always revalidate

### Phase 2 — Netflix-style Geo-targeted Carousel
- [ ] Per-region manifest files (`manifest-JP.json`, `manifest-US.json`, `manifest-IN.json`)
- [ ] Lambda@Edge on viewer-request reads `CloudFront-Viewer-Country` header and rewrites manifest URL to correct region file
- [ ] Frontend renders horizontal carousel rows: "Trending in Japan", "Trending in the US", etc.
- [ ] GitHub Actions generates all regional manifests from `data/<country>/` folders on push
- [ ] Automated per-region cache invalidation when a region's manifest is updated
- [ ] Test geo-routing with VPN — switch country, see different content served without app changes

### Phase 3 — Edge Caching Experiments
- [ ] Short TTL on carousel images (`s-maxage=300`) — cache at edge for 5 min, then re-fetch from origin; observe HIT → MISS → HIT cycle
- [ ] Show `X-Cache` response header in the UI (`Hit from cloudfront` vs `Miss from cloudfront`)
- [ ] Show `X-Amz-Cf-Pop` header — identify which CloudFront edge PoP (Point of Presence) served the response
- [ ] Compare HIT latency vs MISS latency in DevTools Network tab — quantify the CDN speed benefit
- [ ] Swap from `no-cache` to `s-maxage=60` on manifest — observe stale-while-revalidate behavior
- [ ] CloudFront Function (not Lambda) for lightweight header injection at edge with zero cold start

### Phase 4 — GitHub Actions Advanced Deployments
- [ ] Multi-environment deploy: `push` to `dev` branch deploys to staging S3 bucket; `push` to `main` requires manual approval gate before prod
- [ ] Deploy preview per PR — each PR gets its own S3 prefix + CloudFront path, posted as a PR comment
- [ ] Rollback workflow — `workflow_dispatch` input accepts a commit SHA, restores that S3 snapshot
- [ ] GitHub Actions job summary — post deploy stats (files changed, invalidation ID, CloudFront URL) to the workflow run summary page
- [ ] CI cache for Python dependencies to speed up workflow

### Phase 5 — Observability
- [ ] Enable CloudFront standard access logs → write to a separate S3 bucket
- [ ] Query logs with Amazon Athena — "which images are served most?", "which regions generate the most traffic?"
- [ ] Add CloudWatch metric alarms for 5xx error rate and cache hit ratio drop
- [ ] Deploy timing dashboard in GitHub Actions — graph deploy duration over time

### Phase 6 — Security & Production Hardening
- [ ] Lock S3 bucket — remove public access, serve exclusively through CloudFront Origin Access Control (OAC)
- [ ] Custom domain + free SSL via AWS Certificate Manager (ACM)
- [ ] AWS WAF with rate-limiting rule in front of CloudFront (e.g., block IPs exceeding 1000 req/min)
- [ ] Signed CloudFront URLs — simulate a "premium" image section that requires a short-lived signed token
- [ ] Custom 404 error page (`404.html`) served from CDN instead of the S3 XML error response
- [ ] S3 versioning — every deploy keeps prior versions for safe rollback

### Phase 7 — Performance Deep Dives
- [ ] Asset fingerprinting — rename `image.jpg` → `image.a1f2b3.jpg` at deploy time; zero invalidations needed since URL changes on content change
- [ ] Enable HTTP/3 (QUIC) on the CloudFront distribution — test with Chrome DevTools Protocol panel
- [ ] Origin Shield — add a regional aggregation layer to reduce requests hitting S3 origin; measure cache hit ratio improvement
- [ ] Brotli vs Gzip compression — enable compression on CloudFront, inspect `Content-Encoding` header, compare transfer sizes

---

## Overview

EdgePipeline automatically:

- Publishes static assets to S3
- Generates searchable metadata manifests
- Synchronizes content through GitHub Actions
- Delivers content globally through CloudFront
- Optimizes cache behavior for immutable assets
- Minimizes cache invalidation costs
- Provides a lightweight frontend for browsing assets

The project demonstrates several real-world engineering concepts commonly used in high-scale production systems.

---

## Architecture

```text
Developer
    │
    ▼
GitHub Repository
    │
    ▼
GitHub Actions
    │
    ├── Generate manifest.json
    │
    ├── Upload assets to S3
    │
    └── Trigger CloudFront invalidation
    │
    ▼
Amazon S3
    │
    ▼
CloudFront CDN
    │
    ▼
End Users
```

---

## Key Engineering Concepts

### Static Site Hosting

The frontend is hosted entirely from S3 and distributed globally through CloudFront.

### Metadata Indexing

Rather than querying S3 from the browser, a deployment step generates:

```json
{
  "generated_at": "...",
  "images": [...]
}
```

This avoids:

- Browser AWS credentials
- CORS complexity
- Direct S3 listing operations

### CDN Optimization

Images are treated as immutable assets.

```http
Cache-Control:
public,max-age=31536000,immutable
```

The manifest receives:

```http
Cache-Control:
no-cache
```

This allows CloudFront to refresh metadata while keeping image assets cached.

### Automated Deployment

Every push to the main branch automatically:

1. Generates metadata
2. Syncs files to S3
3. Invalidates CloudFront cache
4. Publishes globally

---

## Repository Structure

```text
.
├── data/
│   ├── image1.jpg
│   ├── image2.jpg
│   └── ...
│
├── index.html
├── manifest.json
├── generate_manifest.py
│
├── .github/
│   └── workflows/
│       └── deploy.yml
│
└── README.md
```

---

## Deployment Workflow

```text
git push
   │
   ▼
GitHub Actions
   │
   ▼
Generate Manifest
   │
   ▼
S3 Sync
   │
   ▼
CloudFront Invalidation
   │
   ▼
Global Availability
```

---

## Concept Reference

### Why Lambda@Edge for Geo-routing?

CloudFront attaches a `CloudFront-Viewer-Country` header (ISO 3166-1 alpha-2 code) to every request. A Lambda@Edge function running on the viewer-request event can rewrite the request URL before CloudFront checks its cache:

```
GET /manifest.json
CloudFront-Viewer-Country: JP
→ Lambda@Edge rewrites to /manifest-JP.json
```

No app-server round-trip. The rewrite happens at the edge node closest to the user.

### Why CloudFront Functions vs Lambda@Edge?

| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| Runtime | JS (ES5) | Node / Python |
| Trigger | viewer-request / viewer-response only | All 4 events |
| Latency | ~1ms | ~1ms + cold start |
| Cost | ~1/6th the price | Standard Lambda pricing |
| Use for | Header injection, simple URL rewrites | Complex logic, geo-routing, auth |

### Cache TTL Mental Model

```
Cache-Control: no-cache          → browser must revalidate every time
Cache-Control: s-maxage=300      → CDN edge caches for 5 min, browser uses CDN
Cache-Control: max-age=31536000,immutable → cached for 1 year, never revalidated
```

`s-maxage` controls the CDN. `max-age` controls the browser. Using both lets you cache long at the CDN while keeping the browser fresh.

### Asset Fingerprinting Eliminates Invalidations

```
image.jpg            → cache-busted by filename change
image.a1f2b3c4.jpg   → safe to cache forever; new content = new filename
```

CloudFront invalidations cost $0.005 per path after the first 1000/month. At scale, fingerprinting is cheaper and faster than invalidating.
