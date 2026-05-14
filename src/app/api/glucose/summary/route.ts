import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { z } from 'zod';
import { getChatModel } from '@/lib/llm';

export const runtime = 'nodejs';
export const maxDuration = 30;

const logSchema = z.object({
  value: z.number(),
  unit: z.enum(['mg/dL', 'mmol/L']),
  measuredAt: z.string(),
  context: z.enum(['fasting', 'before_meal', 'after_meal', 'bedtime', 'other']),
  note: z.string().optional(),
});

const bodySchema = z.object({
  logs: z.array(logSchema).max(80),
});

export async function POST(req: Request) {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Historique glycémique invalide' },
      { status: 400 },
    );
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const logs = parsed.data.logs
    .filter((log) => {
      const measuredAt = new Date(log.measuredAt).getTime();
      return Number.isFinite(measuredAt) && measuredAt >= sevenDaysAgo;
    })
    .toSorted(
      (a, b) =>
        new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime(),
    );

  if (logs.length === 0) {
    return NextResponse.json(
      { error: 'Ajoutez au moins une mesure cette semaine' },
      { status: 400 },
    );
  }

  try {
    const result = await generateText({
      model: getChatModel(),
      system:
        'Tu es Diabo, un compagnon de suivi du diabète. Réponds en français clair, prudent et empathique. Ne pose pas de diagnostic et conseille de contacter un professionnel de santé en cas de valeurs inquiétantes ou répétées.',
      prompt: `Rédige un résumé hebdomadaire de glycémie en 3 à 5 phrases. Mentionne la tendance, les valeurs hautes/basses visibles et un conseil pratique. Sois concis.\n\nMesures JSON:\n${JSON.stringify(
        logs,
      )}`,
      maxOutputTokens: 200,
      temperature: 0.4,
      abortSignal: AbortSignal.timeout(20_000),
    });

    return NextResponse.json({ summary: result.text.trim() });
  } catch (err) {
    console.error('[glucose-summary] generateText failed:', err);
    return NextResponse.json(
      { error: 'Impossible de générer le résumé pour le moment' },
      { status: 502 },
    );
  }
}
