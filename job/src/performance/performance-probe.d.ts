import type { PERFORMANCE_BUDGETS } from './budgets.ts';

declare global {
  interface Window {
    __VXA_PERF__?: {
      longTasks: number;
      lastLongTaskMs: number;
      canvasCommits: number;
      viewportEvents: number;
      semanticBandChanges: number;
      cameraCommands: number;
      cameraInterruptions: number;
      cameraResizeRefits: number;
      budgets: typeof PERFORMANCE_BUDGETS;
    };
  }
}

export {};
