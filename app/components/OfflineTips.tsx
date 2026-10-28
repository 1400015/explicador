"use client";

import { OFFLINE_MESSAGE, getOfflineTips } from "@/lib/offline-tips";
import type { Subject } from "@/lib/prompt";
import { useLocale } from "@/lib/locale";

export default function OfflineTips({
  subject,
  onClose,
}: {
  subject: Subject;
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-sky-900">
          {locale === "pt-BR"
            ? "Você está sem internet. Enquanto a conexão não volta, experimente estas dicas:"
            : OFFLINE_MESSAGE}
        </p>
        <button
          onClick={onClose}
          title={t("Fechar")}
          className="rounded-full px-2 text-sky-700 transition hover:bg-sky-100"
        >
          ✕
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {getOfflineTips(subject, locale).map((tip, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-sky-900"
          >
            <span className="font-bold text-sky-600">{i + 1}.</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-sky-700">
        {t(
          "A tua pergunta mantém-se no campo de escrita — tenta enviar outra vez quando tiveres rede. 📶",
        )}
      </p>
    </div>
  );
}
