"use client";

import type { Subject } from "./prompt";

/**
 * Estatísticas de uso para os pais: nº de perguntas por dia e por matéria.
 * Guarda apenas contadores agregados — nunca o conteúdo das conversas.
 */

export type DaySubjectCount = { date: string; subject: Subject; count: number };

const STATS_KEY = "tutor-ia-stats-v1";
const MAX_DAYS = 7;

function isCapacitorNative(): boolean {
  return (
    typeof window !== "undefined" &&
    // @ts-expect-error Capacitor injeta este objeto na app nativa
    !!window.Capacitor?.isNativePlatform?.()
  );
}

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function sanitize(raw: unknown): DaySubjectCount[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is DaySubjectCount =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as DaySubjectCount).date === "string" &&
      typeof (e as DaySubjectCount).count === "number" &&
      typeof (e as DaySubjectCount).subject === "string"
  );
}

let memoryCache: DaySubjectCount[] | null = null;

export async function loadStats(): Promise<DaySubjectCount[]> {
  if (memoryCache) return memoryCache;
  try {
    if (isCapacitorNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: STATS_KEY });
      memoryCache = value ? sanitize(JSON.parse(value)) : [];
    } else {
      const saved = localStorage.getItem(STATS_KEY);
      memoryCache = saved ? sanitize(JSON.parse(saved)) : [];
    }
  } catch {
    memoryCache = [];
  }
  return memoryCache;
}

export async function recordQuestion(subject: Subject): Promise<void> {
  const stats = await loadStats();
  const today = dayKey();
  const existing = stats.find((e) => e.date === today && e.subject === subject);
  const next = existing
    ? stats.map((e) =>
        e.date === today && e.subject === subject ? { ...e, count: e.count + 1 } : e
      )
    : [...stats, { date: today, subject, count: 1 }];

  const cutoff = dayKey(new Date(Date.now() - (MAX_DAYS - 1) * 86_400_000));
  const trimmed = next.filter((e) => e.date >= cutoff);
  memoryCache = trimmed;
  const serialized = JSON.stringify(trimmed);
  try {
    if (isCapacitorNative()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: STATS_KEY, value: serialized });
    } else {
      localStorage.setItem(STATS_KEY, serialized);
    }
  } catch {
    // armazenamento indisponível: segue só em memória
  }
}

export type DayTotal = { date: string; total: number };

export async function getDailyTotals(): Promise<DayTotal[]> {
  const stats = await loadStats();
  const byDay = new Map<string, number>();
  for (const e of stats) {
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.count);
  }
  const result: DayTotal[] = [];
  for (let i = MAX_DAYS - 1; i >= 0; i--) {
    const date = dayKey(new Date(Date.now() - i * 86_400_000));
    result.push({ date, total: byDay.get(date) ?? 0 });
  }
  return result;
}

export async function getSubjectTotals(): Promise<{ subject: Subject; count: number }[]> {
  const stats = await loadStats();
  const bySubject = new Map<Subject, number>();
  for (const e of stats) {
    bySubject.set(e.subject, (bySubject.get(e.subject) ?? 0) + e.count);
  }
  return [...bySubject.entries()]
    .map(([subject, count]) => ({ subject, count }))
    .sort((a, b) => b.count - a.count);
}
