# NLP Pipeline — Phase 1 Compagnon IA

This folder is the **offline data analysis** deliverable for the M1 Big Data report. It is *not* loaded by the live app; the live app reuses the same models (sentiment, embeddings) on user messages, but at request time.

## Contents

| File | What it is |
|---|---|
| `pipeline_nlp.ipynb` | Full reproducible Jupyter notebook (Colab-ready, T4 GPU recommended). 7 modules: cleanup → representation → sentiment → topic modeling → zero-shot classification → visualisations → benchmark synthesis. |
| `google_play_reviews.csv` | ~21 321 reviews scraped from 9 health apps (EN + FR) via `google-play-scraper`. |
| `app_store_reviews.csv` | ~10 731 reviews from 9 apps × 5 countries via Apple's official RSS API. |
| `posts_reddit.csv` + `commentaires_reddit.csv` | ~900 posts/comments from r/ChatGPT, r/Replika, etc. via PullPush.io. |
| `hackernews.csv` | 652 documents from 10 targeted queries via Algolia HN API. |
| `benchmark_synthese.csv` | Output: per-app sentiment + dominant theme + main frustration. |

## Models used

- **Sentiment** — `cardiffnlp/twitter-xlm-roberta-base-sentiment` (multilingual). Validated against star ratings: Pearson r = **0.765**.
- **Embeddings** — `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- **Topic modeling** — BERTopic on the embeddings.
- **Zero-shot classification** — `facebook/bart-large-mnli` against 7 candidate labels (bug, paywall, conversation quality, empathy, missing feature, UX, perceived usefulness).

## Headline finding

> **Empathy is the single most positively-rated theme across all health apps** (sentiment +0.51) — and the most absent in diabetes apps (MySugr: 0.4 % of reviews mention empathy). Diabo's positioning is built around closing that gap.

## Reproducing

1. Upload all four CSVs to a fresh Google Colab session.
2. Open `pipeline_nlp.ipynb`, switch runtime to T4 GPU.
3. Uncomment the `pip install` cell on first run (~3 min).
4. Run all cells (~30–40 min end-to-end on T4).
5. PNG charts and `*_enrichi.csv` outputs are written next to the notebook.

## How this relates to the live app

| Notebook (offline) | App (online) |
|---|---|
| Sentiment validated on 33 k reviews | Same model called per user message via HF Inference API |
| Multilingual MiniLM embeddings on the corpus | Same embedder used to embed the diabetes RAG knowledge base |
| Zero-shot category labels for benchmark | Re-used as the intent classifier for chat routing |
| Topics discovered via BERTopic | Inform the empathy-prompt copy ("paywall fatigue", "feeling cold/transactional") |

The notebook is the scientific proof that the techniques in the live app are sound.
