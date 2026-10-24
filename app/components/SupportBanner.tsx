"use client";

import { SUPPORT_RESOURCES } from "@/lib/support";

export default function SupportBanner({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">
          💛 Se estiveres a passar por algo difícil, não tens de passar sozinho/a. Pedir ajuda é
          sinal de força!
        </p>
        <button
          onClick={onClose}
          title="Fechar"
          className="rounded-full px-2 text-amber-700 transition hover:bg-amber-100"
        >
          ✕
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {SUPPORT_RESOURCES.map((r) => (
          <li key={r.name} className="text-xs text-amber-800">
            {r.emoji} <span className="font-medium">{r.name}</span>
            {r.detail ? ` — ${r.detail}` : ""}
            {r.contact ? <span className="block font-mono text-[11px]">{r.contact}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
