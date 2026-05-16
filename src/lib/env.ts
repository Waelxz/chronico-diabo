import { z } from 'zod';

/**
 * Server-side environment schema. All values are optional during sprint 0
 * because Atlas/auth aren't wired yet. Tighten as features land.
 */
const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // LLM
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_MODEL: z.string().default('openai/gpt-oss-120b:free'),
  // Comma-separated list of models OpenRouter tries when the primary
  // returns an error (429, capacity, etc.). Empty = no fallback.
  OPENROUTER_FALLBACK_MODELS: z.string().default(''),

  // HuggingFace (sentiment + embeddings)
  HUGGINGFACE_ACCESS_TOKEN: z.string().min(1).optional(),

  // MongoDB Atlas (added once cluster is created)
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB: z.string().default('chronico_diabo'),

  // Auth.js / Google OAuth
  AUTH_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),

  // Web Push (VAPID)
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_MAILTO: z.string().min(1).optional(),

  // App
  APP_URL: z.string().url().default('http://localhost:3000'),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // Don't crash dev — log and return defaults.
    console.warn('[env] invalid env, using defaults:', parsed.error.flatten());
    cached = ServerEnvSchema.parse({});
  } else {
    cached = parsed.data;
  }
  return cached;
}
