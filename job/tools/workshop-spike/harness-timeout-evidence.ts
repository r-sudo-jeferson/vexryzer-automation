export interface TimeoutEvidenceSummary {
  turnErrorCodes: readonly string[];
  turnEndReasons: readonly string[];
}

export function isMappedTimeoutEvidence(summary: TimeoutEvidenceSummary | undefined, thrown?: unknown): boolean {
  if (summary?.turnErrorCodes.some((code) => code === 'TIMEOUT')) return true;
  if (thrown instanceof Error) {
    return /timeout|timed?\s*out/i.test(`${thrown.name} ${thrown.message}`);
  }
  return false;
}
