import type { Scaffold } from "./schema";

export function findScaffold(
  scaffolds: Scaffold[],
  id: string
): Scaffold | undefined {
  for (const scaffold of scaffolds) {
    if (scaffold.id === id) return scaffold;
    const found = findScaffold(scaffold.scaffolds ?? [], id);
    if (found) return found;
  }
  return undefined;
}
