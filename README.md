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
    api/chat/       POST → streaming LLM response (AI SDK v6, OpenRouter)
    layout.tsx      Root layout, French metadata, Geist fonts
    page.tsx        Landing page: DiaboProvider + DiaboStage + ChatPanel
  components/
    chat/           ChatPanel client component (useChat + lifecycle wiring)
    diabo/          DiaboProvider context + DiaboStage Rive avatar
  lib/
    db/chats.ts     Mongo helpers for `chats` + `messages` collections
    diabo/
      persona.ts    DIABO_PERSONA_FR system prompt
      types.ts      DiaboCon ViewModel typed interface
    env.ts          Zod-validated server env (OpenRouter, HF, Mongo)
    llm.ts          OpenRouter provider + default chat model
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
|---|---|---|dn
| 0 | Setup + Diabo idle on landing page | 🟢 in progress | + Mongo persistence 🟢done
| 1 | Streaming chat + avatar lifecycle (`isT nextalking`/`isThinking`) | ⚪ |
| 2 | Empathy module (emotion → DiaboCon) | ⚪ |
| 3 | RAG over diabetes knowledge base | ⚪ |
| 4 | Restaurants module (Overpass + LLM scoring + Leaflet) | ⚪ |
| 5 | Hotels + travel module | ⚪ |
| 6 | Auth + reminders + Web Push | ⚪ |
| 7 | Multilingual FR + AR (RTL) | ⚪ |
| 8 | Onboarding + design polish | ⚪ |
| 9 | Production deploy + report + demo | ⚪ |

The full plan lives in `C:\Users\waeld\.windsurf\plans\chronico-diabo-build-plan-6be4f4.md` (local to the lead developer).

## Avatar API (FYI)

The Rive avatar exposes a `DiaboCon` ViewModel with 9 properties — see `src/lib/diabo/types.ts` for the typed interface, and the original API doc:
<https://github.com/Waelxz/chibi-dino-avatar/blob/main/docs/rive-api.md>

## License

MIT — see `LICENSE`.
