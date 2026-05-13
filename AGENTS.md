<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Chronico · Diabo — agent rules

## Project-specific conventions

- **Strict TS + ESLint** — `npm run typecheck` and `npm run lint` must pass before any commit. Never weaken these to ship faster.
- **No paid services**: every external dependency must be on a free tier without a card. If a free path doesn't exist, surface it before proceeding.
- **All UI copy in French** by default (Maghreb audience). Arabic comes in sprint 7 via `next-intl`. English only inside code/comments and developer-facing docs.
- **Avatar contract**: drive Diabo only through `src/lib/diabo/types.ts`. Don't re-derive state-machine names or VM property names elsewhere.
- **Server-only modules** must `import 'server-only'` at the top (e.g. `src/lib/mongodb.ts`).
- **Async Request APIs**: `cookies()`, `headers()`, `params`, `searchParams` are **always** Promises in Next 16 — `await` them.
- **No `--turbopack` flag** in scripts — Turbopack is the default in Next 16.
- **Codex CLI delegation**: bulk repetitive tasks (renames, mass test scaffolding, large-scale audits) should be considered for delegation per the user's global rule. Single-file surgical edits stay in Cascade.

## Sprints

Track sprint status in `README.md`. Each sprint must end with a working demo + commit.

## Don't touch (without coordination)

- `public/diabo.riv` — the Rive runtime export. Source lives in `Waelxz/chibi-dino-avatar`.
- `notebooks/` — the offline NLP analysis (deliverable for the report). Read-only here.
- `docs/*.pdf` — academic source material, do not modify.

