import { ARTIFACT_KINDS, type ArtifactKind } from './artifact-intent.ts';

export interface ArtifactSurfaceDescriptor {
  kind: ArtifactKind;
  surfaceId: `artifact-${string}`;
  landmarkLabel: string;
  description: string;
}

export const ARTIFACT_SURFACE_REGISTRY: Readonly<Record<ArtifactKind, Readonly<ArtifactSurfaceDescriptor>>> = Object.freeze({
  operational_object: Object.freeze({
    kind: 'operational_object',
    surfaceId: 'artifact-operational-object',
    landmarkLabel: 'Objeto operacional conceitual',
    description: 'Estrutura visual segura para representar uma ficha, controle ou objeto operacional sem executar código gerado.',
  }),
  data_import_preview: Object.freeze({
    kind: 'data_import_preview',
    surfaceId: 'artifact-data-import-preview',
    landmarkLabel: 'Prévia de importação e transformação',
    description: 'Prévia sem dados de anexos que demonstra etapas de entrada, validação e transformação de dados.',
  }),
  presentation: Object.freeze({
    kind: 'presentation',
    surfaceId: 'artifact-presentation',
    landmarkLabel: 'Apresentação executiva conceitual',
    description: 'Superfície semântica para narrativa executiva baseada apenas em evidência autorizada.',
  }),
  bi_dashboard: Object.freeze({
    kind: 'bi_dashboard',
    surfaceId: 'artifact-bi-dashboard',
    landmarkLabel: 'Painel de inteligência gerencial',
    description: 'Superfície de indicadores conceituais; números materiais exigem cálculo canônico válido.',
  }),
  training_module: Object.freeze({
    kind: 'training_module',
    surfaceId: 'artifact-training-module',
    landmarkLabel: 'Módulo de treinamento conceitual',
    description: 'Estrutura de capacitação e padronização operacional sem conteúdo executável fornecido pelo modelo.',
  }),
  workflow_concept: Object.freeze({
    kind: 'workflow_concept',
    surfaceId: 'artifact-workflow-concept',
    landmarkLabel: 'Conceito de fluxo operacional',
    description: 'Representação semântica de uma direção de processo ou automação, sem afirmar viabilidade não verificada.',
  }),
  prototype: Object.freeze({
    kind: 'prototype',
    surfaceId: 'artifact-prototype',
    landmarkLabel: 'Protótipo demonstrativo',
    description: 'Superfície explicitamente não produtiva para demonstração segura e isolada.',
  }),
});

if (Object.keys(ARTIFACT_SURFACE_REGISTRY).length !== ARTIFACT_KINDS.length) {
  throw new Error('artifact surface registry must cover every ArtifactKind');
}

export function resolveArtifactSurface(kind: ArtifactKind): Readonly<ArtifactSurfaceDescriptor> {
  return ARTIFACT_SURFACE_REGISTRY[kind];
}
