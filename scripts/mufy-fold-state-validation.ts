/** Native named details are exclusive within one document, never across frames. */
export interface FoldObservation {
  open: boolean;
  exclusiveGroup?: string | null;
}
export function foldStateErrors(documents: readonly (readonly FoldObservation[])[], state: string): string[] {
  if (state === 'initial') return [];
  if (state === 'collapsed') return documents.some(cs => cs.some(c => c.open)) ? ['COLLAPSE_INCOMPLETE'] : [];
  if (!['expanded', 'reopened'].includes(state)) return ['UNKNOWN_FOLD_STATE'];
  for (const controls of documents) {
    const groups = new Map<string, FoldObservation[]>();
    for (const control of controls) {
      if (!control.exclusiveGroup) { if (!control.open) return ['EXPANSION_INCOMPLETE']; continue; }
      const group = groups.get(control.exclusiveGroup) ?? [];
      group.push(control); groups.set(control.exclusiveGroup, group);
    }
    if ([...groups.values()].some(group => group.filter(c => c.open).length !== 1)) return ['EXCLUSIVE_GROUP_INVALID'];
  }
  // This validates a snapshot only. Per-item interaction and visual proof are
  // still required by acceptance; a valid final group is not proof of clicks.
  return [];
}
