"use client";

import { supportResources } from "@/lib/support";
import type { Country } from "@/lib/learning-profile";
import { useLocale } from "@/lib/locale";

export default function SupportBanner({
  country = "PT",
  onClose,
}: {
  country?: Country;
  onClose: () => void;
}) {
  const { t } = useLocale();
  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">
          {t(
            "💛 Se estiveres a passar por algo difícil, não tens de passar sozinho/a. Pedir ajuda é sinal de força!",
          )}
        </p>
        <button
          onClick={onClose}
          aria-label={t("Fechar contactos de apoio")}
          title={t("Fechar")}
          className="rounded-full px-2 text-amber-700 transition hover:bg-amber-100"
        >
          ✕
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {supportResources(country).map((r) => (
          <li key={r.name} className="text-xs text-amber-800">
            {r.emoji} <span className="font-medium">{r.name}</span>
            {r.detail ? ` — ${r.detail}` : ""}
            {r.contact ? (
              <span className="block font-mono text-[11px]">{r.contact}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
