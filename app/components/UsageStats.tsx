"use client";

import { useEffect, useState } from "react";
import { SUBJECT_LABELS } from "@/lib/gemini";
import { getDailyTotals, getSubjectTotals, type DayTotal } from "@/lib/stats";

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return WEEKDAYS[d.getDay()] ?? date;
}

export default function UsageStats() {
  const [daily, setDaily] = useState<DayTotal[] | null>(null);
  const [subjects, setSubjects] = useState<{ subject: keyof typeof SUBJECT_LABELS; count: number }[]>([]);

  useEffect(() => {
    Promise.all([getDailyTotals(), getSubjectTotals()]).then(([d, s]) => {
      setDaily(d);
      setSubjects(s);
    });
  }, []);

  if (daily === null) return null;

  const max = Math.max(1, ...daily.map((d) => d.total));
  const grandTotal = daily.reduce((acc, d) => acc + d.total, 0);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      <h3 className="text-sm font-semibold text-indigo-900">📊 Uso nos últimos 7 dias</h3>
      <p className="mt-0.5 text-[11px] text-indigo-700">
        {grandTotal} pergunta{grandTotal === 1 ? "" : "s"} no total — só contadores, o conteúdo
        das conversas nunca é guardado aqui.
      </p>

      <div className="mt-3 flex items-end gap-1.5">
        {daily.map((d) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-medium text-indigo-900">{d.total || ""}</span>
            <div
              className="w-full rounded-t bg-indigo-500/80"
              style={{ height: `${Math.max(4, (d.total / max) * 64)}px` }}
              title={`${d.total} pergunta(s)`}
            />
            <span className="text-[10px] text-indigo-600">{shortDate(d.date)}</span>
          </div>
        ))}
      </div>

      {subjects.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <span
              key={s.subject}
              className="rounded-full bg-white px-2 py-0.5 text-[11px] text-indigo-800 shadow-sm"
            >
              {SUBJECT_LABELS[s.subject]}: {s.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
