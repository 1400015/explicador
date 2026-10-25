"use client";

import { OFFLINE_MESSAGE, getOfflineTips } from "@/lib/offline-tips";
import type { Subject } from "@/lib/prompt";

export default function OfflineTips({
  subject,
  onClose,
}: {
  subject: Subject;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-sky-900">{OFFLINE_MESSAGE}</p>
        <button
          onClick={onClose}
          title="Fechar"
          className="rounded-full px-2 text-sky-700 transition hover:bg-sky-100"
        >
          ✕
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {getOfflineTips(subject).map((tip, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-sky-900">
            <span className="font-bold text-sky-600">{i + 1}.</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-sky-700">
        A tua pergunta fica no histórico — tenta enviar outra vez quando tiveres rede. 📶
      </p>
    </div>
  );
}
