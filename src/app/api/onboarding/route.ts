import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const onboardingSchema = z.object({
  diabetesType: z.enum(['t1', 't2', 'pre', 'unknown']),
  goal: z.enum(['glucose', 'restaurants', 'travel', 'emotional']),
  name: z.string().trim().min(1).max(80),
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
});

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Profil onboarding invalide' },
      { status: 400 },
    );
  }

  const session = await auth();
  const db = await getDb();
  if (!db) {
    return NextResponse.json(
      { error: 'Base de données indisponible' },
      { status: 503 },
    );
  }

  const filter = session?.user?.id
    ? { userId: session.user.id }
    : { anonId: req.headers.get('x-anon-id') ?? 'unknown' };

  await db.collection('users').updateOne(
    filter,
    {
      $set: {
        ...parsed.data,
        updatedAt: new Date(),
      },
      $setOnInsert: filter,
    },
    { upsert: true },
  );

  return NextResponse.json({ ok: true });
}
