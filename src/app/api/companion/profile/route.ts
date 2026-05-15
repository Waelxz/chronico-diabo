import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ensureCompanionIndexes,
  getProfile,
  upsertProfile,
  type CompanionProfile,
} from '@/lib/db/companion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'diabo_chat_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  birthDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  heightCm: z.number().int().min(80).max(250).optional(),
  weightKg: z.number().min(20).max(350).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(40).optional(),
  diabetesType: z
    .enum(['1', '2', 'gestational', 'prediabetes', 'other'])
    .optional(),
  treatment: z.string().trim().max(120).optional(),
  goals: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  restrictions: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  city: z.string().trim().max(120).optional(),
});

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ profile: null });
  }

  await ensureCompanionIndexes().catch((err) =>
    console.warn('[companion-profile] ensure indexes failed:', err),
  );

  const profile = await getProfile(sessionId);
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  return saveProfile(req);
}

export async function PATCH(req: Request) {
  return saveProfile(req);
}

async function saveProfile(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Profil compagnon invalide' },
      { status: 400 },
    );
  }

  const { sessionId, isNewSession } = await resolveSessionId();

  await ensureCompanionIndexes().catch((err) =>
    console.warn('[companion-profile] ensure indexes failed:', err),
  );

  const profile = await upsertProfile(
    sessionId,
    cleanProfileInput(parsed.data),
  );
  if (!profile) {
    return NextResponse.json(
      { error: 'Base de données indisponible' },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ profile });
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

function cleanProfileInput(
  input: z.infer<typeof profileSchema>,
): Partial<CompanionProfile> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    }),
  ) as Partial<CompanionProfile>;
}
