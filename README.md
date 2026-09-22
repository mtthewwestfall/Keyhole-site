# Keyhole — Companion Web Experience & Master Prompt Rules

Keyhole is a web application and companion project providing private experience landing pages and AI companion video prompt configurations.

## Repository Contents

- `index.html`: Landing page for Keyhole and Bailey companion experience.
- `Dockerfile`: Nginx container configuration for serving the static site.
- `MASTER_PROMPT.md` / `master_prompt.txt`: Video generation master prompt rules for multi-angle room references and locked primary webcam views.
- `assets/`: Reference room images (`IMG_3363.jpeg`, `IMG_3364.jpeg`).

## Master Prompt Guidelines Summary

1. **Unified Physical Room**: Treat all multi-angle reference images as views of ONE permanent room to establish accurate 3D geometry and object consistency.
2. **Locked Camera View**: Rendered video clips must remain strictly locked to the designated **PRIMARY WEBCAM VIEW** without cutting to alternate reference angles.
3. **Consistency Maintenance**: Secondary reference views exist solely to ensure walls, furniture, lighting, and decorative objects remain completely consistent across clips.

## Running Locally

To build and run with Docker:

```bash
docker build -t keyhole-web .
docker run -p 8080:80 keyhole-web
```

## Tagline Scout (admin)

Admin tab **Tagline Scout** scans a curated list of cam-platform marketing URLs for tagline / slogan / hero copy via a server-side proxy (no client-side crawl).

- **UI:** `admin.html` → Tagline Scout tab (preset URLs editable; saved in `localStorage`)
- **API:** `POST /.netlify/functions/tagline-search` with `{ query?: string, urls: string[] }`
- **Implementation:** `netlify/functions/tagline-search.js`

### Deploy paths

| Host | How Tagline Scout runs |
|------|------------------------|
| **Railway (primary)** — Docker/nginx | Node sidecar started by `scripts/docker-start.sh`; nginx proxies `/.netlify/functions/tagline-search` → `127.0.0.1:3456` |
| **Netlify** (if used) | Native Netlify Function from `netlify/functions/tagline-search.js` |

### Local testing

```bash
# Smoke-test fetch+parse against public cam marketing pages (≥2 URLs)
node tests/smoke-tagline-search.js

# Local sidecar (then open admin.html via any static server)
node scripts/tagline-search-server.js
# POST http://127.0.0.1:3456/.netlify/functions/tagline-search

# Or Netlify CLI
npx netlify functions:serve
```

Default example presets: Chaturbate, Flirt4Free, Stripchat, BongaCams, CamSoda, LiveJasmin (editable; bot-blocking sites fail per-URL without failing the whole request).

## Dual-skin stage recorder

Stage Control records the stage feed (webcam or plate/media) and composites **exactly two** region skins:

1. **Face + hair** (Skin 1) — upper elliptical crop only
2. **Breasts** (Skin 2) — mid-chest oval only

No torso, legs, or full-body overlays. Uses existing Chloe/Bailey skin photos under `assets/`.

