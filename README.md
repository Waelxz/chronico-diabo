# Chronico · Diabo

> Empathetic AI companion for diabetic patients (FR / AR). Built as the M1 Big Data UGC + Mobile Marketing project at IHEC, May 2026.

Diabo is the diabetes member of the **Chronico** family of empathetic AI companions for chronic conditions. It combines a **Rive-animated avatar** that reacts to your emotional state, an **emotion-aware LLM chat** with retrieval-augmented diabetes knowledge, and recommendation modules for restaurants, hotels, and travel — all tuned for the Maghreb francophone audience.

## Why this exists

The pitch and brief that frame the project:
- `docs/cahier-des-charges.pdf` — the academic requirements (NLP + LLM + Empathy mandatory).
- `docs/project-pitch.pdf` — market analysis, personas, positioning.

What 33 604 reviews of competing apps revealed (full analysis in `notebooks/`): **empathy is the most positively-rated feature** across health apps (sentiment +0.51) and the **most absent** in diabetes apps. Diabo is built around that gap.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript strict + React 19.2 |
| Styling | Tailwind 4 + shadcn/ui (sprint 1) |
| Avatar | `@rive-app/react-canvas` + `public/diabo.riv` (state machine `Diabo`, 9 layers, ViewModel `DiaboCon`) |
| LLM | OpenRouter (free tier — `openai/gpt-oss-120b:free` default, rotation list in `.env.example`); no card on file |
| Chat plumbing | Vercel AI SDK v6 (`streamText` + `useChat`), httpOnly cookie sessions, Mongo persistence |
| Sentiment / NLP | HuggingFace Inference API — same models validated in `notebooks/pipeline_nlp.ipynb` (Pearson r=0.765) |
| Embeddings | `paraphrase-multilingual-MiniLM-L12-v2` (HF Inference, free) |
| Vector DB | MongoDB Atlas Vector Search (M0 free tier) |
| Auth | Auth.js v5 — optional Google sign-in (sprint 6) |
| Maps + POI | Leaflet + OpenStreetMap Overpass (free, no key) |
| Hosting | Vercel Hobby (free) |

**Zero paid services.** See `.env.example` for the full list of required keys (all free).

## Project structure

```
src/
  app/
    api/
      chat/                       POST → RAG-augmented streaming LLM reply
      chats/current/messages/     GET  → message history of the cookie session
      emotion/                    POST → HF sentiment classification (FR/AR)
      admin/seed-kb/              POST → idempotent KB seeding (dev-only)
    layout.tsx                    Root layout, French metadata, Geist fonts
    page.tsx                      Landing: DiaboProvider + DiaboStage + ChatPanel
  components/
    chat/           ChatPanel client component (useChat + history + emotion wiring)
    diabo/          DiaboProvider context + DiaboStage (boolean + number Rive channels)
  lib/
    db/
      chats.ts      Mongo helpers for `chats` + `messages` collections
      kb.ts         Mongo + Atlas Vector Search helpers for `kb_chunks`
    diabo/
      persona.ts        DIABO_PERSONA_FR system prompt
      emotion-map.ts    sentiment label → empathetic DiaboPreset
      knowledge.ts      14 curated FR KB seed chunks (Maghreb-aware)
      types.ts          DiaboCon ViewModel typed interface
    embeddings.ts   HF featureExtraction (384-dim multilingual MiniLM)
    emotion.ts      HF textClassification (xlm-roberta sentiment)
    env.ts          Zod-validated server env (OpenRouter, HF, Mongo, model rotation)
    llm.ts          OpenRouter provider + native fallback chain via `models[]`
    mongodb.ts      Lazy MongoClient with HMR-safe cache
scripts/
  smoke-chat.mjs    Standalone test: POST a French prompt to /api/chat
public/
  diabo.riv         Rive runtime export of the dino avatar
docs/               PDFs (cahier des charges, pitch deck)
notebooks/          NLP pipeline (33k+ review analysis, deliverable for the report)
```

## Local setup

```bash
# 1. Clone
git clone https://github.com/Waelxz/chronico-diabo.git
cd chronico-diabo

# 2. Install
npm install

# 3. Copy and fill env
cp .env.example .env
# (edit .env with your free keys — OpenRouter + HuggingFace minimum)

# 4. Run
npm run dev
# → http://localhost:3000
```

Requirements: **Node 20.9+** (Next.js 16 requirement; we test on Node 24).

## Sprints (status)

| # | Sprint | Status |
|---|---|---|
| 0 | Setup + Diabo idle on landing page | 🟢 done |
| 1 | Streaming chat + avatar lifecycle (`isTalking`/`isThinking`) + Mongo persistence | 🟢 done |
| 1+ | onFinish serverless fix + OpenRouter fallback + chat history hydration | 🟢 done |
| 2 | Empathy module (HF sentiment → DiaboCon empathetic preset) | 🟢 done |
| 3 | RAG over diabetes KB (Atlas Vector Search, 14 FR seed chunks) | 🟢 done |
| 4 | Restaurants module (Overpass + LLM scoring + Leaflet) + KB citation chips | 🟢 done |
| 5 | Hotels + travel module | ⚪ |
| 6 | Glucose tracker (manual) — log/chart/weekly LLM summary + PDF export | ⚪ |
| 7 | Auth + reminders + Web Push + multi-conv sidebar + companion memory | ⚪ |
| 8 | Multilingual FR + AR (RTL) | ⚪ |
| 9 | Onboarding (intake) + design polish | ⚪ |
| 10 | Production deploy + report + demo | ⚪ |

The full plan lives in `C:\Users\waeld\.windsurf\plans\chronico-diabo-build-plan-6be4f4.md` (local to the lead developer).

## Avatar API (FYI)

The Rive avatar exposes a `DiaboCon` ViewModel with 9 properties — see `src/lib/diabo/types.ts` for the typed interface, and the original API doc:
<https://github.com/Waelxz/chibi-dino-avatar/blob/main/docs/rive-api.md>

## License

MIT — see `LICENSE`.
