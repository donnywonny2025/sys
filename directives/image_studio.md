# Image Studio Generation Directive

**Purpose:** This directive permanently codifies the visual standards, prompt engineering logic, and execution loop for the Dashboard Image Studio. Antigravity must read and apply these rules before generating any image.

## 1. The Execution Loop
- **Strict Adherence:** Image generation is an exclusive "Me (Jeff) -> You (Antigravity)" loop. 
- Hermes is NOT authorized to run image generations unless specifically requested.
- Antigravity will intercept all casual requests (e.g., "draw a cat") and run the `/execution/generate_nano_banana.py` script locally on the command line.
- Do NOT use built-in IDE artifact chat tools for image generation. Images must route silently from the script to the dashboard WebSocket.

## 2. The Working Model (CRITICAL — Updated April 7, 2026)

**Model:** `imagen-4.0-fast-generate-001`  
**Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict`  
**API Key Source:** `~/.hermes/.env` → `GOOGLE_API_KEY`  
**Payload Format:**
```json
{
  "instances": [{"prompt": "<expanded prompt>"}],
  "parameters": {
    "sampleCount": 1,
    "aspectRatio": "16:9",
    "outputOptions": {"mimeType": "image/png"}
  }
}
```
**Response Format:** `resp_data['predictions'][0]['bytesBase64Encoded']`

**Output:** 1408×768 PNG (16:9), ~6 seconds generation time.

**⚠️ DEPRECATED MODELS — DO NOT USE:**
- `nano-banana-pro-preview` — DEAD as of April 2026. Hangs indefinitely on `generateContent`.
- `gemini-2.0-flash` with `responseModalities: ["TEXT", "IMAGE"]` — returns 400, does not support image output.
- `gemini-2.5-flash-image` with `generateContent` — works but returns 1024×1024 square only, no aspect ratio control.

**Available alternatives on this API key (verified April 7, 2026):**
- `imagen-4.0-generate-001` — Higher quality, slower
- `imagen-4.0-ultra-generate-001` — Highest quality, slowest
- `gemini-3-pro-image-preview` — Gemini multimodal, untested
- `gemini-3.1-flash-image-preview` — Gemini multimodal, untested

## 3. Creative & Prompt Expansion Matrix

Whenever Jeff provides a short or casual prompt (e.g., "a fireman cat"), Antigravity MUST autonomously expand it into a professional prompt before executing the script. You must adopt the proven formula:

**The Core Formula:** `[Subject] + [Context/Background] + [Lighting/Mood] + [Camera Settings/Technique]`

**Strict Requirements for Expansion:**
- **Photography Terminology:** Use explicit camera parameters (e.g., "35mm lens, f/1.8 aperture, shallow depth of field" or "cinematic wide-angle landscape, shot on 35mm film").
- **Texture & Realism:** Emphasize physical details to avoid the "digital plastic" AI look (e.g., "realistic pores, raw physical texture, natural imperfections, condensation, film grain").
- **Lighting Dynamics:** Describe light sources precisely (e.g., "golden hour backlighting, soft volumetric window light, dramatic high-contrast moody lighting, neon rim lighting").
- **Aspect Ratio:** The Imagen 4 API natively enforces 16:9 via the `aspectRatio` parameter. Do NOT rely solely on text prompt for aspect ratio.
- **Medium Intent:** Lead with the exact artistic intent (e.g., "A cinematic street photography shot of..." or "A professional close-up portrait of...").

*Example Transformation:*
- **User Says:** "fireman cat"
- **You Execute:** "A professional cinematic street photography wide shot of a sleek black cat in a rugged, highly textured yellow fireman uniform, standing in front of a fire engine. Dramatic high-contrast moody lighting, rain puddles reflecting neon light, 85mm lens, f/2.8 aperture, shallow depth of field, natural imperfections and film grain."

## 4. Dashboard Auto-Push

The script automatically pushes to the dashboard via:
```bash
curl -X POST http://localhost:3111/api/push \
  -H "Content-Type: application/json" \
  -d '{"type":"studio","hero":{"src":"/data/gallery/<filename>","size":"1408x768","aspect":"16:9","prompt":"<prompt>","model":"Imagen 4 Fast"}}'
```

This switches the dashboard to Image Studio and displays the generated image immediately. No manual scene switching required.

## 5. Reference Picture-in-Picture Workflow (Multi-PIP)

The studio supports **multiple simultaneous reference PIP windows**, each with a title bar, minimize, close, and drag.

When Jeff asks to "bring up a reference image" or "find a Google image of X":
1. **Search:** Use `mcp_firecrawl_search` with `{ "sources": [ { "type": "images" } ] }` to locate a high-quality `imageUrl`.
2. **Download:** `curl -o dashboard/data/references/<descriptive_name>.jpg "URL"` — fast, no Python, no scrapers.
3. **Push to PIP (with title):**
```bash
curl -X POST http://localhost:3111/api/push \
  -H "Content-Type: application/json" \
  -d '{"type":"reference","src":"/data/references/<filename>","title":"Source — Description"}'
```
4. **Close all PIPs:** `curl -X POST http://localhost:3111/api/push -H "Content-Type: application/json" -d '{"type":"close_reference"}'`

**PIP Features:**
- **Title bar** — Named from search source (e.g. "Unsplash — Lighthouse on Cliff")
- **Minimize** (▁ button) — Collapses to a `📌 Title` chip at the bottom-left of the canvas
- **Restore** — Click the minimized chip to restore the window
- **Close** (✕ button) — Removes the PIP entirely
- **Drag** — Grab the title bar to reposition anywhere in the viewport
- **Z-ordering** — Click a PIP to bring it to front
- **State persistence** — Server caches all active references as an array; restored on page refresh

## 6. Image Editing Workflow

When Jeff says "edit this", "change X", "add Y to the image", or any modification of the current studio image:

**Script:** `execution/studio.py edit`
**Model:** `gemini-2.5-flash-image` via `generateContent`
**How it works:** Sends the source image (base64) + edit instruction to Gemini, gets back the edited image. Auto-pushes to dashboard.

```bash
python3 execution/studio.py generate '<expanded_prompt>' 'dashboard/data/gallery/<filename>.png'
python3 execution/studio.py edit '<source_image>' '<edit_instruction>' '<output_file>'
```

**Example:**
```bash
python3 execution/studio.py edit \
  dashboard/data/gallery/white_rabbit.png \
  "Put a birthday hat on the rabbit" \
  dashboard/data/gallery/white_rabbit_birthday.png
```

**Rules:**
- Source image is always the current studio hero image (use the most recent file in `dashboard/data/gallery/`)
- Output files follow the naming convention: `<base>_<edit_description>.png`
- Each edit creates a new file — never overwrite the original
- Timeout is 60 seconds (Gemini edits take ~10–15s)

## 7. Operational Rules
- **Never wait > 10 seconds** for generation command status. Fire and check back.
- **Always auto-run** generation commands (`SafeToAutoRun: true`). Jeff should never see permission dialogs for image generation.
- **Never use browser subagents** to interact with the studio. Use the WebSocket API exclusively.
- **Gallery images** are saved to `dashboard/data/gallery/`. Reference images to `dashboard/data/references/`.
- **ALL files stay in the SYSTEM project directory** (`/Volumes/WORK 2TB/WORK 2026/SYSTEM/`). Never save assets to `~/.hermes/`, `/tmp/`, or anywhere outside the project. The only exception is reading API keys from `~/.hermes/.env`.

## 8. File Layout
```
execution/
├── studio.py                  ← unified CLI (generate + edit)
├── generate_nano_banana.py    ← legacy generate (still works)
├── edit_image.py              ← legacy edit (still works)
└── upscale_local.sh           ← 2x upscale
dashboard/data/
├── gallery/                   ← generated + edited images
└── references/                ← real-world reference photos
```
