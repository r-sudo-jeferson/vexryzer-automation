import type { PERFORMANCE_BUDGETS } from './budgets.ts';

declare global {
  interface Window {
    __VXA_PERF__?: {
      lcpMs: number | null;
      inpMs: number | null;
      cls: number;
      longTasks: number;
      lastLongTaskMs: number;
      canvasCommits: number;
      viewportEvents: number;
      semanticBandChanges: number;
      cameraCommands: number;
      cameraInterruptions: number;
      cameraResizeRefits: number;
      askSubmissions: number;
      askAccepted: number;
      askRecoveries: number;
      askFailures: number;
      askLastVisualAckMs: number | null;
      askMaxVisualAckMs: number;
      supportedEntryTypes: readonly string[];
      observedEntryTypes: string[];
      budgets: typeof PERFORMANCE_BUDGETS;
    };
  }
}

export {};
