# Image Generation Standards

1. **Default Resolution:** All generated images must be **16:9** aspect ratio by default, enforced via the Imagen API `aspectRatio` parameter.
2. **Default Model:** `imagen-4.0-fast-generate-001` via the `predict` endpoint. See `directives/image_studio.md` for full API details.
3. **Supported Resolutions:** Use portrait (9:16) or square (1:1) only if explicitly requested. Pass the ratio via the `aspectRatio` parameter.
4. **Impeccable Quality:** Always expand short prompts into hyper-realistic, highly detailed prompts with studio lighting and camera parameters. See the Prompt Expansion Matrix in `image_studio.md`.
5. **Metadata Tracking:** Generation payloads to the dashboard must include full metadata (Dimensions, Aspect Ratio, Prompt description, Model name) so the gallery accurately logs each asset.
6. **Script:** Always use `execution/generate_nano_banana.py` — it handles generation, file save, AND dashboard auto-push in one call.
7. **Timeout:** API calls have a 30-second timeout. If generation hasn't returned in 30 seconds, it's a dead endpoint — investigate, don't wait.
