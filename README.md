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
