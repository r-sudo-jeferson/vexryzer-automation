import { useEffect } from 'react';
import { PERFORMANCE_BUDGETS } from './budgets.ts';

type LayoutShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };
type InteractionEntry = PerformanceEntry & { duration: number; interactionId: number };
type ObserverOptions = PerformanceObserverInit & { durationThreshold?: number };

export function usePerformanceInstrumentation(): void {
  useEffect(() => {
    const enabled = new URLSearchParams(window.location.search).get('perf') === '1';
    if (!enabled) {
      delete window.__VXA_PERF__;
      return;
    }

    const performanceObserverAvailable = 'PerformanceObserver' in window;
    const supportedEntryTypes = performanceObserverAvailable ? [...(PerformanceObserver.supportedEntryTypes ?? [])] : [];
    const observedEntryTypes: string[] = [];
    window.__VXA_PERF__ = {
      lcpMs: null,
      inpMs: null,
      cls: 0,
      longTasks: 0,
      lastLongTaskMs: 0,
      canvasCommits: 0,
      viewportEvents: 0,
      semanticBandChanges: 0,
      cameraCommands: 0,
      cameraInterruptions: 0,
      cameraResizeRefits: 0,
      askSubmissions: 0,
      askAccepted: 0,
      askRecoveries: 0,
      askFailures: 0,
      askLastVisualAckMs: null,
      askMaxVisualAckMs: 0,
      supportedEntryTypes,
      observedEntryTypes,
      budgets: PERFORMANCE_BUDGETS,
    };

    if (!performanceObserverAvailable) {
      return () => { delete window.__VXA_PERF__; };
    }

    const observers: PerformanceObserver[] = [];
    const interactionDurations = new Map<number, number>();

    const observe = (type: string, callback: PerformanceObserverCallback, options: ObserverOptions) => {
      if (!supportedEntryTypes.includes(type)) return;
      try {
        const observer = new PerformanceObserver(callback);
        observer.observe(options);
        observers.push(observer);
        observedEntryTypes.push(type);
      } catch {
        // Browser GAUNTLET records supportedEntryTypes so unavailable metrics remain explicit.
      }
    };

    observe('longtask', (list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= PERFORMANCE_BUDGETS.longTaskMs && window.__VXA_PERF__) {
          window.__VXA_PERF__.longTasks += 1;
          window.__VXA_PERF__.lastLongTaskMs = Math.max(window.__VXA_PERF__.lastLongTaskMs, entry.duration);
        }
      }
    }, { type: 'longtask', buffered: true });

    observe('largest-contentful-paint', (list) => {
      const probe = window.__VXA_PERF__;
      if (!probe) return;
      for (const entry of list.getEntries()) {
        probe.lcpMs = Math.max(probe.lcpMs ?? 0, entry.startTime);
      }
    }, { type: 'largest-contentful-paint', buffered: true });

    observe('layout-shift', (list) => {
      const probe = window.__VXA_PERF__;
      if (!probe) return;
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput && Number.isFinite(entry.value)) probe.cls += entry.value;
      }
    }, { type: 'layout-shift', buffered: true });

    const recordInteractions: PerformanceObserverCallback = (list) => {
      const probe = window.__VXA_PERF__;
      if (!probe) return;
      for (const entry of list.getEntries() as InteractionEntry[]) {
        if (!Number.isFinite(entry.duration)) continue;
        const interactionId = entry.interactionId || (entry.entryType === 'first-input' ? -1 : 0);
        if (!interactionId) continue;
        interactionDurations.set(interactionId, Math.max(interactionDurations.get(interactionId) ?? 0, entry.duration));
      }
      if (interactionDurations.size > 0) probe.inpMs = Math.max(...interactionDurations.values());
    };

    observe('first-input', recordInteractions, { type: 'first-input', buffered: true });
    observe('event', recordInteractions, { type: 'event', buffered: true, durationThreshold: 16 });

    return () => {
      for (const observer of observers) observer.disconnect();
      delete window.__VXA_PERF__;
    };
  }, []);
}
