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
