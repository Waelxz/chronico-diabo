import 'server-only';
import { ObjectId, type Collection, type Document } from 'mongodb';
import { getDb } from '../mongodb';

/**
 * Sprint 1 conversation persistence — minimal viable schema.
 *
 * `chats`     : one row per conversation (we'll add titles, owner, etc. later).
 * `messages`  : ordered messages within a chat, role + raw text.
 *
 * We DO NOT block the chat stream on Mongo writes. Calls below should be
 * fire-and-forget inside `streamText.onFinish` so a Mongo outage never
 * stops the user from talking to Diabo.
 */

export type ChatDoc = {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
};

export type MessageDoc = {
  _id: ObjectId;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  /** Arbitrary side-channel data (e.g. RAG citations). Optional. */
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

async function chatsCol(): Promise<Collection<ChatDoc> | null> {
  const db = await getDb();
  return db ? db.collection<ChatDoc>('chats') : null;
}

async function messagesCol(): Promise<Collection<MessageDoc> | null> {
  const db = await getDb();
  return db ? db.collection<MessageDoc>('messages') : null;
}

/** Upserts a chat row, bumps `updatedAt`, returns the chatId actually used. */
export async function touchChat(chatId: string): Promise<string> {
  const col = await chatsCol();
  if (!col) return chatId;
  const now = new Date();
  await col.updateOne(
    { _id: chatId },
    { $set: { updatedAt: now }, $setOnInsert: { _id: chatId, createdAt: now } },
    { upsert: true },
  );
  return chatId;
}

export async function appendMessage(
  chatId: string,
  role: MessageDoc['role'],
  content: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const [chats, msgs] = await Promise.all([chatsCol(), messagesCol()]);
  if (!chats || !msgs) return;
  const now = new Date();
  const doc: MessageDoc = {
    _id: new ObjectId(),
    chatId,
    role,
    content,
    createdAt: now,
  };
  if (metadata && Object.keys(metadata).length > 0) {
    doc.metadata = metadata;
  }
  await msgs.insertOne(doc);
  const lastKey = role === 'user' ? 'lastUserMessage' : 'lastAssistantMessage';
  await chats.updateOne(
    { _id: chatId },
    { $set: { [lastKey]: content, updatedAt: now } },
  );
}

/** Convenience for debugging / future history view. Sorted oldest → newest. */
export async function listMessages(chatId: string, limit = 100): Promise<MessageDoc[]> {
  const col = await messagesCol();
  if (!col) return [];
  return col
    .find({ chatId } as Document, { sort: { createdAt: 1 }, limit })
    .toArray();
}
