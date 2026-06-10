# EdgePipeline

A production-inspired static asset delivery platform built on AWS S3, CloudFront, and GitHub Actions — modeled after how Netflix, YouTube, and other large-scale services deliver geo-targeted content from the edge.

The goal is not image hosting itself, but to learn how modern internet-scale systems deliver, cache, invalidate, and publish static assets through automated pipelines and CDN optimization techniques.

---

## Project Checklist

Each item is a concrete, testable learning milestone.


### Challenges Faced

**1. `Route 53 + Private S3 + CloudFront`**
First hosted S3 content via static hosting, connected Custom domain also ttached TLS certificate from AWS Certificate Manager. Connected the domain with the CF distribution. 

**2. `Attaching Edge@Lambda` to CloudFront **
Had to attach the Edge@Lambda under function associations only to viewer-request, while mentioning the ARN to the Lambda(version must be mentioned aswell). Edge@Lambda was a overkill for this usecase, hence moved to a CF function. 

**3. `CloudFront Function runtime` rejects modern JavaScript**
The CF Function runtime (`cloudfront-js-1.0`) is ES5 only — no `const`, `let`, arrow functions, template literals, or destructuring. The function silently failed until the runtime was set correctly and the code was rewritten in ES5.

**4. `CloudFront-Viewer-Country` header never arrived in the CF Function**
This was the core blocker for server-side geo-routing — see the section below.


**5. `Custom cache policy` allowing CloudFront headers**
Created a custom cache policy to allow the headers added by the CloudFront, but was unable to attach to the CF distribution (business plan needed for this)

---

### Why Geo-Routing Moved to the Frontend

**The intended design** was for a CloudFront Function (or Lambda@Edge) running on the `viewer-request` event to read the `CloudFront-Viewer-Country` header and rewrite `/manifest.json` to `/manifest-JP.json`, `/manifest-US.json`, etc. — all at the edge, before CloudFront touches its cache.

**What actually blocked it:**
CloudFront injects geo-enrichment headers (`CloudFront-Viewer-Country`, `CloudFront-Viewer-City`, etc.) into the request, but those headers are only forwarded to a function if the distribution's **cache policy** or **origin request policy** explicitly allows them. Attaching a custom cache or origin request policy to a distribution requires either a paid feature tier or manual policy configuration that isn't available on the free-tier distribution setup. Without the policy attached, the function fires but `request.headers['cloudfront-viewer-country']` is always `null` — the header is stripped before the function ever sees it.

Lambda@Edge has the same constraint: it runs on the viewer-request event, but the geo headers are only visible if the distribution is configured to forward them.

**The fix:**
Move country selection entirely to the browser. On first visit, a modal asks the user to pick a region. The selection is saved to `localStorage`. The page then fetches `manifest-{CC}.json` directly — no server-side rewrite needed. The CF Function is now a pass-through; the `/debug-country` endpoint is kept only to verify what CloudFront *would* detect (useful when testing with a VPN).

This is actually more honest UX too: a user on a VPN in Japan watching US content would have been silently routed to the wrong manifest. Explicit selection is better.


### Phase 1 — Foundation
- [x] S3 static website hosting
- [x] CloudFront distribution wired to S3
- [x] GitHub Actions deploy pipeline on every push to `main`
- [x] `manifest.json` generated at deploy time (no browser AWS credentials)
- [x] Smart invalidation — only `/manifest.json` and `/index.html`, not `/*`
- [x] Immutable cache headers on images (`max-age=31536000,immutable`)
- [x] `no-cache` on manifest so browsers always revalidate

### Phase 2 — Netflix-style Geo-targeted Carousel
- [x] Per-region manifest files (`manifest-JP.json`, `manifest-US.json`, `manifest-IN.json`)
- [x] Lambda@Edge on viewer-request reads `CloudFront-Viewer-Country` header and rewrites manifest URL to correct region file
- [x] Frontend renders horizontal carousel rows: "Trending in Japan", "Trending in the US", etc.
- [x] GitHub Actions generates all regional manifests from `data/<country>/` folders on push
- [x] Test geo-routing with VPN — switch country, see different content served without app changes
- [x] Automated per-region cache invalidation when a region's manifest is updated

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

### Asset Fingerprinting Eliminates Invalidations

```
image.jpg            → cache-busted by filename change
image.a1f2b3c4.jpg   → safe to cache forever; new content = new filename
```

CloudFront invalidations cost $0.005 per path after the first 1000/month. At scale, fingerprinting is cheaper and faster than invalidating.
