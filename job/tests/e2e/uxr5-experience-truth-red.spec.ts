import { expect, test, type Page } from '@playwright/test';

/**
 * UXR5-00 Experience Truth RED gates — GitHub issue #41.
 * Baseline: c791ae6e15502eecf41370cae2d0b907c9632f09
 * (staging/vxa-s002-agent-led-accounting-seller).
 *
 * Every test below must RED on the baseline for a legitimate missing
 * product capability, never for a harness error. Passing asserts inside a
 * RED test prove the harness itself works; the failing assert names the
 * missing capability.
 *
 * Arrival/mobile gates use a structural world-context oracle: viewport
 * boundaries (0 / innerHeight, boolean intersection) plus DOM containment
 * of the invitation/composer inside the closest semantic world region that
 * contains the Canvas — never geometric overlap, percentages, overlap
 * ratios, or fixed pixel thresholds. Adjacent/docked content inside the
 * same world region is contextual; a separate co-primary page section
 * (baseline `.vxa-intro` vs `.vxa-stage`) is not. Conductor vocabulary
 * (REST…DEFER…COMPOSE_DECISION) is grounded in #25 §4 and the UXR5 pure
 * RED contract, not invented here. The ASK-turn shape reuses the
 * deterministic harness proven in tests/e2e/ask-ai.spec.ts; interruption
 * semantics reuse the mature probes proven in
 * tests/e2e/camera-interruption.spec.ts and
 * tests/e2e/canvas-interactions.spec.ts (real mouse pan/drag, viewport
 * matrix capture, multi-sample settle windows).
 */

const ASK_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';
const UXR5_MUTATION_NODE_ID = 'manual-closing';
const UXR5_NARRATION = 'O fechamento depende de uma conferência manual recorrente.';
const UXR5_QUESTION = 'Quantas vezes essa conferência acontece em um mês?';

function uxr5AcceptedResponse() {
  return {
    ok: true,
    idempotent: false,
    mode: 'agent',
    narration: UXR5_NARRATION,
    nextQuestion: UXR5_QUESTION,
    state: {
      sessionId: 'session-uxr5-truth',
      canonicalRevision: 1,
      verifiedCalculations: [],
      opportunities: [],
      evidence: [],
      reactiveState: {
        schemaVersion: 1,
        basedOnRevision: 1,
        projectionRevision: 1,
        actions: [{
          sourceActionId: 'action-annotate',
          action: {
            id: 'action-annotate',
            kind: 'annotate',
            targetId: UXR5_MUTATION_NODE_ID,
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
            nodeId: UXR5_MUTATION_NODE_ID,
            label: 'Conferência do fechamento',
            summary: 'Hipótese visual derivada do relato atual.',
            evidenceIds: [],
          },
        }],
        correctionSuggestions: [],
        artifacts: [],
        scene: {
          composition: 'focus',
          focusIds: [UXR5_MUTATION_NODE_ID],
          comparisonIds: [],
          announcement: 'Conferência do fechamento em foco.',
        },
        choreography: {
          generation: 1,
          intentKey: 'closing-focus',
          cameraTargetIds: [UXR5_MUTATION_NODE_ID],
          interrupted: false,
        },
        recentSemanticKeys: ['closing-focus'],
      },
    },
  };
}

async function mockUxr5AskTurn(page: Page): Promise<void> {
  await page.route('**/api/ask-ai/session', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        sessionId: 'session-uxr5-truth',
        sessionToken: ASK_TOKEN,
        revision: 0,
      }),
    });
  });
  await page.route('**/api/ask-ai', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(uxr5AcceptedResponse()),
    });
  });
}

async function submitUxr5AskTurn(page: Page): Promise<void> {
  const composer = page.getByLabel('Sua rotina, gargalo ou pergunta');
  await composer.fill('Todo mês conferimos o fechamento manualmente.');
  await composer.press('Enter');
}

async function enterWorld(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.getByRole('button', { name: /Explorar um processo/i }).click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'process');
}

interface WorldContextGeometry {
  viewportHeight: number;
  canvasTop: number;
  canvasBottom: number;
  canvasVisibleHeight: number;
  canvasWorldFound: boolean;
  canvasWorldTag: string;
  composerVisible: boolean;
  composerSharesWorld: boolean;
  headingVisible: boolean;
  headingSharesWorld: boolean;
  headingText: string;
}

async function readWorldContext(page: Page): Promise<WorldContextGeometry> {
  return page.evaluate(() => {
    const viewportHeight = window.innerHeight;
    const canvas = document.querySelector('.vxa-canvas');
    const composer = document.querySelector('.vxa-agent');
    const heading = document.querySelector('h1');
    const canvasRect = canvas?.getBoundingClientRect() ?? null;
    // Closest semantic world region containing an element: a section or
    // an explicit region first, the page primary only as a fallback. The
    // Canvas world is whatever such region contains the Canvas; invitation
    // and composer are contextual when they live inside that same region —
    // adjacent/docked siblings count, a separate co-primary page section
    // does not. No literal `.vxa-canvas` ancestry is required.
    const worldOf = (element: Element | null): Element | null => {
      if (element === null) return null;
      return element.closest('[data-spatial-world], [data-world-region], [role="region"]')
        ?? element.closest('section')
        ?? element.closest('main');
    };
    const isVisible = (rect: DOMRect | null): boolean => rect !== null
      && rect.bottom > 0
      && rect.top < viewportHeight
      && rect.width > 0
      && rect.height > 0;
    const canvasWorld = worldOf(canvas);
    const describe = (element: Element | null): string => {
      if (element === null) return 'none';
      const classes = element.getAttribute('class') ?? '';
      const firstClass = classes.split(/\s+/).filter((token) => token.length > 0)[0] ?? '';
      return firstClass.length > 0
        ? `${element.tagName.toLowerCase()}.${firstClass}`
        : element.tagName.toLowerCase();
    };
    return {
      viewportHeight,
      canvasTop: canvasRect?.top ?? Number.POSITIVE_INFINITY,
      canvasBottom: canvasRect?.bottom ?? Number.NEGATIVE_INFINITY,
      canvasVisibleHeight: canvasRect === null
        ? 0
        : Math.max(0, Math.min(canvasRect.bottom, viewportHeight) - Math.max(canvasRect.top, 0)),
      canvasWorldFound: canvasWorld !== null,
      canvasWorldTag: describe(canvasWorld),
      composerVisible: isVisible(composer?.getBoundingClientRect() ?? null),
      composerSharesWorld: canvasWorld !== null && composer !== null && canvasWorld.contains(composer),
      headingVisible: isVisible(heading?.getBoundingClientRect() ?? null),
      headingSharesWorld: canvasWorld !== null && heading !== null && canvasWorld.contains(heading),
      headingText: (heading?.textContent ?? '').trim().slice(0, 160),
    };
  });
}

interface ViewportMatrix {
  x: number;
  y: number;
  zoom: number;
}

interface PanePoint {
  x: number;
  y: number;
}

async function readViewportMatrix(page: Page): Promise<ViewportMatrix> {
  return page.locator('.react-flow__viewport').evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return { x: matrix.m41, y: matrix.m42, zoom: matrix.a };
  });
}

async function readCameraCommands(page: Page): Promise<number> {
  return page.evaluate(() => window.__VXA_PERF__?.cameraCommands ?? 0);
}

async function findPanePoint(page: Page, delta: PanePoint = { x: 0, y: 0 }): Promise<PanePoint> {
  const pane = page.locator('.react-flow__pane');
  await pane.scrollIntoViewIfNeeded();
  const point = await pane.evaluate((element, requestedDelta) => {
    const rect = element.getBoundingClientRect();
    const fractions = [0.12, 0.25, 0.4, 0.6, 0.75, 0.88];
    const guard = 36;
    for (const yFraction of fractions) {
      for (const xFraction of fractions) {
        const x = rect.left + rect.width * xFraction;
        const y = rect.top + rect.height * yFraction;
        const endX = x + requestedDelta.x;
        const endY = y + requestedDelta.y;
        if (x <= guard || y <= guard || x >= innerWidth - guard || y >= innerHeight - guard) continue;
        if (endX <= guard || endY <= guard || endX >= innerWidth - guard || endY >= innerHeight - guard) continue;
        const probes = [[0, 0], [28, 0], [-28, 0], [0, 28], [0, -28]] as const;
        if (probes.every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) === element)) return { x, y };
      }
    }
    return null;
  }, delta);
  expect(point, 'expected a visible empty React Flow pane hit target').toBeTruthy();
  return point!;
}

async function mousePanViewport(page: Page, delta: PanePoint): Promise<void> {
  const start = await findPanePoint(page, delta);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 6 });
  await page.mouse.up();
}

// Multi-sample settle proof (mature tolerances from
// canvas-interactions.spec.ts): every sample across the window must hold
// the user-placed viewport and issue no new camera command. This proves
// stability instead of sleeping for a magic moment.
async function expectNoReclaimDuringSettle(
  page: Page,
  viewport: ViewportMatrix,
  commands: number,
  samples = 6,
  intervalMs = 80,
): Promise<void> {
  for (let sample = 0; sample < samples; sample += 1) {
    await page.waitForTimeout(intervalMs);
    const current = await readViewportMatrix(page);
    expect(Math.abs(current.x - viewport.x), `viewport x snapped back during settle window (sample ${sample})`).toBeLessThan(0.6);
    expect(Math.abs(current.y - viewport.y), `viewport y snapped back during settle window (sample ${sample})`).toBeLessThan(0.6);
    expect(Math.abs(current.zoom - viewport.zoom), `viewport zoom snapped back during settle window (sample ${sample})`).toBeLessThan(0.005);
    expect(
      await readCameraCommands(page),
      `RED OWNERSHIP: agent reclaimed the camera without a new semantic intent (sample ${sample})`,
    ).toBe(commands);
  }
}

const CONDUCTOR_SEMANTIC_STATES = [
  'REST', 'ORIENT', 'POINT', 'ACQUIRE', 'HOLD', 'MOVE', 'PLACE',
  'CONNECT', 'GROUP', 'UNGROUP', 'REVEAL', 'COMPARE', 'QUANTIFY',
  'QUESTION', 'CONFIRM', 'CORRECT', 'DEFER', 'RECOVER', 'COMPOSE_DECISION',
];

const MANIPULATION_CAPABLE_STATES = [
  'REVEAL', 'ACQUIRE', 'HOLD', 'MOVE', 'PLACE', 'CONNECT', 'GROUP',
];

const OUTLINE_SEMANTIC_ROLES = [
  'region', 'application', 'group', 'complementary', 'navigation', 'log',
];

test('ARRIVE RED: the Infinite Canvas is the world, not a boxed secondary section', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await page.goto('/');
  const geometry = await readWorldContext(page);

  // Harness proof: the Canvas surface exists inside a semantic world
  // region and meets the first viewport.
  expect(geometry.canvasWorldFound, 'harness: Canvas sits in no semantic world region').toBe(true);
  expect(geometry.canvasTop, 'harness: Canvas never reaches the first viewport').toBeLessThan(geometry.viewportHeight);
  expect(geometry.canvasVisibleHeight, 'harness: Canvas has no visible area in the first viewport').toBeGreaterThan(0);
  expect(geometry.headingVisible, 'harness: no visible invitation heading on arrival').toBe(true);

  // RED on baseline: the page-first hero heading lives in `.vxa-intro`,
  // a separate co-primary page section outside the Canvas world region
  // (`.vxa-stage`), so the Canvas arrives as a boxed section below a
  // marketing page instead of being the world. A valid world overlay
  // sibling inside the same world region stays GREEN: the oracle judges
  // shared world-region containment, not `.vxa-canvas` ancestry.
  expect(
    geometry.headingSharesWorld,
    `RED ARRIVE: invitation heading ${JSON.stringify(geometry.headingText)} lives outside the ` +
    `Canvas world region (${geometry.canvasWorldTag}) — page-first structure still owns the ` +
    'first viewport instead of a world-first Canvas arrival (owner: UXR5 ARRIVE).',
  ).toBe(true);
});

test('ARRIVE RED: the composer is contextual to the world instead of a co-primary page panel', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await page.goto('/');
  await expect(page.getByLabel('Sua rotina, gargalo ou pergunta')).toBeVisible();
  const geometry = await readWorldContext(page);

  // Harness proof: the composer exists and is visible on arrival.
  expect(geometry.composerVisible, 'harness: composer is not visible on arrival').toBe(true);

  // RED on baseline: the invitation/composer lives in `.vxa-intro`, a
  // separate page section outside the Canvas world region (`.vxa-stage`).
  // Docked or adjacent composer content inside the same world region
  // counts as contextual — no physical overlap is required.
  expect(
    geometry.composerSharesWorld,
    `RED ARRIVE: composer/invitation is a co-primary page column detached from the world ` +
    `region (${geometry.canvasWorldTag}) — it must be contextual to the world (owner: UXR5 ARRIVE).`,
  ).toBe(true);
});

test('CONDUCTOR RED: one application-owned Spatial Conductor exposes semantic action state', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await enterWorld(page);
  const conductor = page.locator('[data-spatial-conductor="true"][data-conductor-state]');
  await expect(
    conductor,
    'RED CONDUCTOR: no application-owned Spatial Conductor actuator on the baseline ' +
    '(owner: Spatial Conductor, #25).',
  ).toHaveCount(1);

  const state = await conductor.getAttribute('data-conductor-state');
  expect(
    CONDUCTOR_SEMANTIC_STATES,
    `RED CONDUCTOR: Conductor state ${JSON.stringify(state)} is outside the #25 §4 semantic vocabulary`,
  ).toContain(state);
});

test('OWNERSHIP RED: explicit user viewport input forces Conductor DEFER', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  await enterWorld(page, '/?fixture=stress&perf=1');
  const perf = () => page.evaluate(() => window.__VXA_PERF__);
  expect(await perf(), 'harness: performance probe unavailable with ?perf=1').toBeTruthy();

  // A new explicit semantic intent engages camera automation with a long
  // travel window on the stress fixture (mature directed-navigation
  // semantics, cf. camera-interruption.spec.ts).
  const lateStep = page.locator('.vxa-step').last();
  await lateStep.scrollIntoViewIfNeeded();
  await lateStep.click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');
  const baselineInterruptions = (await perf())?.cameraInterruptions ?? 0;
  const engagedCommands = (await perf())?.cameraCommands ?? 0;
  expect(engagedCommands, 'harness: directed navigation issued no camera command').toBeGreaterThan(0);

  // Explicit user viewport input claims the camera with a real mouse
  // pan/drag (mature pattern, cf. canvas-interactions.spec.ts).
  await mousePanViewport(page, { x: 150, y: 65 });
  const afterDrag = await readViewportMatrix(page);
  await expect
    .poll(async () => page.evaluate(() => window.__VXA_PERF__?.cameraInterruptions ?? 0))
    .toBeGreaterThan(baselineInterruptions);

  // No snap-back and no reclaim without a new semantic intent: the camera
  // holds the user-placed viewport across the whole settle window while
  // camera commands stay flat.
  const interruptedCommands = await readCameraCommands(page);
  await expectNoReclaimDuringSettle(page, afterDrag, interruptedCommands);

  // RED on baseline: nothing application-owned enters DEFER — the camera
  // yields, but no Spatial Conductor observably defers to the user.
  const conductor = page.locator('[data-spatial-conductor="true"]');
  await expect(
    conductor,
    'RED OWNERSHIP: no application-owned Spatial Conductor to enter DEFER after the ' +
    'user takes the camera (owner: Spatial Conductor, #25).',
  ).toHaveCount(1);
  await expect(conductor).toHaveAttribute('data-conductor-state', 'DEFER');

  // A genuinely new semantic intent is required before the agent reclaims
  // the camera and leaves DEFER.
  await page.locator('.vxa-step').first().click();
  await expect
    .poll(async () => readCameraCommands(page))
    .toBeGreaterThan(interruptedCommands);
  await expect(conductor).not.toHaveAttribute('data-conductor-state', 'DEFER');
});

test('MANIPULATION RED: agent-owned object manipulation is observable as causal world action', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('desktop')) test.skip();

  // Deterministic ASK harness, cf. tests/e2e/ask-ai.spec.ts: the turn
  // carries a real processMutation targeting manual-closing.
  await mockUxr5AskTurn(page);
  await page.goto('/');
  await submitUxr5AskTurn(page);

  // Harness proof: the accepted turn really changes the graph — the
  // adapter applies the processMutation to the live world.
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'true');
  const mutatedNode = page.locator(`.react-flow__node-process[data-id="${UXR5_MUTATION_NODE_ID}"]`);
  await expect(mutatedNode, 'harness: accepted ASK turn did not materialize manual-closing').toBeVisible();
  await expect(page.locator('.vxa-spatial-agent__narration')).toHaveText(UXR5_NARRATION);

  // RED on baseline: no physicalized causal agency attributes the change.
  // The graph mutates, but no Spatial Conductor observably links itself to
  // the exact object id the agent turn materialized.
  const conductor = page.locator('[data-spatial-conductor="true"]');
  await expect(
    conductor,
    'RED MANIPULATION: graph mutation applied, but no Spatial Conductor physicalizes ' +
    'causal agency for it (owner: Spatial Conductor, #25).',
  ).toHaveCount(1);

  // A static REST Conductor with a stale target reference must not pass:
  // the semantic state has to express causal physical agency.
  const state = await conductor.getAttribute('data-conductor-state');
  expect(
    MANIPULATION_CAPABLE_STATES,
    `RED MANIPULATION: Conductor state ${JSON.stringify(state)} cannot express causal ` +
    'physical agency over the mutated object (owner: Spatial Conductor, #25).',
  ).toContain(state);

  // The acted-upon target must be observable on the Conductor or a
  // descendant through any semantic/ARIA/data attribute that references
  // the exact manual-closing target — no single invented attribute name
  // is the unique GREEN path.
  const targetReference = await conductor.evaluate((root, targetId) => {
    const candidates: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const candidate of candidates) {
      for (const attribute of Array.from(candidate.attributes)) {
        if (attribute.value.split(/\s+/).includes(targetId)) {
          return { attribute: attribute.name, value: attribute.value };
        }
      }
    }
    return null;
  }, UXR5_MUTATION_NODE_ID);
  expect(
    targetReference,
    'RED MANIPULATION: Spatial Conductor exposes no observable semantic/ARIA/data reference ' +
    'to the exact acted-upon target object (owner: Spatial Conductor, #25).',
  ).toBeTruthy();

  // That reference must resolve to the real Canvas object the agent turn
  // materialized.
  await expect(
    page.locator(`.react-flow__node-process[data-id="${UXR5_MUTATION_NODE_ID}"]`),
    'RED MANIPULATION: Conductor target reference resolves to no real Canvas object.',
  ).toHaveCount(1);
});

test('A11Y RED: spatial state has a non-motion semantic outline for assistive technology', async ({ page }) => {
  await mockUxr5AskTurn(page);
  await enterWorld(page);

  const outline = page.locator('[data-canvas-semantic-outline]');
  await expect(
    outline,
    'RED A11Y: no semantic Canvas outline exists for assistive technology (owner: UXR5 A11Y).',
  ).toHaveCount(1);

  // Coherent role/landmark with a non-empty accessible name, exposed in
  // the accessibility tree instead of hidden as a decorative container.
  const role = await outline.getAttribute('role');
  expect(
    OUTLINE_SEMANTIC_ROLES,
    `RED A11Y: Canvas outline role ${JSON.stringify(role)} is not a coherent semantic landmark`,
  ).toContain(role);
  await expect(outline).not.toHaveAttribute('aria-hidden', 'true');
  await expect(outline, 'RED A11Y: Canvas outline has no coherent accessible name').toHaveAccessibleName(/.+/);

  // Focus/selection is represented through real accessibility state:
  // directed focus must surface as aria-activedescendant on the outline
  // or as aria-selected/aria-current on a descendant — not merely as
  // changed text.
  await page.getByRole('button', { name: /02 Conferência manual/i }).click();
  await expect(page.locator('.vxa-canvas')).toHaveAttribute('data-mode', 'focus');
  await expect
    .poll(async () => page.evaluate(() => {
      const root = document.querySelector('[data-canvas-semantic-outline]');
      if (root === null) return 'missing';
      const activeId = root.getAttribute('aria-activedescendant');
      if (activeId !== null && activeId.trim().length > 0) {
        return document.getElementById(activeId.trim()) === null
          ? 'dangling'
          : `activedescendant:${activeId.trim()}`;
      }
      const selected = root.querySelector('[aria-selected="true"], [aria-current]');
      if (selected !== null) {
        return `selected:${selected.getAttribute('aria-selected') ?? selected.getAttribute('aria-current') ?? 'true'}`;
      }
      return 'none';
    }))
    .toMatch(/^(activedescendant|selected):/);

  // The outline survives without motion: same semantic surface under
  // reduced motion.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterWorld(page);
  const reducedOutline = page.locator('[data-canvas-semantic-outline]');
  await expect(reducedOutline, 'RED A11Y: semantic outline unavailable without motion').toHaveCount(1);
  await expect(reducedOutline).not.toHaveAttribute('aria-hidden', 'true');
  await expect(
    reducedOutline,
    'RED A11Y: semantic outline loses its accessible name when motion is reduced',
  ).toHaveAccessibleName(/.+/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // Agent state is represented through real accessible live/status
  // semantics within — or associated with — the outline after a genuine
  // accepted ASK turn. Any non-empty live/status content counts; exact
  // narration duplication is one valid path, not the required one.
  await enterWorld(page);
  await submitUxr5AskTurn(page);
  await expect(page.locator('.vxa-shell')).toHaveAttribute('data-live', 'true');
  await expect(page.locator('.vxa-spatial-agent__narration')).toHaveText(UXR5_NARRATION);
  const liveRepresentation = await page.evaluate(() => {
    const root = document.querySelector('[data-canvas-semantic-outline]');
    if (root === null) return null;
    const liveTextOf = (element: Element): string | null => {
      const text = (element.textContent ?? '').trim();
      if (text.length === 0) return null;
      if (element.getAttribute('role') === 'status') return text;
      const live = element.getAttribute('aria-live');
      if (live === 'polite' || live === 'assertive') return text;
      return null;
    };
    const within: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
    for (const element of within) {
      const text = liveTextOf(element);
      if (text !== null) return text.slice(0, 240);
    }
    const referencedIds = [
      ...(root.getAttribute('aria-describedby') ?? '').split(/\s+/),
      ...(root.getAttribute('aria-details') ?? '').split(/\s+/),
      ...(root.getAttribute('aria-owns') ?? '').split(/\s+/),
    ].filter((id) => id.length > 0);
    for (const id of referencedIds) {
      const target = document.getElementById(id);
      if (target !== null) {
        const text = liveTextOf(target);
        if (text !== null) return text.slice(0, 240);
      }
    }
    return null;
  });
  expect(
    (liveRepresentation ?? '').length,
    'RED A11Y: outline does not represent live agent state through accessible live/status ' +
    'semantics after an accepted turn (owner: UXR5 A11Y).',
  ).toBeGreaterThan(0);
});

test('MOBILE RED: the Canvas remains the primary world instead of a desktop page stacked vertically', async ({ page }, testInfo) => {
  if (!testInfo.project.name.includes('mobile')) test.skip();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const geometry = await readWorldContext(page);

  // The world surface must be reachable in the first viewport (a wholly
  // below-the-fold Canvas is itself a missing spatial-native access
  // capability), with no page-stack traversal required to reach it.
  expect(
    geometry.canvasTop,
    'RED MOBILE: Canvas is wholly below the first viewport — no spatial-native world access (owner: UXR5 MOBILE).',
  ).toBeLessThan(geometry.viewportHeight);
  expect(
    geometry.canvasVisibleHeight,
    'harness: Canvas has no visible area in the first viewport on mobile',
  ).toBeGreaterThan(0);

  // The page carries no horizontal dependency (mature mobile semantics,
  // cf. foundation.spec.ts).
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    dimensions.scrollWidth,
    'harness: page introduces a horizontal dependency on mobile',
  ).toBeLessThanOrEqual(dimensions.clientWidth);

  // RED on baseline: the invitation/composer is stacked as a page section
  // above the world, outside the Canvas world region, so reaching the
  // Canvas means page-stack traversal instead of spatial-native
  // first-viewport access. Docked content inside the same world region
  // counts as contextual.
  expect(geometry.composerVisible, 'harness: composer is not visible on mobile arrival').toBe(true);
  expect(
    geometry.composerSharesWorld,
    'RED MOBILE: world access requires page-stack traversal — the invitation is a ' +
    'stacked page section detached from the world surface (owner: UXR5 MOBILE).',
  ).toBe(true);
});
