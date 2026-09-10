import { useEffect } from 'react';
import { PERFORMANCE_BUDGETS } from './budgets.ts';

declare global {
  interface Window {
    __VXA_PERF__?: {
      longTasks: number;
      lastLongTaskMs: number;
      canvasCommits: number;
      viewportEvents: number;
      semanticBandChanges: number;
      cameraCommands: number;
      budgets: typeof PERFORMANCE_BUDGETS;
    };
  }
}

export function usePerformanceInstrumentation(): void {
  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get('perf') === '1';
    if (!enabled) {
      delete window.__VXA_PERF__;
      return;
    }

    window.__VXA_PERF__ = {
      longTasks: 0,
      lastLongTaskMs: 0,
      canvasCommits: 0,
      viewportEvents: 0,
      semanticBandChanges: 0,
      cameraCommands: 0,
      budgets: PERFORMANCE_BUDGETS,
    };

    if (!('PerformanceObserver' in window)) {
      return () => { delete window.__VXA_PERF__; };
    }

    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration >= PERFORMANCE_BUDGETS.longTaskMs && window.__VXA_PERF__) {
            window.__VXA_PERF__.longTasks += 1;
            window.__VXA_PERF__.lastLongTaskMs = entry.duration;
          }
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Unsupported entry type: browser GAUNTLET records capability separately.
    }

    return () => {
      observer?.disconnect();
      delete window.__VXA_PERF__;
    };
  }, []);
}
