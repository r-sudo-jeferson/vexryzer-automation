import type { ProcessGraph } from './domain.ts';
export interface CanvasPoint { x:number; y:number }
const X_GAP=330; const Y_GAP=210; const COLUMNS=4;
export function layoutProcessGraph(graph:ProcessGraph):ReadonlyMap<string,CanvasPoint>{const positions=new Map<string,CanvasPoint>();graph.nodes.forEach((node,index)=>{const row=Math.floor(index/COLUMNS);const col=index%COLUMNS;const serpentineCol=row%2===0?col:COLUMNS-1-col;positions.set(node.id,{x:serpentineCol*X_GAP,y:row*Y_GAP});});return positions;}
