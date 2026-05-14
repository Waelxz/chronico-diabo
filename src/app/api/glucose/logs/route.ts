import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureGlucoseIndexes,
  getLogsForSession,
  insertLog,
  type GlucoseContext,
  type GlucoseUnit,
} from '@/lib/db/glucose';

export const runtime = 'nodejs';

const COOKIE_NAME = 'diabo_chat_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const logSchema = z.object({
  value: z.number(),
  unit: z.enum(['mg/dL', 'mmol/L']),
  context: z.enum(['fasting', 'before_meal', 'after_meal', 'bedtime', 'other']),
  note: z.string().trim().max(500).optional(),
  measuredAt: z.string().datetime().optional(),
});

export async function GET() {
  const { sessionId, isNewSession } = await resolveSessionId();

  await ensureGlucoseIndexes().catch((err) =>
    console.warn('[glucose-api] ensure indexes failed:', err),
  );

  const logs = await getLogsForSession(sessionId);
  const response = NextResponse.json({ logs });
  setSessionCookie(response, sessionId, isNewSession);
  return response;
}

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = logSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Données de glycémie invalides' },
      { status: 400 },
    );
  }

  const { value, unit, context, note, measuredAt } = parsed.data;
  if (!isValueInRange(value, unit)) {
    return NextResponse.json(
      { error: valueRangeMessage(unit) },
      { status: 400 },
    );
  }

  const measuredDate = measuredAt ? new Date(measuredAt) : new Date();
  if (Number.isNaN(measuredDate.getTime())) {
    return NextResponse.json(
      { error: 'Date de mesure invalide' },
      { status: 400 },
    );
  }

  const { sessionId, isNewSession } = await resolveSessionId();

  await ensureGlucoseIndexes().catch((err) =>
    console.warn('[glucose-api] ensure indexes failed:', err),
  );

  const log = await insertLog(sessionId, {
    value,
    unit,
    measuredAt: measuredDate,
    context: context as GlucoseContext,
    ...(note ? { note } : {}),
  });

  if (!log) {
    return NextResponse.json(
      { error: 'Base de données indisponible' },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ log });
  setSessionCookie(response, sessionId, isNewSession);
  return response;
}

async function resolveSessionId(): Promise<{
  sessionId: string;
  isNewSession: boolean;
}> {
  const cookieStore = await cookies();
  const existingSessionId = cookieStore.get(COOKIE_NAME)?.value;
  return {
    sessionId: existingSessionId ?? new ObjectId().toHexString(),
    isNewSession: !existingSessionId,
  };
}

function setSessionCookie(
  response: NextResponse,
  sessionId: string,
  isNewSession: boolean,
): void {
  if (!isNewSession) return;
  response.cookies.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });
}

function isValueInRange(value: number, unit: GlucoseUnit): boolean {
  if (!Number.isFinite(value)) return false;
  if (unit === 'mg/dL') return value >= 1 && value <= 600;
  return value >= 0.5 && value <= 33;
}

function valueRangeMessage(unit: GlucoseUnit): string {
  if (unit === 'mg/dL') {
    return 'La valeur doit être entre 1 et 600 mg/dL';
  }
  return 'La valeur doit être entre 0,5 et 33 mmol/L';
}
