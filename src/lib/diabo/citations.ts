import type { KbTopic } from '@/lib/db/kb';

/**
 * Shape of a single KB chunk surfaced to the user as a citation chip
 * under Diabo's reply. We deliberately do NOT include the full chunk
 * content — citations are a UI affordance ("Diabo a consulté…"), not
 * a quote box.
 */
export type KbCitation = {
  topic: KbTopic;
  title: string;
  /** Cosine similarity to the query (0..1), rounded to 3 decimals. */
  score: number;
};

/**
 * Metadata payload attached to assistant `UIMessage`s.
 *
 * Plumbed through:
 *   - `/api/chat` → `streamText({...}).toUIMessageStreamResponse({ messageMetadata })`
 *   - `messages` Mongo collection → `metadata` field
 *   - `/api/chats/current/messages` → returned to the client on hydrate
 *   - `<ChatPanel>` → rendered as `<Citations>` chips
 */
export type DiaboMessageMetadata = {
  kbCitations?: KbCitation[];
};
