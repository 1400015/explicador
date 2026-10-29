"use client";

import { useState } from "react";
import { TutorError } from "@/lib/tutor-error";
import { apiErrorDiagnostic, friendlyApiError } from "@/lib/api-error";
import { version as appVersion } from "@/package.json";
import {
  clearApiKey,
  loadSettings,
  isNativeApp,
  saveSettings,
  setPin,
  type AppSettings,
  type TutorMode,
} from "@/lib/settings";
import { askTutor } from "@/lib/tutor-transport";
import { serverEndpoint } from "@/lib/transport-core";
import { verifyParentPin } from "@/lib/parent-pin";
import UsageStats from "./UsageStats";
import Modal from "./Modal";
import {
  createPinHash,
  isValidPinFormat,
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
  const [allowLocalHttp, setAllowLocalHttp] = useState(
    settings.allowLocalHttp === true,
  );
  const [persistApiKey, setPersistApiKey] = useState(
    settings.persistApiKey === true,
  );
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const [confirmPin, setConfirmPin] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | "clear" | null>(
    null,
  );
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [pinSectionOpen, setPinSectionOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [pinStatus, setPinStatus] = useState<string | null>(null);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (!(await verifyParentPin(lockPin))) {
        setLockError("PIN incorreto. Tenta de novo.");
        return;
      }
      setUnlocked(await loadSettings());
      setView("settings");
      setLockError(null);
    } catch (error) {
      setLockError(
        error instanceof Error
          ? error.message
          : "Não consegui verificar o PIN.",
      );
    } finally {
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
    try {
      if (!(await verifyParentPin(confirmPin))) {
        setConfirmError("PIN incorreto.");
        return;
      }
      setPendingAction(null);
      if (pendingAction === "save") await doSave();
      else await doClear();
    } catch (error) {
      setConfirmError(
        error instanceof Error
          ? error.message
          : "Não consegui verificar o PIN.",
      );
    } finally {
      setConfirmPin("");
    }
  }
  async function doSave() {
    try {
      if (mode === "direct" && !apiKey.trim())
        throw new Error("Indica a chave API para usar o modo Esta app.");
      if (mode === "server" && isNativeApp())
        serverEndpoint(serverUrl, allowLocalHttp);
      const current = await loadSettings();
      const next = await saveSettings({
        ...current,
        mode,
        apiKey: apiKey.trim(),
        serverUrl: isNativeApp() ? serverUrl.trim() : "",
        allowLocalHttp,
        persistApiKey,
      });
      setUnlocked(next);
      onSaved(next);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Não consegui guardar as definições. Tenta novamente.",
      );
    }
  }
  async function doClear() {
    try {
      const next = await clearApiKey();
      setApiKey("");
      setMode("server");
      setUnlocked(next);
      onSaved(next);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Não consegui apagar a chave. Tenta novamente.",
      );
    }
  }
  async function handleTest(diagnosticProbe = false) {
    if (testing || (diagnosticProbe && mode !== "direct")) return;
    setTesting(true);
    setStatus(null);
    try {
      const reply = await askTutor(
        { mode, apiKey, serverUrl, allowLocalHttp },
        {
          message: diagnosticProbe
            ? "Responde apenas OK."
            : "Teste de ligação: responde só OK se me estiveres a ouvir.",
          history: [],
          subject: "geral",
          images: [],
          diagnosticProbe,
        },
      );
      setStatus(diagnosticProbe ? reply : "Ligação OK! " + reply.slice(0, 80));
    } catch (error) {
      setStatus(
        (error instanceof TutorError
          ? error.message
          : friendlyApiError(error)) +
          " Referência: " +
          appVersion +
          "/" +
          (mode === "direct" ? "DIRECT" : "SERVER") +
          "/" +
          (error instanceof TutorError
            ? (error.diagnostic ?? "REQUEST_CHECK")
            : apiErrorDiagnostic(error)) +
          ".",
      );
    } finally {
      setTesting(false);
    }
  }
  async function handleSetPin(e: React.FormEvent) {
    e.preventDefault();
    setPinStatus(null);
    try {
      if (hasPin && !(await verifyParentPin(currentPin)))
        throw new Error("PIN atual incorreto.");
      if (!isValidPinFormat(newPin))
        throw new Error("O PIN tem de ter 4 a 6 dígitos.");
      if (newPin !== newPinConfirm)
        throw new Error("Os dois PINs não coincidem.");
      const next = await setPin(await createPinHash(newPin));
      setUnlocked(next);
      onSaved(next);
    } catch (error) {
      setPinStatus(
        error instanceof Error ? error.message : "Não consegui guardar o PIN.",
      );
    } finally {
      setNewPin("");
      setNewPinConfirm("");
      setCurrentPin("");
    }
  }
  async function handleRemovePin(e: React.FormEvent) {
    e.preventDefault();
    setPinStatus(null);
    try {
      if (!(await verifyParentPin(currentPin)))
        throw new Error("PIN incorreto.");
      const next = await setPin(null);
      setUnlocked(next);
      onSaved(next);
    } catch (error) {
      setPinStatus(
        error instanceof Error ? error.message : "Não consegui remover o PIN.",
      );
    } finally {
      setCurrentPin("");
    }
  }

  if (view === "lock") {
    return (
      <Modal title="Definições bloqueadas" onClose={onClose}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-indigo-900">
            🔒 Definições bloqueadas
          </h2>
          <button
            aria-label="Fechar definições"
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
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={lockPin}
            onChange={(e) =>
              setLockPin(
                e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
              )
            }
            aria-label="PIN"
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
          Esqueceste-te do PIN? A app não guarda o PIN em texto — terás de
          limpar os dados da app nas Definições do Android (ou reinstalá-la) e
          configurar de novo.
        </p>
      </Modal>
    );
  }

  return (
    <Modal title="Definições dos pais" onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-indigo-900">
          ⚙️ Definições {hasPin && <span className="text-sm">🔒</span>}
        </h2>
        <button
          aria-label="Fechar definições"
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
          <div className="text-xs text-gray-500">
            A app fala com um servidor teu
          </div>
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
          <div className="text-xs text-gray-500">
            Funciona sozinha, sem servidor
          </div>
        </button>
      </div>

      {mode === "direct" ? (
        <>
          <div className="mb-4 rounded-xl bg-green-50 p-3 text-xs text-green-800">
            ✅ No modo &ldquo;Esta app&rdquo; não precisas de servidor nenhum —
            o telemóvel fala diretamente com a IA do Google. Só precisas de
            internet.
          </div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Chave API do Google Gemini
          </label>
          <div className="mb-2 flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              aria-label="Chave API do Google Gemini"
              placeholder="AIza... ou AQ.Ab..."
              // Sem correção/sugestões: a chave é código, o teclado não deve alterar nada
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <button
              aria-label={showKey ? "Ocultar chave API" : "Mostrar chave API"}
              onClick={() => setShowKey((v) => !v)}
              className="rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-600 hover:bg-gray-200"
            >
              {showKey ? "🙈" : "👁️"}
            </button>
          </div>
          <p className="mb-4 text-xs text-gray-400">
            {isNativeApp()
              ? "No Android, a chave fica cifrada e protegida pelo Android Keystore. O PIN limita o acesso às definições."
              : "No navegador, a chave é usada diretamente na Google. Guardar só nesta sessão reduz a persistência; o PIN não cifra o armazenamento do browser."}{" "}
            Obtém uma chave em aistudio.google.com/apikey.
          </p>
          {!isNativeApp() && (
            <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={persistApiKey}
                onChange={(event) => setPersistApiKey(event.target.checked)}
              />
              Guardar a chave neste navegador entre sessões (armazenamento local
              sem encriptação)
            </label>
          )}
          <div className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ Se o telemóvel for perdido ou roubado, a chave pode ser usada por
            outra pessoa. Se isso acontecer, apaga a chave no
            aistudio.google.com e cria outra.
          </div>
        </>
      ) : isNativeApp() ? (
        <>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Endereço do servidor (opcional na app Android)
          </label>
          <input
            type="url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            aria-label="Endereço do servidor"
            placeholder="https://teu-servidor.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="mb-2 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
          <p className="mb-4 text-xs text-gray-400">
            {isNativeApp()
              ? "Na app Android, indica o endereço do computador/servidor onde corre o Tutor IA (ex.: http://192.168.1.42:3000). A chave API fica nesse servidor — mais seguro."
              : "No navegador, a app usa automaticamente o servidor onde está publicada. Só muda se quiseres ligar a outro servidor."}
          </p>
          <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowLocalHttp}
              onChange={(event) => setAllowLocalHttp(event.target.checked)}
            />
            Permitir HTTP apenas num servidor da rede local (as perguntas e
            fotos seguem sem encriptação)
          </label>
        </>
      ) : (
        <p className="mb-4 text-sm text-gray-600">
          O navegador usa o servidor onde esta aplicação está publicada. A chave
          pertence ao servidor.
        </p>
      )}

      {unlocked.apiKeyIssue && (
        <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm">
          {unlocked.apiKeyIssue}
        </p>
      )}
      {isNativeApp() && (
        <p className="mb-4 text-xs text-gray-500">
          As definições, chaves e conversas locais não participam de backups nem
          de transferência automática. Numa reinstalação, configura novamente a
          chave.
        </p>
      )}
      {status && (
        <div
          role="status"
          className="mb-4 break-words rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-800"
        >
          {status}
        </div>
      )}

      {pendingAction && (
        <form
          onSubmit={handleConfirmPin}
          className="mb-4 flex flex-col gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3"
        >
          <p className="text-sm font-medium text-indigo-900">
            🔒 Confirma o PIN para{" "}
            {pendingAction === "save"
              ? "guardar as alterações"
              : "apagar a chave"}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(
                  e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
                )
              }
              aria-label="PIN"
              placeholder="PIN"
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
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
          {confirmError && (
            <p className="text-sm text-red-600">{confirmError}</p>
          )}
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
          onClick={() => void handleTest()}
          disabled={
            testing ||
            (mode === "direct"
              ? !apiKey.trim()
              : isNativeApp() && !serverUrl.trim())
          }
          className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
        >
          {testing
            ? "A testar..."
            : mode === "direct"
              ? "Testar chave"
              : "Testar servidor"}
        </button>
        {mode === "direct" && (
          <button
            onClick={() => void handleTest(true)}
            disabled={testing || !apiKey.trim()}
            aria-describedby="connection-probe-description"
            className="rounded-xl bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200 disabled:opacity-50"
          >
            Diagnosticar ligação
          </button>
        )}
        {(mode === "direct" || unlocked.apiKeyIssue) && (
          <button
            onClick={() => requestAction("clear")}
            className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
          >
            Apagar chave
          </button>
        )}
      </div>

      {mode === "direct" && (
        <p
          id="connection-probe-description"
          className="mt-2 text-xs text-gray-500"
        >
          Pedido simples à API, sem dados da conversa.
        </p>
      )}

      <div className="mt-6 border-t border-gray-100 pt-4">
        <button
          onClick={() => setPinSectionOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          <span>
            🔐 {hasPin ? "Alterar / remover PIN" : "Criar PIN de proteção"}
          </span>
          <span>{pinSectionOpen ? "▲" : "▼"}</span>
        </button>
        {pinSectionOpen && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500">
              O PIN (4 a 6 dígitos) protege esta secção: é pedido para abrir as
              definições e para alterar ou apagar a chave API. Guardado apenas
              como hash (nunca em texto).
            </p>
            {hasPin && (
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={currentPin}
                onChange={(e) =>
                  setCurrentPin(
                    e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
                  )
                }
                aria-label="PIN atual"
                placeholder="PIN atual"
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            )}
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={newPin}
              onChange={(e) =>
                setNewPin(
                  e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
                )
              }
              aria-label="Novo PIN"
              placeholder={hasPin ? "Novo PIN" : "Novo PIN (4-6 dígitos)"}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={newPinConfirm}
              onChange={(e) =>
                setNewPinConfirm(
                  e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH),
                )
              }
              aria-label="Repetir novo PIN"
              placeholder="Repetir novo PIN"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            {pinStatus && (
              <p className="text-sm text-indigo-700">{pinStatus}</p>
            )}
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
    </Modal>
  );
}
