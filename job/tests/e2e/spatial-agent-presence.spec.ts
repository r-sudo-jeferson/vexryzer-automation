import { expect, test } from '@playwright/test';
import { processFixtures } from '../../src/canvas/fixtures.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function standardFixtureMutations() {
  const graph = processFixtures.standard.graph;
  const nodes = graph.nodes.map((node) => ({
    sourceMutationId: `fixture-node-${node.id}`,
    mutation: { id: `fixture-node-${node.id}`, kind: 'upsert_node' as const, nodeId: node.id, label: node.label, summary: node.summary, evidenceIds: [] },
  }));
  const edges = graph.edges.map((edge) => ({
    sourceMutationId: `fixture-edge-${edge.id}`,
    mutation: { id: `fixture-edge-${edge.id}`, kind: 'upsert_relationship' as const, relationshipId: edge.id, sourceNodeId: edge.source, targetNodeId: edge.target, label: edge.label ?? 'Próxima etapa', evidenceIds: [] },
  }));
  return [...nodes, ...edges];
}

function acceptedSpatialResponse() {
  return {
    ok: true,
    idempotent: false,
    mode: 'agent',
    narration: 'A conferência manual concentra o fechamento.',
    nextQuestion: 'Quantas vezes isso acontece em um mês?',
    state: {
      sessionId: 'session-spatial-agent',
      canonicalRevision: 1,
      verifiedCalculations: [],
      opportunities: [],
      evidence: [],
      reactiveState: {
        schemaVersion: 1,
        basedOnRevision: 1,
        projectionRevision: 1,
        actions: [],
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
          announcement: 'Conferência do fechamento em foco.',
        },
        choreography: {
          generation: 1,
          intentKey: 'closing-focus',
          cameraTargetIds: ['manual-closing'],
          interrupted: false,
        },
        recentSemanticKeys: ['closing-focus'],
      },
    },
  };
}

function acceptedExistingFixtureResponse() {
  const response = acceptedSpatialResponse();
  return {
    ...response,
    state: {
      ...response.state,
      reactiveState: {
        ...response.state.reactiveState,
        processMutations: standardFixtureMutations(),
        scene: {
          composition: 'focus',
          focusIds: ['manual-review'],
          comparisonIds: [],
          announcement: 'Conferência manual em foco.',
        },
        choreography: {
          generation: 2,
          intentKey: 'manual-review-focus',
          cameraTargetIds: ['manual-review'],
          interrupted: false,
        },
      },
    },
  };
}

async function enterFocusedProcess(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  const firstStep = page.locator('.vxa-step').first();
  await firstStep.click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');
}

async function presenceIsClearOfProcessEvidence(page: import('@playwright/test').Page) {
  const presence = page.locator('.vxa-canvas .react-flow__node-agent-presence');
  const canvas = page.locator('.vxa-canvas');
  const processNodes = page.locator('.react-flow__node-process');
  const [agentBox, canvasBox] = await Promise.all([presence.boundingBox(), canvas.boundingBox()]);
  if (agentBox === null || canvasBox === null) return false;
  const insideCanvas = agentBox.x >= canvasBox.x
    && agentBox.y >= canvasBox.y
    && agentBox.x + agentBox.width <= canvasBox.x + canvasBox.width
    && agentBox.y + agentBox.height <= canvasBox.y + canvasBox.height;
  if (!insideCanvas) return false;
  for (let index = 0; index < await processNodes.count(); index += 1) {
    const processBox = await processNodes.nth(index).boundingBox();
    if (processBox === null) return false;
    const overlaps = agentBox.x < processBox.x + processBox.width
      && agentBox.x + agentBox.width > processBox.x
      && agentBox.y < processBox.y + processBox.height
      && agentBox.y + agentBox.height > processBox.y;
    if (overlaps) return false;
  }
  return true;
}

test('seller presence lives in Canvas world space and relocates without becoming the composer', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await page.goto('/');
  const presence = page.locator('.vxa-canvas .react-flow__node-agent-presence');
  await expect(presence).toBeVisible();
  await expect(presence.locator('.vxa-spatial-agent')).toHaveAttribute('data-phase', 'observing');
  await expect(presence.locator('textarea, button, input')).toHaveCount(0);
  const originTransform = await presence.getAttribute('style');

  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.locator('.vxa-step').first().click();

  await expect.poll(async () => presence.getAttribute('style')).not.toBe(originTransform);
  const process = page.locator('.react-flow__node-process').first();
  const [presenceBox, processBox] = await Promise.all([presence.boundingBox(), process.boundingBox()]);
  expect(presenceBox).not.toBeNull();
  expect(processBox).not.toBeNull();
  expect(presenceBox!.y).toBeLessThan(processBox!.y);

  const composer = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await expect(composer).toBeVisible();
  await expect(composer).toBeEnabled();
});

test('mobile keeps the living presence clear of every process node with distinct collision-aware placement', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();
  await page.goto('/');
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await page.locator('.vxa-step', { hasText: 'Conferência manual' }).click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');

  const presence = page.locator('.vxa-canvas .react-flow__node-agent-presence');
  await expect(presence).toBeVisible();
  await expect(page.locator('.vxa-node[data-agent-anchor="true"]')).toContainText('Conferência manual');
  await expect.poll(async () => presenceIsClearOfProcessEvidence(page)).toBe(true);

  const mutedNodes = page.locator('.vxa-node[data-muted="true"]');
  expect(await mutedNodes.count()).toBeGreaterThan(0);
  for (let index = 0; index < await mutedNodes.count(); index += 1) {
    await expect.poll(async () => mutedNodes.nth(index).evaluate((element) => getComputedStyle(element).opacity)).toBe('1');
  }
  await expect(page.getByLabel('Sua rotina, gargalo ou pergunta')).toBeVisible();
});

test('mobile asking voice stays clear of all process evidence on the four-node fixture', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();

  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-spatial-agent',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(acceptedExistingFixtureResponse()),
    });
  });

  await page.goto('/');
  const composer = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await composer.fill('A conferência manual concentra o fechamento.');
  await composer.press('Enter');

  const presence = page.locator('.vxa-canvas .react-flow__node-agent-presence');
  await expect(presence.locator('.vxa-spatial-agent')).toHaveAttribute('data-phase', 'asking');
  await expect(page.locator('.react-flow__node-process')).toHaveCount(4);
  await expect(page.locator('.react-flow__node-process[data-id="manual-review"] .vxa-node')).toHaveAttribute('data-agent-anchor', 'true');
  await expect.poll(async () => presenceIsClearOfProcessEvidence(page)).toBe(true);
});

test('accepted agent intent autonomously moves presence from origin to validated Canvas target', async ({ page }) => {

  let releaseTurn = () => {};
  const gate = new Promise<void>((resolve) => { releaseTurn = resolve; });

  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-spatial-agent',
        sessionToken: TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await gate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(acceptedSpatialResponse()),
    });
  });

  await page.goto('/');
  const presence = page.locator('.vxa-canvas .react-flow__node-agent-presence');
  await expect(presence).toBeVisible();
  await expect(presence.locator('.vxa-spatial-agent')).toHaveAttribute('data-phase', 'observing');
  const originStyle = await presence.getAttribute('style');

  const composer = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await composer.fill('Todo mês conferimos o fechamento manualmente.');
  await composer.press('Enter');

  await expect(presence.locator('.vxa-spatial-agent')).toHaveAttribute('data-phase', 'thinking');
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'origin');
  expect(await presence.getAttribute('style')).toBe(originStyle);

  releaseTurn();

  await expect(presence.locator('.vxa-spatial-agent')).toHaveAttribute('data-phase', 'asking');
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');
  await expect(page).toHaveURL(/#focus=manual-closing$/);
  await expect(page.locator('.react-flow__node-process[data-id="manual-closing"]')).toBeVisible();
  await expect.poll(async () => presence.getAttribute('style')).not.toBe(originStyle);

  const spatialVoice = presence.locator('.vxa-spatial-agent__voice');
  await expect(spatialVoice).toContainText('A conferência manual concentra o fechamento.');
  await expect(spatialVoice).toContainText('Quantas vezes isso acontece em um mês?');

  const target = page.locator('.react-flow__node-process[data-id="manual-closing"]');
  await expect(target.locator('.vxa-node')).toHaveAttribute('data-agent-anchor', 'true');
  await expect.poll(async () => presenceIsClearOfProcessEvidence(page)).toBe(true);

  const channelResponse = page.locator('.vxa-agent__response');
  await expect(channelResponse).toHaveClass(/vxa-visually-hidden/);
  const srOnly = await channelResponse.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      position: style.position,
      width: style.width,
      height: style.height,
      overflow: style.overflow,
      clip: style.clip,
    };
  });
  expect(srOnly).toMatchObject({
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
  });
  expect(srOnly.clip).not.toBe('auto');
});
