'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type GlucoseUnit = 'mg/dL' | 'mmol/L';
type GlucoseContext =
  | 'fasting'
  | 'before_meal'
  | 'after_meal'
  | 'bedtime'
  | 'other';

type ApiGlucoseLog = {
  _id?: string;
  sessionId: string;
  value: number;
  unit: GlucoseUnit;
  measuredAt: string;
  context: GlucoseContext;
  note?: string;
};

type ChartPoint = {
  id: string;
  label: string;
  originalValue: number;
  originalUnit: GlucoseUnit;
  displayValue: number;
  mgSeries: number | null;
  mmolSeries: number | null;
  context: GlucoseContext;
  note?: string;
};

const CONTEXT_LABELS: Record<GlucoseContext, string> = {
  fasting: 'À jeun',
  before_meal: 'Avant repas',
  after_meal: 'Après repas',
  bedtime: 'Coucher',
  other: 'Autre',
};

const UNIT_COLORS: Record<GlucoseUnit, string> = {
  'mg/dL': '#059669',
  'mmol/L': '#2563eb',
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const listDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function GlucoseTracker() {
  const [logs, setLogs] = useState<ApiGlucoseLog[]>([]);
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<GlucoseUnit>('mg/dL');
  const [context, setContext] = useState<GlucoseContext>('fasting');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/glucose/logs', { cache: 'no-store' });
      const data = (await response.json()) as {
        logs?: ApiGlucoseLog[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? 'Chargement impossible');
      }
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les mesures',
      );
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const chartLogs = useMemo(
    () =>
      logs
        .slice(0, 30)
        .toReversed()
        .map((log, index) => toChartPoint(log, index, unit)),
    [logs, unit],
  );

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);
  const weeklyLogs = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return logs.filter((log) => new Date(log.measuredAt).getTime() >= since);
  }, [logs]);

  const target = unit === 'mg/dL' ? { low: 70, high: 140 } : { low: 3.9, high: 7.8 };
  const maxChartValue = Math.max(
    target.high * 1.35,
    ...chartLogs.map((point) => point.displayValue * 1.15),
  );

  async function submitLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSummary(null);

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      setError('Saisissez une valeur de glycémie valide');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/glucose/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: parsedValue,
          unit,
          context,
          note: note.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        log?: ApiGlucoseLog;
        error?: string;
      };
      if (!response.ok || !data.log) {
        throw new Error(data.error ?? 'Enregistrement impossible');
      }
      const newLog = data.log as ApiGlucoseLog;
      setLogs((current) => {
        const merged: ApiGlucoseLog[] = [newLog, ...current];
        merged.sort(
          (a: ApiGlucoseLog, b: ApiGlucoseLog) =>
            new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
        );
        return merged;
      });
      setValue('');
      setNote('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer la mesure",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(logId: string | undefined) {
    if (!logId) return;
    setDeletingId(logId);
    setError(null);
    setSummary(null);
    try {
      const response = await fetch(`/api/glucose/logs/${logId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Suppression impossible');
      }
      setLogs((current) => current.filter((log) => log._id !== logId));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible de supprimer la mesure',
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const response = await fetch('/api/glucose/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: weeklyLogs }),
      });
      const data = (await response.json()) as {
        summary?: string;
        error?: string;
      };
      if (!response.ok || !data.summary) {
        throw new Error(data.error ?? 'Résumé indisponible');
      }
      setSummary(data.summary);
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : 'Impossible de générer le résumé',
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <aside className="space-y-4">
        <form
          onSubmit={(event) => void submitLog(event)}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Nouvelle mesure
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Notez une glycémie manuelle et son contexte.
            </p>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="space-y-2">
              <label
                htmlFor="glucose-value"
                className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
              >
                Valeur
              </label>
              <input
                id="glucose-value"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                type="number"
                min={unit === 'mg/dL' ? 1 : 0.5}
                max={unit === 'mg/dL' ? 600 : 33}
                step={unit === 'mg/dL' ? 1 : 0.1}
                required
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
            </div>
            <div className="space-y-2">
              <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-100">
                Unité
              </span>
              <div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                {(['mg/dL', 'mmol/L'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setUnit(option)}
                    className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                      unit === option
                        ? 'bg-emerald-600 text-white'
                        : 'text-zinc-600 hover:text-emerald-700 dark:text-zinc-300 dark:hover:text-emerald-300'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="glucose-context"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
            >
              Contexte
            </label>
            <select
              id="glucose-context"
              value={context}
              onChange={(event) =>
                setContext(event.target.value as GlucoseContext)
              }
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="glucose-note"
              className="text-sm font-medium text-zinc-800 dark:text-zinc-100"
            >
              Note facultative
            </label>
            <textarea
              id="glucose-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Repas, activité, ressenti..."
              className="w-full resize-none rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>

        <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Résumé de la semaine
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {weeklyLogs.length} mesure{weeklyLogs.length > 1 ? 's' : ''}
                {' '}sur 7 jours.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void generateSummary()}
            disabled={summaryLoading || weeklyLogs.length === 0}
            className="w-full rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
          >
            {summaryLoading ? 'Analyse en cours...' : 'Résumé de la semaine'}
          </button>
          {summaryError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              {summaryError}
            </p>
          ) : null}
          {summary ? (
            <p className="rounded-md bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              {summary}
            </p>
          ) : null}
        </section>
      </aside>

      <section className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Courbe des 30 dernières mesures
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Zone cible affichée en {unit}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadLogs()}
              disabled={loading}
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:text-emerald-300"
            >
              {loading ? 'Chargement...' : 'Actualiser'}
            </button>
          </div>

          <div className="mt-4 h-80 min-h-80">
            {loading ? (
              <ChartState text="Chargement des mesures..." />
            ) : chartLogs.length === 0 ? (
              <ChartState text="Aucune mesure enregistrée pour le moment." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartLogs}
                  margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    width={54}
                    domain={[0, Math.ceil(maxChartValue)]}
                    tick={{ fontSize: 12 }}
                    unit={` ${unit}`}
                  />
                  <Tooltip content={<GlucoseTooltip />} />
                  <Legend />
                  <ReferenceArea
                    y1={0}
                    y2={target.low}
                    fill="#fee2e2"
                    fillOpacity={0.55}
                  />
                  <ReferenceArea
                    y1={target.low}
                    y2={target.high}
                    fill="#dcfce7"
                    fillOpacity={0.75}
                  />
                  <ReferenceArea
                    y1={target.high}
                    y2={Math.ceil(maxChartValue)}
                    fill="#fee2e2"
                    fillOpacity={0.45}
                  />
                  <Area
                    type="monotone"
                    dataKey="displayValue"
                    stroke="none"
                    fill="#ecfdf5"
                    fillOpacity={0.25}
                    name={`Valeur (${unit})`}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mgSeries"
                    name="mg/dL"
                    stroke={UNIT_COLORS['mg/dL']}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="mmolSeries"
                    name="mmol/L"
                    stroke={UNIT_COLORS['mmol/L']}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="space-y-3" aria-label="Dernières mesures">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Dernières mesures
          </h2>
          {loading ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Chargement de l'historique...
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              Aucune mesure à afficher.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {recentLogs.map((log) => (
                <LogCard
                  key={log._id ?? `${log.measuredAt}-${log.value}`}
                  log={log}
                  deleting={deletingId === log._id}
                  onDelete={() => void deleteEntry(log._id)}
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function ChartState({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      {text}
    </div>
  );
}

function LogCard({
  log,
  deleting,
  onDelete,
}: {
  log: ApiGlucoseLog;
  deleting: boolean;
  onDelete: () => void;
}) {
  const date = new Date(log.measuredAt);
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {formatValue(log.value, log.unit)}{' '}
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {log.unit}
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {listDateFormatter.format(date)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting || !log._id}
          aria-label="Supprimer la mesure"
          title="Supprimer"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          <span aria-hidden="true">&#128465;</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {CONTEXT_LABELS[log.context]}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${rangeBadgeClass(log)}`}>
          {rangeLabel(log)}
        </span>
      </div>
      {log.note ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          {log.note}
        </p>
      ) : null}
    </article>
  );
}

function GlucoseTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="font-medium text-zinc-950 dark:text-zinc-50">
        {formatValue(point.originalValue, point.originalUnit)} {point.originalUnit}
      </p>
      <p className="text-zinc-500 dark:text-zinc-400">
        {point.label} · {CONTEXT_LABELS[point.context]}
      </p>
      {point.note ? (
        <p className="mt-1 max-w-56 text-zinc-600 dark:text-zinc-300">
          {point.note}
        </p>
      ) : null}
    </div>
  );
}

function toChartPoint(
  log: ApiGlucoseLog,
  index: number,
  displayUnit: GlucoseUnit,
): ChartPoint {
  const displayValue = convertValue(log.value, log.unit, displayUnit);
  return {
    id: log._id ?? `${log.measuredAt}-${index}`,
    label: dateFormatter.format(new Date(log.measuredAt)),
    originalValue: log.value,
    originalUnit: log.unit,
    displayValue,
    mgSeries: log.unit === 'mg/dL' ? displayValue : null,
    mmolSeries: log.unit === 'mmol/L' ? displayValue : null,
    context: log.context,
    note: log.note,
  };
}

function convertValue(
  value: number,
  fromUnit: GlucoseUnit,
  toUnit: GlucoseUnit,
): number {
  if (fromUnit === toUnit) return value;
  if (toUnit === 'mmol/L') return Math.round((value / 18.0182) * 10) / 10;
  return Math.round(value * 18.0182);
}

function formatValue(value: number, unit: GlucoseUnit): string {
  if (unit === 'mmol/L') return value.toFixed(1).replace('.', ',');
  return String(Math.round(value));
}

function rangeLabel(log: ApiGlucoseLog): string {
  const value = convertValue(log.value, log.unit, 'mg/dL');
  if (value < 70) return 'Bas';
  if (value > 140) return 'Haut';
  return 'Cible';
}

function rangeBadgeClass(log: ApiGlucoseLog): string {
  const label = rangeLabel(log);
  if (label === 'Cible') {
    return 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200';
  }
  return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
}
