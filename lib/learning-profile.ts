export type TutorLocale = "pt-PT" | "pt-BR";
export type Country = "PT" | "BR";
export type Curriculum = "pt-nacional" | "br-bncc" | "international";
export type LearningProfile = {
  locale: TutorLocale;
  country: Country;
  schoolYear: number;
  curriculum: Curriculum;
};
export const DEFAULT_PROFILE: LearningProfile = {
  locale: "pt-PT",
  country: "PT",
  schoolYear: 7,
  curriculum: "pt-nacional",
};
// Pedidos de clientes antigos mantêm o contexto pedagógico anterior.
export const LEGACY_PROFILE: LearningProfile = {
  locale: "pt-BR",
  country: "BR",
  schoolYear: 7,
  curriculum: "br-bncc",
};
export const CURRICULA: Record<Curriculum, string> = {
  "pt-nacional": "Currículo nacional de Portugal",
  "br-bncc": "BNCC — Brasil",
  international: "Internacional / sem currículo nacional específico",
};
export function isLearningProfile(value: unknown): value is LearningProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  return (
    (p.locale === "pt-PT" || p.locale === "pt-BR") &&
    (p.country === "PT" || p.country === "BR") &&
    Number.isInteger(p.schoolYear) &&
    Number(p.schoolYear) >= 1 &&
    Number(p.schoolYear) <= 12 &&
    typeof p.curriculum === "string" &&
    Object.hasOwn(CURRICULA, p.curriculum) &&
    (p.curriculum === "international" ||
      p.curriculum === (p.country === "PT" ? "pt-nacional" : "br-bncc"))
  );
}
export function learningProfile(
  value: unknown,
  fallback = DEFAULT_PROFILE,
): LearningProfile {
  if (!isLearningProfile(value)) return { ...fallback };
  return {
    locale: value.locale,
    country: value.country,
    schoolYear: value.schoolYear,
    curriculum: value.curriculum,
  };
}
export function schoolYearLabel(year: number, country: Country): string {
  return country === "BR"
    ? year <= 9
      ? `${year}º ano do ensino fundamental`
      : `${year - 9}º ano do ensino médio`
    : `${year}º ano`;
}
export function profileDescription(profile: LearningProfile): string {
  return `${schoolYearLabel(profile.schoolYear, profile.country)} · ${profile.country === "PT" ? "Portugal" : "Brasil"}`;
}
