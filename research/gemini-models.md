# Gemini API — Complete Model & Pricing Reference

> **Last Updated:** 2026-04-07 (scraped from official docs)  
> **API Key:** `AIzaSyDeaDQNsaRBcBv54RHkOCGiuUONFdyJGAw`  
> **Project:** `projects/493315853766`  
> **Config Location:** `~/.openclaw/openclaw.json`  
> **Auth Method:** OAuth via Google account + API key fallback  
> **Default Model:** `google/gemini-2.5-flash`  
> **Current Tier:** Paid (Tier 1, pay-as-you-go)

---

## 💰 Complete Pricing — All Text/Chat Models (Standard Tier)

| Model | Input /1M tokens | Output /1M tokens | Free Tier? | Best For |
|-------|-------------------|---------------------|------------|----------|
| **Gemini 3.1 Pro Preview** ⭐ | $2.00 (≤200K), $4.00 (>200K) | $12.00 (≤200K), $18.00 (>200K) | ❌ No | Agentic, vibe-coding, complex reasoning |
| **Gemini 3.1 Flash-Lite Preview** | $0.25 | $1.50 | ✅ Yes | High-volume agentic, translation, data processing |
| **Gemini 3 Flash Preview** | $0.50 | $3.00 | ✅ Yes | Frontier intelligence + speed + search |
| **Gemini 2.5 Pro** | $1.25 (≤200K), $2.50 (>200K) | $10.00 (≤200K), $15.00 (>200K) | ✅ Yes | Deep reasoning, complex coding |
| **Gemini 2.5 Flash** ⭐ (current) | $0.30 | $2.50 | ✅ Yes | Our workhorse — fast, cheap, thinking |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | ✅ Yes | Ultra-cheap at scale |
| **Gemini 2.0 Flash** | $0.10 | $0.40 | ✅ Yes | Previous gen workhorse |
| **Gemini 2.0 Flash-Lite** | $0.075 | $0.30 | ✅ Yes | Cheapest model available |

### Batch API (50% discount on Standard)
| Model | Input /1M | Output /1M |
|-------|-----------|------------|
| 3.1 Pro Preview | $1.00 | $6.00 |
| 3.1 Flash-Lite | $0.125 | $0.75 |
| 3 Flash Preview | $0.25 | $1.50 |
| 2.5 Pro | $0.625 | $5.00 |
| 2.5 Flash | $0.15 | $1.25 |
| 2.5 Flash-Lite | $0.05 | $0.20 |

---

## 🖼️ Image Generation Pricing

| Model | Price per Image |
|-------|----------------|
| **Imagen 4 Fast** | $0.02/image |
| **Imagen 4 Standard** | $0.04/image |
| **Imagen 4 Ultra** | $0.06/image |
| **Gemini 2.5 Flash Image** 🍌 | $0.039/image (1K) |
| **Gemini 3.1 Flash Image** 🍌 | $0.045 (0.5K), $0.067 (1K), $0.101 (2K), $0.151 (4K) |
| **Gemini 3 Pro Image** 🍌 | $0.134 (1K/2K), $0.24 (4K) |

---

## 🎬 Video Generation Pricing

| Model | Price per Second |
|-------|-----------------|
| **Veo 3.1 Lite** | $0.05 (720p), $0.08 (1080p) |
| **Veo 3.1 Fast** | $0.10 (720p), $0.12 (1080p), $0.30 (4K) |
| **Veo 3.1 Standard** | $0.40 (720p/1080p), $0.60 (4K) |
| **Veo 3 Fast** | $0.10 (720p), $0.12 (1080p), $0.30 (4K) |
| **Veo 3 Standard** | $0.40 |
| **Veo 2** | $0.35 |

---

## 🎵 Music Pricing

| Model | Price |
|-------|-------|
| **Lyria 3 Clip** (30s) | $0.04/song |
| **Lyria 3 Pro** (full song) | $0.08/song |

---

## 🗣️ TTS / Voice Pricing

| Model | Input /1M | Output /1M audio |
|-------|-----------|-----------------|
| **2.5 Flash TTS** | $0.50 | $10.00 |
| **2.5 Pro TTS** | $1.00 | $20.00 |
| **2.5 Flash Native Audio (Live)** | $0.50 (text), $3.00 (audio) | $2.00 (text), $12.00 (audio) |
| **3.1 Flash Live** | $0.75 (text), $3.00 (audio) | $4.50 (text), $12.00 (audio) |

---

## 🤖 Specialized / Agent Models

| Model | Input /1M | Output /1M | Notes |
|-------|-----------|------------|-------|
| **Computer Use** | $1.25 (≤200K) | $10.00 (≤200K) | Browser automation — sees screen, clicks |
| **Deep Research** | 3 Pro rates | 3 Pro rates | Autonomous multi-step research agent |
| **Robotics-ER 1.5** | $0.30 | $2.50 | Embodied reasoning for physical robots |
| **Gemma 4** | Free | Free | Open-source, free to run |

---

## 📊 Embeddings

| Model | Price |
|-------|-------|
| **Gemini Embedding** | $0.15/1M tokens |
| **Gemini Embedding 2** (multimodal) | $0.20/1M text, $0.45/1M images |

---

## 🔧 Tool Pricing

| Tool | Free Tier | Paid Tier |
|------|-----------|-----------|
| **Google Search grounding** | 500 RPD (Flash/Lite shared) | Gemini 3: 5K/month free, then $14/1K queries. Gemini 2.5: 1.5K RPD free, then $35/1K |
| **Google Maps grounding** | 500 RPD | 1.5K RPD free (10K for Pro), then $25/1K |
| **Code execution** | Free | Standard token rates |
| **URL context** | Free | Input token rates |
| **File search** | Free | $0.15/1M embedding + retrieval tokens |

---

## 📈 Rate Limits (Tier 1 — Your Tier)

| Model | RPM | TPM | RPD |
|-------|-----|-----|-----|
| Gemini 2.5 Flash ⭐ | 150 | 1,000,000 | 10,000 |
| Gemini 2.5 Flash-Lite | 300 | 1,000,000 | 14,400 |
| Gemini 2.5 Pro | 150 | 1,000,000 | 10,000 |
| Gemini 3.1 Pro Preview | 150 | 1,000,000 | 10,000 |
| Gemini 3 Flash Preview | 150 | 1,000,000 | 10,000 |
| Gemini 3.1 Flash-Lite Preview | 300 | 1,000,000 | 14,400 |
| TTS models | 30 | 100,000 | 1,500 |

> **RPM** = Requests/Min · **TPM** = Tokens/Min · **RPD** = Requests/Day (resets midnight PT)

---

## 💡 Strategy: When to Use What

| Task | Best Model | Cost | Why |
|------|-----------|------|-----|
| Cron jobs (mail, weather) | 2.5 Flash or 2.0 Flash-Lite | $0.075-0.30/M | Cheapest, fast enough |
| Chat with Jeff | 2.5 Flash | $0.30/M in | Good reasoning, fast |
| Complex research | 3.1 Pro Preview or 2.5 Pro | $1.25-2.00/M | Best intelligence |
| Image generation | Imagen 4 Fast | $0.02/img | Cheapest images |
| Image editing | 2.5 Flash Image 🍌 | $0.039/img | Native edit + gen |
| High-quality images | 3 Pro Image 🍌 | $0.134/img | 4K studio quality |
| Quick video | Veo 3.1 Lite | $0.05/sec | Budget video |
| Production video | Veo 3.1 Standard | $0.40/sec | Cinematic + audio |
| Music | Lyria 3 Clip | $0.04/song | 30s jingles |
| Voice/TTS | 2.5 Flash TTS | $0.50/M in | Fast, natural |
| Browser automation | Computer Use | $1.25/M | Automate web tasks |
| Embeddings/search | Embedding 2 | $0.20/M | Semantic search |

---

## 💸 Cost Estimate (Current Daily Usage)

| Activity | Freq | Daily Cost |
|----------|------|------------|
| Mail cron (2.5 Flash) | every 5 min | ~$0.02 |
| Calendar cron | every 15 min | ~$0.006 |
| Weather cron (2.5 Flash) | every 30 min | ~$0.002 |
| Chat (10 turns) | ad hoc | ~$0.003 |
| **Total** | | **~$0.03/day ≈ $1/month** |

---

## 📁 Architecture Notes

- **Config:** `~/.openclaw/openclaw.json`
- **Sessions:** `~/.openclaw/agents/main/sessions/`
- **Cron:** `~/.openclaw/cron/`
- **Gateway:** port 18789
- **Dashboard:** port 3111
