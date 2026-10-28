"use client";

import { SUBJECT_LABELS } from "@/lib/prompt";
import type { Subject } from "@/lib/prompt";
import { useLocale } from "@/lib/locale";
import type { TutorLocale } from "@/lib/learning-profile";
import {
  useConversations,
  deleteConversation,
  type Conversation,
} from "@/lib/conversations";

const SUBJECT_ICONS: Record<Subject, string> = {
  matematica: "➗",
  ciencias: "🔬",
  portugues: "📖",
  historia: "🏛️",
  geografia: "🌍",
  geral: "💡",
};

function formatTime(ts: number, locale: TutorLocale): string {
  try {
    return new Date(ts).toLocaleString(locale, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ConversationList({
  onOpen,
  onDeleted,
}: {
  onOpen: (conversation: Conversation) => void;
  /** Chamado quando uma conversa é apagada, para o chat sincronizar. */
  onDeleted: (id: string) => void;
}) {
  const { locale, t } = useLocale();
  const { conversations, ready } = useConversations();
  async function handleDelete(id: string) {
    await deleteConversation(id);
    onDeleted(id);
  }
  if (!ready) return null;

  if (conversations.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-indigo-700">
        {t("Ainda não tens conversas guardadas. Envia a primeira pergunta! 💡")}
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      <h2 className="text-sm font-semibold text-indigo-800">
        {t("Conversas recentes")}
      </h2>
      {conversations.map((c) => (
        <div
          key={c.id}
          className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-3 py-2 shadow-sm"
        >
          <button
            onClick={() => onOpen(c)}
            className="min-w-0 flex-1 text-left"
            title={t("Abrir conversa")}
          >
            <span className="text-sm font-medium text-indigo-900">
              {SUBJECT_ICONS[c.subject] ?? "💡"}{" "}
              {SUBJECT_LABELS[c.subject] ?? "Geral"}
            </span>
            <span className="block truncate text-xs text-gray-500">
              {c.messages[c.messages.length - 1]?.text ?? "(sem mensagens)"}
            </span>
            <span className="text-[10px] text-gray-400">
              {formatTime(c.updatedAt, locale)}
            </span>
          </button>
          <button
            onClick={() => handleDelete(c.id)}
            aria-label={t("Apagar conversa")}
            title={t("Apagar conversa")}
            className="rounded-full bg-red-50 px-2 py-1 text-xs text-red-500 transition hover:bg-red-100"
          >
            🗑️
          </button>
        </div>
      ))}
    </div>
  );
}
