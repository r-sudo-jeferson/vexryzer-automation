/**
 * Single application-owned executable-surface detector.
 *
 * Reused by `agent-intent.ts`, `artifact-intent.ts` and
 * `experience-validation.ts` so every model-controlled free-text leaf is
 * screened by the identical rule. Each caller keeps its own public error
 * mapping (all three report `EXECUTABLE_SURFACE` today).
 *
 * The pattern has no /g flag, so `containsExecutableSurface` is stateless
 * and safe to share across calls.
 */
export const EXECUTABLE_SURFACE_PATTERN =
  /(?:<\/?[A-Za-z][^>]*>|javascript\s*:|data\s*:\s*text\/html|import\s*\(|require\s*\(|(?:window|document|globalThis)\s*\.|=>|(?:^|\s)(?:body|html|:root|[.#][A-Za-z][\w-]*)\s*\{[^{}]{0,500}:[^{}]{0,500}\})/i;

export function containsExecutableSurface(value: string): boolean {
  return EXECUTABLE_SURFACE_PATTERN.test(value);
}
