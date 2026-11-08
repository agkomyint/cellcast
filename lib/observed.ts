import type { CellData } from "./atlas";
export type GroupStats = {
  group: string;
  cells: number;
  mean: number;
  min: number;
  max: number;
  expressing: number;
  percentExpressing: number;
};
export type ObservedRun = {
  id: string;
  studyId: string;
  studyTitle: string;
  species: string;
  gene: string;
  unit: string;
  a: GroupStats;
  b: GroupStats;
  difference: number;
  time: string;
  source: string;
  grouping?: string;
  task?: "observed-comparison" | "observed-perturbation";
};
export function compareObserved(
  annotations: CellData,
  expression: CellData,
  groupA: string,
  groupB: string,
) {
  if (groupA === groupB) throw Error("Choose two different source groups.");
  const values = new Map(
    expression.points
      .filter((p) => Number.isFinite(p.expression))
      .map((p) => [p.id, p.expression!]),
  );
  const summarize = (group: string): GroupStats => {
    let cells = 0,
      sum = 0,
      min = Infinity,
      max = -Infinity,
      expressing = 0;
    for (const p of annotations.points) {
      if (p.group !== group) continue;
      const value = values.get(p.id);
      if (value === undefined) continue;
      cells++;
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
      if (value > 0) expressing++;
    }
    if (!cells)
      throw Error(`No observed expression values matched group ${group}.`);
    return {
      group,
      cells,
      mean: sum / cells,
      min,
      max,
      expressing,
      percentExpressing: (expressing / cells) * 100,
    };
  };
  const a = summarize(groupA),
    b = summarize(groupB);
  return { a, b, difference: b.mean - a.mean };
}
