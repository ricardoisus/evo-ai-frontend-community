const countKey = (id: string) => `pipeline-stage-count:${id}`;

export function rememberStageCount(id: string, count: number) {
  try { sessionStorage.setItem(countKey(id), String(count)); } catch { /* Storage may be disabled. */ }
}

export function previousStageCount(id?: string) {
  try {
    const stored = id ? sessionStorage.getItem(countKey(id)) : null;
    const count = stored === null ? NaN : Number(stored);
    return Number.isInteger(count) && count >= 0 && count <= 100 ? count : 3;
  } catch { return 3; }
}
