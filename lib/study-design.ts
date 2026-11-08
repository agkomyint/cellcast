import type { Study } from "./atlas";
export type StudyDesign = "chemical" | "genetic" | "stress" | "atlas";
// These source condition groups were retrieved and exercised end-to-end.
const verified = new Set(["E-ENAD-30", "E-GEOD-123013", "E-MTAB-6075"]);
export function studyDesign(s: Study): {
  type: StudyDesign;
  label: string;
  verified: boolean;
  hasConditions: boolean;
} {
  const factors = s.factors.join(" ").toLowerCase();
  const type: StudyDesign = /genotype/.test(factors)
    ? "genetic"
    : /compound|dose|treatment/.test(factors)
      ? "chemical"
      : /stress|stimulus|phenotype/.test(factors)
        ? "stress"
        : "atlas";
  return {
    type,
    label:
      type === "genetic"
        ? "Genetic conditions"
        : type === "chemical"
          ? "Chemical treatment"
          : type === "stress"
            ? "Stress / stimulus"
            : "Cell atlas",
    verified: verified.has(s.id),
    hasConditions: type !== "atlas",
  };
}
