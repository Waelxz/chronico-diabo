import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import {
  ensureCompanionIndexes,
  getProfile,
  upsertProfile,
  type CompanionProfile,
  type OwnerKey,
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
  const session = await auth();
  const userId = session?.user?.id;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!userId && !sessionId) {
    return NextResponse.json({ profile: null });
  }
  const ownerKey: OwnerKey = userId
    ? { userId }
    : { sessionId: sessionId as string };

  await ensureCompanionIndexes().catch((err) =>
    console.warn('[companion-profile] ensure indexes failed:', err),
  );

  const profile = await getProfile(ownerKey);
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

  const session = await auth();
  const userId = session?.user?.id;
  let anonSession: Awaited<ReturnType<typeof resolveSessionId>> | null = null;
  let ownerKey: OwnerKey;
  if (userId) {
    ownerKey = { userId };
  } else {
    anonSession = await resolveSessionId();
    ownerKey = { sessionId: anonSession.sessionId };
  }

  await ensureCompanionIndexes().catch((err) =>
    console.warn('[companion-profile] ensure indexes failed:', err),
  );

  const profile = await upsertProfile(
    ownerKey,
    cleanProfileInput(parsed.data),
  );
  if (!profile) {
    return NextResponse.json(
      { error: 'Base de données indisponible' },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ profile });
  if (anonSession) {
    setSessionCookie(response, anonSession.sessionId, anonSession.isNewSession);
  }
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
