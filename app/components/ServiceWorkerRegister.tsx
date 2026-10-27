"use client";
import { useEffect, useRef, useState } from "react";
import { isNativeApp } from "@/lib/settings";
import { useUpdateBlocked } from "@/lib/update-state";

export default function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const requested = useRef(false);
  const blocked = useUpdateBlocked();
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      isNativeApp() ||
      !("serviceWorker" in navigator)
    )
      return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    let installing: ServiceWorker | null = null;
    const installed = () => {
      if (
        !disposed &&
        installing?.state === "installed" &&
        navigator.serviceWorker.controller
      )
        setWaiting(registration?.waiting ?? installing);
    };
    const found = () => {
      installing?.removeEventListener("statechange", installed);
      installing = registration?.installing ?? null;
      installing?.addEventListener("statechange", installed);
    };
    const changed = () => {
      if (requested.current) window.location.reload();
    };
    const message = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_BLOCKED") {
        requested.current = false;
        setUpdating(false);
        setError(
          "Fecha as outras janelas desta aplicação antes de atualizar, para conservar o trabalho em curso.",
        );
      }
    };
    navigator.serviceWorker.addEventListener("message", message);
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((value) => {
        if (disposed) return;
        registration = value;
        if (value.waiting && navigator.serviceWorker.controller)
          setWaiting(value.waiting);
        value.addEventListener("updatefound", found);
        found();
      })
      .catch(() => {
        /* A aplicação continua online; uma instalação incompleta não é anunciada como pronta. */
      });
    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", found);
      installing?.removeEventListener("statechange", installed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      navigator.serviceWorker.removeEventListener("message", message);
    };
  }, []);
  if (!waiting) return null;
  return (
    <aside
      aria-label="Atualização da aplicação"
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 bg-indigo-900 px-3 py-2 text-sm text-white"
    >
      <p>
        Há uma atualização disponível.{" "}
        {blocked
          ? "Conclui a ação em curso ou remove as fotos antes de atualizar."
          : "A pergunta escrita fica guardada nesta sessão."}
      </p>
      <button
        disabled={blocked || updating}
        className="rounded-lg bg-white px-3 py-2 font-semibold text-indigo-900 disabled:opacity-50"
        onClick={() => {
          if (blocked) return;
          try {
            requested.current = true;
            setUpdating(true);
            waiting.postMessage({ type: "SKIP_WAITING" });
          } catch {
            requested.current = false;
            setUpdating(false);
            setError("Não consegui atualizar. Tenta novamente.");
          }
        }}
      >
        {updating ? "A atualizar…" : "Atualizar"}
      </button>
      {error && <p role="alert">{error}</p>}
    </aside>
  );
}
