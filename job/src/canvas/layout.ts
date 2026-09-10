import type { ProcessGraph } from './domain.ts';

export interface CanvasPoint { x: number; y: number }
export interface ProcessLayoutOptions { columns?: number }

const X_GAP = 330;
const Y_GAP = 210;
const DEFAULT_COLUMNS = 4;

export function layoutProcessGraph(
  graph: ProcessGraph,
  options: ProcessLayoutOptions = {},
): ReadonlyMap<string, CanvasPoint> {
  const columns = Math.max(1, Math.floor(options.columns ?? DEFAULT_COLUMNS));
  const positions = new Map<string, CanvasPoint>();
  graph.nodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const serpentineCol = row % 2 === 0 ? col : columns - 1 - col;
    positions.set(node.id, { x: serpentineCol * X_GAP, y: row * Y_GAP });
  });
  return positions;
}
