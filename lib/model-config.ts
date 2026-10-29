export function modelName(value: string): string {
  if (!/^gemini-[a-zA-Z0-9._-]{1,90}$/.test(value))
    throw new Error("Nome de modelo Gemini inválido na configuração.");
  return value;
}
export function thinkingLevel(value: string): "LOW" | "MEDIUM" | "HIGH" {
  if (value !== "LOW" && value !== "MEDIUM" && value !== "HIGH")
    throw new Error("Nível de raciocínio inválido na configuração.");
  return value;
}

export const DIRECT_MODEL_OPTIONS = [
  { value: "auto", label: "Automático" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite" },
  { value: "gemini-flash-lite-latest", label: "Flash Lite Latest" },
  { value: "gemini-flash-latest", label: "Flash Latest" },
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { value: "gemini-3.8-flash", label: "Gemini 3.8 Flash" },
] as const;

export type DirectModel = (typeof DIRECT_MODEL_OPTIONS)[number]["value"];

export function directModelChoice(value: unknown): DirectModel {
  return (
    DIRECT_MODEL_OPTIONS.find((option) => option.value === value)?.value ??
    "auto"
  );
}

export function directModelTargets(
  value: unknown,
  primary: string,
  fallback: string,
): { model: string; fallback: string } {
  const choice = directModelChoice(value);
  if (choice === "auto")
    return { model: modelName(primary), fallback: modelName(fallback) };
  return { model: choice, fallback: choice };
}

export function modelThinking(
  model: string,
  level: "LOW" | "MEDIUM" | "HIGH",
):
  | { thinkingLevel: "LOW" | "MEDIUM" | "HIGH"; includeThoughts: false }
  | undefined {
  if (model === "gemini-flash-latest" || model === "gemini-flash-lite-latest")
    return undefined;
  return { thinkingLevel: level, includeThoughts: false };
}
