import { expect, test } from '@playwright/test';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function reactiveState(input: { correctionStatus?: 'pending' | 'invalidated' } = {}) {
  const correctionStatus = input.correctionStatus ?? 'pending';
  return {
    schemaVersion: 1,
    basedOnRevision: correctionStatus === 'pending' ? 1 : 2,
    projectionRevision: 1,
    actions: [{
      sourceActionId: 'action-annotate',
      action: {
        id: 'action-annotate',
        kind: 'annotate',
        targetId: 'manual-closing',
        text: 'A conferência concentra trabalho recorrente.',
        evidenceIds: [],
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
    correctionSuggestions: [{
      sourceCorrectionId: 'correction-one',
      correction: {
        id: 'correction-one',
        targetEvidenceId: 'fact-old',
        reason: 'O prazo informado parece ter mudado.',
        replacementValue: '3 dias',
        supportingTurnIds: ['request-first'],
      },
      status: correctionStatus,
      invalidatedReason: correctionStatus === 'invalidated' ? 'canonical-evidence-invalidated' : null,
    }],
    artifacts: [],
    scene: {
      composition: 'focus',
      focusIds: ['manual-closing'],
      comparisonIds: [],
      announcement: 'Conferência do fechamento em foco.',
    },
    choreography: {
      generation: 1,
      intentKey: 'closing-focus',
      cameraTargetIds: ['manual-closing'],
      interrupted: false,
    },
    recentSemanticKeys: ['closing-focus'],
  };
}

function acceptedResponse() {
  return {
    ok: true,
    idempotent: false,
    mode: 'agent',
    narration: 'O fechamento depende de uma conferência manual recorrente.',
    nextQuestion: 'Quantas vezes essa conferência acontece em um mês?',
    state: {
      sessionId: 'session-browser',
      canonicalRevision: 1,
      verifiedCalculations: [],
      reactiveState: reactiveState(),
    },
  };
}

test('ASK AI applies only accepted intelligence and sends no browser-authored Canon', async ({ page }) => {
  let releaseTurn = () => {};
  const gate = new Promise<void>((resolve) => { releaseTurn = resolve; });
  let turnPayload: Record<string, unknown> | null = null;
  let authorization: string | null = null;

  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-browser',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    const request = route.request();
    authorization = request.headers()['authorization'] ?? null;
    turnPayload = request.postDataJSON() as Record<string, unknown>;
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(acceptedResponse()),
    });
  });

  await page.goto('/');
  const input = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await input.fill('Todo mês conferimos o fechamento manualmente.');
  await input.press('Enter');

  await expect(page.getByText(/organizando o contexto e validando/i)).toBeVisible();
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'false');
  await expect(page.locator('.vxa-step')).toHaveCount(0);

  releaseTurn();

  await expect(page.getByText('O fechamento depende de uma conferência manual recorrente.')).toBeVisible();
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'true');
  await expect(page.locator('.vxa-step')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Conferência do fechamento/i })).toBeVisible();
  await expect(page.locator('.vxa-node[data-semantic-state="none"]')).toContainText('Conferência do fechamento');
  await expect(page.locator('.vxa-node')).toHaveAttribute('data-selected', 'true');

  expect(authorization).toBe(`Bearer ${TOKEN}`);
  expect(turnPayload).toBeTruthy();
  expect(Object.keys(turnPayload!).sort()).toEqual([
    'expectedRevision',
    'requestId',
    'sessionId',
    'text',
  ]);
  expect(turnPayload).not.toHaveProperty('canonical');
  expect(turnPayload).not.toHaveProperty('sessionToken');
});

test('hard validation failure leaves visitor text and S001 foundation untouched', async ({ page }) => {
  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-browser',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        code: 'AGENT_EXECUTION_FAILED',
        currentRevision: 1,
      }),
    });
  });

  await page.goto('/');
  const input = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await input.fill('Não apague meu relato se a validação falhar.');
  await input.press('Enter');

  await expect(page.getByText('Resposta não aplicada')).toBeVisible();
  await expect(input).toHaveValue('Não apague meu relato se a validação falhar.');
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'false');
  await expect(page.getByRole('button', { name: /Explorar um processo/i })).toBeVisible();
});

test('pending correction requires an explicit click and correction request carries no replacement authority', async ({ page }) => {
  let correctionCalls = 0;
  let correctionPayload: Record<string, unknown> = {};
  let releaseCorrectionResponse = () => {};
  const correctionResponseGate = new Promise<void>((resolve) => {
    releaseCorrectionResponse = resolve;
  });

  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-browser',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai/correction', async (route) => {
    correctionCalls += 1;
    correctionPayload = route.request().postDataJSON() as Record<string, unknown>;
    await correctionResponseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        idempotent: false,
        correctionId: 'correction-one',
        state: {
          sessionId: 'session-browser',
          canonicalRevision: 2,
          verifiedCalculations: [],
          reactiveState: reactiveState({ correctionStatus: 'invalidated' }),
        },
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(acceptedResponse()),
    });
  });

  await page.goto('/');
  const input = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await input.fill('O prazo mudou no fechamento.');
  await input.press('Enter');

  const apply = page.getByRole('button', { name: 'Aplicar correção' });
  await expect(apply).toBeVisible();
  expect(correctionCalls).toBe(0);

  await apply.click();
  await expect(page.getByText(/aplicando sua correção à verdade canônica/i)).toBeVisible();
  await expect(apply).toBeDisabled();
  await expect.poll(() => correctionCalls).toBe(1);

  expect(Object.keys(correctionPayload!).sort()).toEqual([
    'correctionId',
    'expectedRevision',
    'requestId',
    'sessionId',
  ]);
  expect(correctionPayload.correctionId).toBe('correction-one');
  expect(correctionPayload).not.toHaveProperty('replacementValue');
  expect(correctionPayload).not.toHaveProperty('targetEvidenceId');
  expect(correctionPayload).not.toHaveProperty('source');
  expect(correctionPayload).not.toHaveProperty('unit');

  releaseCorrectionResponse();
  await expect(page.getByRole('button', { name: 'Aplicar correção' })).toHaveCount(0);
});

test('malformed success response is rejected locally and cannot switch the Canvas into live mode', async ({ page }) => {
  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-browser',
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
        narration: 'Tentativa incompleta.',
        nextQuestion: null,
        state: { sessionId: 'session-browser', canonicalRevision: 999 },
      }),
    });
  });

  await page.goto('/');
  const input = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await input.fill('Teste um retorno malformado.');
  await input.press('Enter');

  await expect(page.getByText('Resposta não aplicada')).toBeVisible();
  await expect(input).toHaveValue('Teste um retorno malformado.');
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'false');
});

test('mobile ASK AI composer remains usable without horizontal page dependency', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByLabel('Sua rotina, gargalo ou pergunta')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await page.getByLabel('Sua rotina, gargalo ou pergunta').fill('Fechamento manual');
  await expect(page.getByRole('button', { name: 'Enviar para ASK AI' })).toBeEnabled();
});
