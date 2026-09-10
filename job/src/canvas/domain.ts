export const PROCESS_NODE_KINDS = ['source','manual_action','transformation','system','output','evidence','effort','uncertainty','estimate','request_receipt'] as const;
export const PROVENANCE_VALUES = ['user_stated','ai_inferred','user_confirmed'] as const;
export type ProcessNodeKind = (typeof PROCESS_NODE_KINDS)[number];
export type Provenance = (typeof PROVENANCE_VALUES)[number];
export interface EffortModel { minutesPerOccurrence: number }
interface BaseProcessNodeModel { id: string; kind: ProcessNodeKind; label: string; summary: string; provenance: Provenance }
export interface SourceNodeModel extends BaseProcessNodeModel { kind: 'source' }
export interface ManualActionNodeModel extends BaseProcessNodeModel { kind: 'manual_action'; effort?: EffortModel }
export interface TransformationNodeModel extends BaseProcessNodeModel { kind: 'transformation' }
export interface SystemNodeModel extends BaseProcessNodeModel { kind: 'system'; systemName?: string }
export interface OutputNodeModel extends BaseProcessNodeModel { kind: 'output' }
export interface EvidenceNodeModel extends BaseProcessNodeModel { kind: 'evidence' }
export interface EffortNodeModel extends BaseProcessNodeModel { kind: 'effort'; effort?: EffortModel }
export interface UncertaintyNodeModel extends BaseProcessNodeModel { kind: 'uncertainty'; question?: string }
export interface EstimateNodeModel extends BaseProcessNodeModel { kind: 'estimate' }
export interface RequestReceiptNodeModel extends BaseProcessNodeModel { kind: 'request_receipt' }
export type ProcessNodeModel = SourceNodeModel | ManualActionNodeModel | TransformationNodeModel | SystemNodeModel | OutputNodeModel | EvidenceNodeModel | EffortNodeModel | UncertaintyNodeModel | EstimateNodeModel | RequestReceiptNodeModel;
export interface ProcessEdgeModel { id: string; source: string; target: string; label?: string }
export interface ProcessGraph { readonly nodes: readonly ProcessNodeModel[]; readonly edges: readonly ProcessEdgeModel[] }
export type GraphIssueCode = 'DUPLICATE_NODE_ID'|'DUPLICATE_EDGE_ID'|'INVALID_NODE_ID'|'INVALID_EDGE_ID'|'INVALID_NODE_LABEL'|'INVALID_NODE_SUMMARY'|'INVALID_EDGE_LABEL'|'INVALID_EFFORT'|'DANGLING_EDGE'|'SELF_LOOP'|'DUPLICATE_CONNECTION';
export interface GraphIssue { code: GraphIssueCode; message: string; subjectId: string }
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
export function createProcessGraph(nodes: readonly ProcessNodeModel[], edges: readonly ProcessEdgeModel[]): ProcessGraph { return Object.freeze({ nodes: Object.freeze(nodes.map((node) => Object.freeze({ ...node }))), edges: Object.freeze(edges.map((edge) => Object.freeze({ ...edge }))) }); }
export function validateProcessGraph(graph: ProcessGraph): GraphIssue[] {
  const issues: GraphIssue[]=[]; const nodeIds=new Set<string>(); const edgeIds=new Set<string>(); const directedConnections=new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) issues.push({code:'DUPLICATE_NODE_ID',message:`Duplicate node id: ${node.id}`,subjectId:node.id}); nodeIds.add(node.id);
    if (!ID_PATTERN.test(node.id)) issues.push({code:'INVALID_NODE_ID',message:`Invalid node id: ${node.id}`,subjectId:node.id});
    const label=node.label.trim(); if(label.length===0||label.length>120||CONTROL_CHARACTER_PATTERN.test(node.label)) issues.push({code:'INVALID_NODE_LABEL',message:`Invalid label for node: ${node.id}`,subjectId:node.id});
    const summary=node.summary.trim(); if(summary.length===0||summary.length>280||CONTROL_CHARACTER_PATTERN.test(node.summary)) issues.push({code:'INVALID_NODE_SUMMARY',message:`Invalid summary for node: ${node.id}`,subjectId:node.id});
    if ((node.kind==='manual_action'||node.kind==='effort')&&node.effort&&(!Number.isFinite(node.effort.minutesPerOccurrence)||node.effort.minutesPerOccurrence<=0)) issues.push({code:'INVALID_EFFORT',message:`Invalid effort for node: ${node.id}`,subjectId:node.id});
  }
  for (const edge of graph.edges) {
    if(edgeIds.has(edge.id)) issues.push({code:'DUPLICATE_EDGE_ID',message:`Duplicate edge id: ${edge.id}`,subjectId:edge.id}); edgeIds.add(edge.id);
    if(!ID_PATTERN.test(edge.id)) issues.push({code:'INVALID_EDGE_ID',message:`Invalid edge id: ${edge.id}`,subjectId:edge.id});
    if(edge.label !== undefined) { const label=edge.label.trim(); if(label.length===0||label.length>200||CONTROL_CHARACTER_PATTERN.test(edge.label)) issues.push({code:'INVALID_EDGE_LABEL',message:`Invalid label for edge: ${edge.id}`,subjectId:edge.id}); }
    if(edge.source===edge.target) issues.push({code:'SELF_LOOP',message:`Self-loop is not allowed: ${edge.id}`,subjectId:edge.id});
    if(!nodeIds.has(edge.source)||!nodeIds.has(edge.target)) issues.push({code:'DANGLING_EDGE',message:`Dangling edge: ${edge.id}`,subjectId:edge.id});
    const key=`${edge.source}->${edge.target}`; if(directedConnections.has(key)) issues.push({code:'DUPLICATE_CONNECTION',message:`Duplicate connection: ${key}`,subjectId:edge.id}); directedConnections.add(key);
  }
  return issues;
}
