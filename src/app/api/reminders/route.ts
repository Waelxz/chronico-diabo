import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  ensureReminderIndexes,
  getReminders,
  upsertReminder,
  type Reminder,
} from '@/lib/db/reminders';

export const runtime = 'nodejs';

const reminderSchema = z.object({
  label: z.string().trim().min(1).max(120),
  cronExpr: z.string().trim().min(1).max(80),
  type: z.enum(['medication', 'glucose', 'exercise', 'hydration', 'custom']),
  enabled: z.boolean(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  }

  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders] ensure indexes failed:', err),
  );
  const reminders = await getReminders(userId);
  return NextResponse.json({ reminders: reminders.map(serializeReminder) });
}

export async function POST(req: Request) {
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

  const parsed = reminderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Rappel invalide' }, { status: 400 });
  }

  await ensureReminderIndexes().catch((err) =>
    console.warn('[reminders] ensure indexes failed:', err),
  );
  const reminder = await upsertReminder(userId, parsed.data);
  if (!reminder) {
    return NextResponse.json(
      { error: 'Base de données indisponible' },
      { status: 503 },
    );
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
