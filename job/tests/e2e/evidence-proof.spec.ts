import { expect, test } from '@playwright/test';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function proofState() {
  return {
    sessionId: 'session-proof',
    canonicalRevision: 1,
    verifiedCalculations: [{
      id: 'calc-e2e',
      resultValue: 44,
      resultUnit: 'hour/month',
      status: 'valid',
      expression: '220 ocorrencias * 12 min / 60',
      computedBy: 'application',
      basedOnRevision: 1,
      inputObservationIds: ['obs-e2e'],
    }],
    opportunities: [{
      id: 'opp-e2e',
      kind: 'rework_volume',
      summary: 'Medir o impacto do retrabalho no fechamento.',
      evidenceIds: ['obs-e2e'],
      missingInputs: ['taxa de retrabalho'],
      status: 'surfaced',
    }],
    evidence: [
      { id: 'obs-e2e', kind: 'observation', source: 'user', status: 'confirmed' },
    ],
    reactiveState: {
      schemaVersion: 1,
      basedOnRevision: 1,
      projectionRevision: 1,
      actions: [{
        sourceActionId: 'action-quant',
        action: {
          id: 'action-quant',
          kind: 'quantify',
          calculationId: 'calc-e2e',
          targetId: null,
          reason: 'Expor a capacidade verificada.',
        },
        status: 'active',
        invalidatedReason: null,
      }],
      processMutations: [{
        sourceMutationId: 'mutation-closing',
        mutation: {
          id: 'mutation-closing',
          kind: 'upsert_node',
          nodeId: 'manual-closing',
          label: 'Conferência do fechamento',
          summary: 'Hipótese visual derivada do relato atual.',
          evidenceIds: [],
        },
      }],
      correctionSuggestions: [],
      artifacts: [],
      scene: {
        composition: 'focus',
        focusIds: ['manual-closing'],
        comparisonIds: [],
        announcement: 'Capacidade verificada em foco.',
      },
      choreography: {
        generation: 1,
        intentKey: 'closing-proof',
        cameraTargetIds: ['manual-closing'],
        interrupted: false,
      },
      recentSemanticKeys: ['closing-proof'],
    },
  };
}

test('Canvas proof surface shows verified value with lineage and non-numeric opportunity', async ({ page }) => {
  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-proof',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        idempotent: false,
        mode: 'agent',
        narration: 'A conferência manual consome capacidade verificada.',
        nextQuestion: 'Qual é a taxa de retrabalho?',
        state: proofState(),
      }),
    });
  });

  await page.goto('/');
  await page.getByLabel('Sua rotina, gargalo ou pergunta').fill('Três pessoas conferem lançamentos todo mês.');
  await page.getByRole('button', { name: 'Enviar para ASK AI' }).click();

  const canvas = page.locator('.vxa-canvas');
  const valueProof = canvas.locator('.react-flow__node-value-proof .vxa-value-proof');
  const opportunityProof = canvas.locator('.react-flow__node-opportunity-proof .vxa-opportunity-proof');

  await expect(page.getByRole('region', { name: 'Evidência e valor verificados' })).toHaveCount(0);
  await expect(valueProof).toBeVisible();
  await expect(valueProof).toBeInViewport();
  await expect(valueProof).toContainText('44');
  await expect(valueProof).toContainText('h/mês');
  await expect(valueProof).toContainText('Cálculo determinístico da aplicação');
  await expect(valueProof).toContainText('220 ocorrencias * 12 min / 60');
  await expect(valueProof).toHaveAttribute(
    'aria-label',
    /Cálculo determinístico da aplicação.*220 ocorrencias \* 12 min \/ 60/,
  );

  await expect(opportunityProof).toBeVisible();
  await expect(opportunityProof).toBeInViewport();
  await expect(opportunityProof).toContainText('Retrabalho');
  await expect(opportunityProof).toContainText('Sem valor calculado');
  await expect(opportunityProof).toContainText('taxa de retrabalho');
  await expect(opportunityProof).not.toContainText('44');
  await expect(opportunityProof).toHaveAttribute(
    'aria-label',
    /Sem valor calculado.*taxa de retrabalho/,
  );
});
