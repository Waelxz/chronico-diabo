import 'server-only';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getEnv } from './env';

/**
 * OpenRouter provider, lazy-initialised so we don't crash at module load
 * when `OPENROUTER_API_KEY` is missing — we want a clear error from
 * `/api/chat` instead. Free-tier friendly by default.
 *
 * Free models we rotate through (see `.env.example`):
 *   - meta-llama/llama-3.3-70b-instruct:free  (default, solid in FR)
 *   - google/gemini-2.0-flash-exp:free         (fast, smaller context)
 *   - deepseek/deepseek-chat:free              (verbose, decent FR)
 */
let cachedProvider: ReturnType<typeof createOpenRouter> | null = null;

export function getOpenRouter() {
  if (cachedProvider) return cachedProvider;
  const env = getEnv();
  if (!env.OPENROUTER_API_KEY) {
    throw new Error(
      '[llm] OPENROUTER_API_KEY is not set — copy `.env.example` to `.env` and fill it in.',
    );
  }
  cachedProvider = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: env.OPENROUTER_BASE_URL,
    // Optional — OpenRouter shows these in their leaderboard.
    headers: {
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Chronico Diabo',
    },
  });
  return cachedProvider;
}

function parseFallbacks(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * The default chat model configured by `OPENROUTER_MODEL`, with an OpenRouter
 * native fallback chain (`models` field) when `OPENROUTER_FALLBACK_MODELS` is
 * set. OpenRouter retries on the next model in the list if the primary 429s
 * or returns a routing error — saves us a manual retry loop on free-tier
 * provider rate-limits.
 */
export function getChatModel() {
  const env = getEnv();
  const fallbacks = parseFallbacks(env.OPENROUTER_FALLBACK_MODELS);
  return getOpenRouter().chat(
    env.OPENROUTER_MODEL,
    fallbacks.length > 0 ? { models: fallbacks } : undefined,
  );
}
