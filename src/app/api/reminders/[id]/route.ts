import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  deleteReminder,
  ensureReminderIndexes,
  updateReminderEnabled,
  type Reminder,
} from '@/lib/db/reminders';

export const runtime = 'nodejs';

const patchSchema = z.object({
  enabled: z.boolean(),
});

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  const { id } = await context.params;
  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders] ensure indexes failed:', err),
  );
  await deleteReminder(userId, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Mise à jour invalide' }, { status: 400 });
  }

  const { id } = await context.params;
  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders] ensure indexes failed:', err),
  );
  const reminder = await updateReminderEnabled(userId, id, parsed.data.enabled);
  if (!reminder) {
    return NextResponse.json({ error: 'Rappel introuvable' }, { status: 404 });
  }
  return NextResponse.json({ reminder: serializeReminder(reminder) });
}

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

function serializeReminder(reminder: Reminder) {
  return {
    ...reminder,
    _id: reminder._id?.toHexString(),
    createdAt: reminder.createdAt.toISOString(),
  };
}
