"use client";

import { useState } from "react";
import {
  clearApiKey,
  isNativeApp,
  saveSettings,
  setPin,
  type AppSettings,
  type TutorMode,
} from "@/lib/settings";
import { askTutorDirect } from "@/lib/gemini-client";
import UsageStats from "./UsageStats";
import {
  createPinHash,
  isValidPinFormat,
  verifyPin,
  PIN_MAX_LENGTH,
  PIN_MIN_LENGTH,
} from "@/lib/pin";

type Props = {
  settings: AppSettings;
  onClose: () => void;
  onSaved: (next: AppSettings) => void;
};

type View = "lock" | "settings";

export default function Settings({ settings, onClose, onSaved }: Props) {
  const hasPin = settings.pin !== null;
  const [view, setView] = useState<View>(hasPin ? "lock" : "settings");
  const [unlocked, setUnlocked] = useState<AppSettings>(settings);

  const [lockPin, setLockPin] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);

  const [mode, setMode] = useState<TutorMode>(settings.mode);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [serverUrl, setServerUrl] = useState(settings.serverUrl);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const [confirmPin, setConfirmPin] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "clear" | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [pinSectionOpen, setPinSectionOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!settings.pin) return;
    if (await verifyPin(lockPin, settings.pin)) {
      setUnlocked(settings);
      setView("settings");
      setLockError(null);
      setLockPin("");
    } else {
      setLockError("PIN incorreto. Tenta de novo.");
      setLockPin("");
    }
  }

  async function requestAction(action: "save" | "clear") {
    if (!hasPin) {
      if (action === "save") await doSave();
      else await doClear();
      return;
    }
    setPendingAction(action);
    setConfirmPin("");
    setConfirmError(null);
  }

  async function handleConfirmPin(e: React.FormEvent) {
    e.preventDefault();
    if (!settings.pin) return;
    if (await verifyPin(confirmPin, settings.pin)) {
      setPendingAction(null);
      setConfirmPin("");
      if (pendingAction === "save") await doSave();
      else await doClear();
    } else {
      setConfirmError("PIN incorreto.");
      setConfirmPin("");
    }
  }

  async function doSave() {
    const next: AppSettings = {
      mode: apiKey.trim() ? mode : "server",
      apiKey: apiKey.trim(),
      serverUrl: serverUrl.trim(),
      pin: unlocked.pin,
    };
    await saveSettings(next);
    setUnlocked(next);
    setStatus("Definições guardadas! ✅");
    onSaved(next);
  }

  async function doClear() {
    await clearApiKey();
    setApiKey("");
    setMode("server");
    const next: AppSettings = { mode: "server", apiKey: "", serverUrl, pin: unlocked.pin };
    setUnlocked(next);
    setStatus("Chave apagada do telemóvel. 🗑️");
    onSaved(next);
  }

  async function handleTest() {
    const native = isNativeApp();
    if (mode === "direct") {
      const key = apiKey.trim();
      if (!key) {
        setStatus("Escreve a chave primeiro.");
        return;
      }
      setTesting(true);
      setStatus(null);
      try {
        const reply = await askTutorDirect({
          apiKey: key,
          message: "Teste de ligação: responde só 'OK' se me estiveres a ouvir.",
          history: [],
          subject: "geral",
          images: [],
        });
        setStatus(`Ligação OK! ${reply.slice(0, 80)} ✅`);
      } catch (err) {
        setStatus(err instanceof Error ? `Falhou: ${err.message}` : "Falhou: erro desconhecido");
      } finally {
        setTesting(false);
      }
      return;
    }

    if (native && !serverUrl.trim()) {
      setStatus("No modo Servidor na app Android, indica o endereço do teu servidor (ex.: https://teu-site.com).");
      return;
    }
    const base = native ? serverUrl.trim().replace(/\/+$/, "") : "";
    setTesting(true);
    setStatus(null);
    try {
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Teste de ligação: responde só 'OK' se me estiveres a ouvir.",
          history: [],
          subject: "geral",
        }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setStatus("Ligação OK! O servidor respondeu. ✅");
      } else {
        setStatus(`Falhou: ${data.error ?? "erro desconhecido"}`);
      }
    } catch {
      setStatus("Falhou: sem ligação ao servidor. Verifica o endereço e a internet.");
    } finally {
      setTesting(false);
    }
  }

  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setPinStatus(null);
    if (hasPin && !(await verifyPin(currentPin, settings.pin!))) {
      setPinStatus("PIN atual incorreto.");
      return;
    }
    if (!isValidPinFormat(newPin)) {
      setPinStatus(`O PIN tem de ter ${PIN_MIN_LENGTH} a ${PIN_MAX_LENGTH} dígitos.`);
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinStatus("Os dois PINs não coincidem.");
      return;
    }
    const pinHash = await createPinHash(newPin);
    const next: AppSettings = { ...unlocked, pin: pinHash };
    await setPin(pinHash);
    await saveSettings(next);
    setUnlocked(next);
    onSaved(next);
    setPinStatus(hasPin ? "PIN alterado! ✅" : "PIN criado! A secção de definições ficou protegida. ✅");
    setNewPin("");
    setNewPinConfirm("");
    setCurrentPin("");
  }

  async function handleRemovePin(e: React.FormEvent) {
    e.preventDefault();
    setPinStatus(null);
    if (!settings.pin || !(await verifyPin(currentPin, settings.pin))) {
      setPinStatus("PIN incorreto.");
      return;
    }
    const next: AppSettings = { ...unlocked, pin: null };
    await setPin(null);
    await saveSettings(next);
    setUnlocked(next);
    onSaved(next);
    setPinStatus("PIN removido. A secção de definições ficou desprotegida.");
    setCurrentPin("");
  }

  if (view === "lock") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-indigo-900">🔒 Definições bloqueadas</h2>
            <button
              onClick={onClose}
              className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 hover:bg-gray-200"
            >
              ✕
            </button>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Introduce o PIN de pais para aceder às definições.
          </p>
          <form onSubmit={handleUnlock} className="flex flex-col gap-3">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={lockPin}
              onChange={(e) => setLockPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
              placeholder="PIN"
              className="rounded-xl border border-gray-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            {lockError && <p className="text-sm text-red-600">{lockError}</p>}
            <button
              type="submit"
              disabled={lockPin.length < PIN_MIN_LENGTH}
              className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Desbloquear
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-400">
            Esqueceste-te do PIN? A app não guarda o PIN em texto — terás de limpar os dados da
            app nas Definições do Android (ou reinstalá-la) e configurar de novo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-indigo-900">
            ⚙️ Definições {hasPin && <span className="text-sm">🔒</span>}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 px-3 py-1 text-gray-600 hover:bg-gray-200"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Secção para os pais. Configura como a app fala com a IA.
        </p>

        <div className="mb-4">
          <UsageStats />
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          Modo de ligação
        </label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("server")}
            className={`rounded-xl border-2 p-3 text-left text-sm transition ${
              mode === "server"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 hover:border-indigo-300"
            }`}
          >
            <div className="font-semibold text-indigo-900">🖥️ Servidor</div>
            <div className="text-xs text-gray-500">A app fala com um servidor teu</div>
          </button>
          <button
            onClick={() => setMode("direct")}
            className={`rounded-xl border-2 p-3 text-left text-sm transition ${
              mode === "direct"
                ? "border-indigo-600 bg-indigo-50"
                : "border-gray-200 hover:border-indigo-300"
            }`}
          >
            <div className="font-semibold text-indigo-900">📱 Esta app</div>
            <div className="text-xs text-gray-500">Funciona sozinha, sem servidor</div>
          </button>
        </div>

        {mode === "direct" ? (
          <>
            <div className="mb-4 rounded-xl bg-green-50 p-3 text-xs text-green-800">
              ✅ No modo &ldquo;Esta app&rdquo; não precisas de servidor nenhum — o telemóvel fala
              diretamente com a IA do Google. Só precisas de internet.
            </div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chave API do Google Gemini
            </label>
            <div className="mb-2 flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
              >
                {showKey ? "🙈" : "👁️"}
              </button>
            </div>
            <p className="mb-4 text-xs text-gray-400">
              A chave fica guardada neste telemóvel (protegida por PIN) e só é usada para falar
              com a API do Google. Obtém uma em aistudio.google.com/apikey
            </p>
            <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              ⚠️ Se o telemóvel for perdido ou roubado, a chave pode ser usada por outra pessoa.
              Se isso acontecer, apaga a chave no aistudio.google.com e cria outra.
            </div>
          </>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Endereço do servidor (opcional na app Android)
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://teu-servidor.com"
              className="mb-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <p className="mb-4 text-xs text-gray-400">
              {isNativeApp()
                ? "Na app Android, indica o endereço do computador/servidor onde corre o Tutor IA (ex.: http://192.168.1.42:3000). A chave API fica nesse servidor — mais seguro."
                : "No navegador, a app usa automaticamente o servidor onde está publicada. Só muda se quiseres ligar a outro servidor."}
            </p>
          </>
        )}

        {status && (
          <div className="mb-4 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
            {status}
          </div>
        )}

        {pendingAction && (
          <form
            onSubmit={handleConfirmPin}
            className="mb-4 flex flex-col gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3"
          >
            <p className="text-sm font-medium text-indigo-900">
              🔒 Confirma o PIN para {pendingAction === "save" ? "guardar as alterações" : "apagar a chave"}
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                inputMode="numeric"
                autoFocus
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
                placeholder="PIN"
                className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-xl bg-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
            {confirmError && <p className="text-sm text-red-600">{confirmError}</p>}
          </form>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => requestAction("save")}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Guardar
          </button>
          <button
            onClick={handleTest}
            disabled={testing || (mode === "direct" ? !apiKey.trim() : isNativeApp() && !serverUrl.trim())}
            className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
          >
            {testing ? "A testar..." : mode === "direct" ? "Testar chave" : "Testar servidor"}
          </button>
          {mode === "direct" && (
            <button
              onClick={() => requestAction("clear")}
              className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
            >
              Apagar chave
            </button>
          )}
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <button
            onClick={() => setPinSectionOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
          >
            <span>🔐 {hasPin ? "Alterar / remover PIN" : "Criar PIN de proteção"}</span>
            <span>{pinSectionOpen ? "▲" : "▼"}</span>
          </button>
          {pinSectionOpen && (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500">
                O PIN (4 a 6 dígitos) protege esta secção: é pedido para abrir as definições e
                para alterar ou apagar a chave API. Guardado apenas como hash (nunca em texto).
              </p>
              {hasPin && (
                <input
                  type="password"
                  inputMode="numeric"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
                  placeholder="PIN atual"
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              )}
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
                placeholder={hasPin ? "Novo PIN" : "Novo PIN (4-6 dígitos)"}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                inputMode="numeric"
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
                placeholder="Repetir novo PIN"
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              {pinStatus && <p className="text-sm text-indigo-700">{pinStatus}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSetPin}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {hasPin ? "Alterar PIN" : "Criar PIN"}
                </button>
                {hasPin && (
                  <button
                    onClick={handleRemovePin}
                    className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
                  >
                    Remover PIN
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
