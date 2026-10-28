import type { PinHash } from "./pin";
import { GEMINI_KEY_PATTERN } from "./safety";
import {
  DEFAULT_PROFILE,
  learningProfile,
  type LearningProfile,
} from "./learning-profile";

export type AppSettings = {
  mode: "server" | "direct";
  apiKey: string;
  serverUrl: string;
  pin: PinHash | null;
  allowLocalHttp?: boolean;
  persistApiKey?: boolean;
  apiKeyIssue?: string;
  profile?: LearningProfile;
};
export const DEFAULT_SETTINGS: AppSettings = {
  mode: "server",
  apiKey: "",
  serverUrl: "",
  pin: null,
  allowLocalHttp: false,
  persistApiKey: false,
  profile: DEFAULT_PROFILE,
};
export interface SettingsStorage {
  native: boolean;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  getKey(persistent: boolean): Promise<string | null>;
  setKey(value: string, persistent: boolean): Promise<void>;
  removeKey(persistent: boolean): Promise<void>;
}

function decode(raw: string | null): AppSettings {
  if (raw === null) return { ...DEFAULT_SETTINGS };
  const value = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value.version !== undefined && value.version !== 2)
  )
    throw new Error(
      "Formato de definições inválido. Não foi possível abrir a configuração guardada.",
    );
  if (
    value.pin != null &&
    (typeof value.pin !== "object" ||
      typeof value.pin.hash !== "string" ||
      typeof value.pin.salt !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.pin.hash) ||
      value.pin.salt.length > 128)
  )
    throw new Error(
      "O PIN guardado não pôde ser lido. A configuração ficou bloqueada.",
    );
  return {
    mode: value.mode === "direct" ? "direct" : "server",
    apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
    serverUrl: typeof value.serverUrl === "string" ? value.serverUrl : "",
    pin: value.pin ?? null,
    profile: learningProfile(value.profile),
    allowLocalHttp: value.allowLocalHttp === true,
    persistApiKey:
      value.persistApiKey === true ||
      (value.persistApiKey === undefined && !!value.apiKey),
  };
}
function metadata(settings: AppSettings) {
  return JSON.stringify({
    version: 2,
    mode: settings.mode,
    serverUrl: settings.serverUrl,
    pin: settings.pin,
    allowLocalHttp: settings.allowLocalHttp === true,
    persistApiKey: settings.persistApiKey === true,
    profile: learningProfile(settings.profile),
  });
}

/** As operações são serializadas; só removemos a cópia antiga após leitura de confirmação. */
export function createSettingsStore(storage: SettingsStorage) {
  let cache: AppSettings | undefined;
  let queue = Promise.resolve();
  const run = <T>(work: () => Promise<T>) => {
    const result = queue.then(work);
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  };
  async function writeMetadata(settings: AppSettings) {
    const json = metadata(settings);
    await storage.write(json);
    if ((await storage.read()) !== json)
      throw new Error("Não foi possível confirmar a gravação das definições.");
  }
  async function writeKey(key: string, persistent: boolean) {
    if (!GEMINI_KEY_PATTERN.test(key))
      throw new Error(
        "A chave API não parece válida. Confirma a chave nas Definições.",
      );
    await storage.setKey(key, persistent);
    if ((await storage.getKey(persistent)) !== key)
      throw new Error(
        "Não foi possível confirmar a gravação da chave. A cópia antiga foi conservada.",
      );
  }
  async function load(): Promise<AppSettings> {
    if (cache) return cache;
    const settings = decode(await storage.read());
    try {
      const saved =
        (await storage.getKey(settings.persistApiKey === true)) ?? null;
      if (saved !== null) settings.apiKey = saved;
      else if (settings.apiKey)
        await writeKey(settings.apiKey, settings.persistApiKey === true);
      if (settings.apiKey && !GEMINI_KEY_PATTERN.test(settings.apiKey))
        throw new Error(
          "A chave guardada não parece válida. Configura-a novamente nas Definições.",
        );
      await writeMetadata(settings);
      if (!storage.native)
        await storage.removeKey(settings.persistApiKey !== true);
      cache = settings;
    } catch (error) {
      // O PIN e os restantes metadados continuam disponíveis; o erro do segredo nunca desbloqueia as definições.
      cache = {
        ...settings,
        apiKey: "",
        apiKeyIssue:
          error instanceof Error
            ? error.message
            : "Não consegui abrir a chave protegida. Configura-a novamente nas Definições.",
      };
    }
    return cache;
  }
  return {
    load: () => run(load),
    reload: () =>
      run(async () => {
        cache = undefined;
        return load();
      }),
    save: (settings: AppSettings) =>
      run(async () => {
        if (settings.apiKey)
          await writeKey(settings.apiKey, settings.persistApiKey === true);
        await writeMetadata(settings);
        if (!storage.native && settings.apiKey)
          await storage.removeKey(settings.persistApiKey !== true);
        cache = {
          ...settings,
          ...(settings.apiKey ? { apiKeyIssue: undefined } : {}),
        };
        return cache;
      }),
    clear: () =>
      run(async () => {
        const next: AppSettings = {
          ...(await load()),
          apiKey: "",
          apiKeyIssue: undefined,
          mode: "server",
        };
        await writeMetadata(next);
        await storage.removeKey(true);
        if (!storage.native) await storage.removeKey(false);
        if (
          (await storage.getKey(true)) !== null ||
          (!storage.native && (await storage.getKey(false)) !== null)
        )
          throw new Error("Não consegui confirmar a remoção da chave.");
        cache = next;
        return next;
      }),
    setPin: (pin: PinHash | null) =>
      run(async () => {
        const next = { ...(await load()), pin };
        // Atualizar o PIN não regrava nem remove um segredo que esteja indisponível.
        await writeMetadata(next);
        cache = next;
        return next;
      }),
  };
}
