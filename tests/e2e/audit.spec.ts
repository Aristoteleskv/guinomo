import { expect, test } from '@playwright/test';

// Empirical audit of the six worlds, driven by the `?audit` hook in main.ts.
// It boots each world in a real browser and records which secret set pieces are
// visible, whether the rest system initialized, and the forced sky theme.
//
// The intended design (see WorldLocations.setupSecrets) is exactly ONE secret
// per world. The matrix is printed so the run doubles as a report, and the
// invariant is asserted softly so we still see every world's state in one go.

const WORLDS = ['lobby', 'forest', 'floating-city', 'tropical-city', 'old-town', 'alien'] as const;
type World = (typeof WORLDS)[number];

const EXPECTED_SECRET: Record<World, string> = {
  lobby: 'ufo',
  forest: 'sloth',
  'floating-city': 'ufo',
  'tropical-city': 'cats',
  'old-town': 'gossip',
  alien: 'alien',
};

type Snapshot = {
  world: string;
  room: string | null;
  secretVisibility: Record<string, boolean>;
  secretsVisible: string[];
  restAvailable: boolean;
  skyTheme: string | null;
};

test.describe('Guinomo world audit (?audit)', () => {
  for (const world of WORLDS) {
    test(`world: ${world}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

      await page.goto(`/?world=${world}&multiplayer=0&audit=1`);
      // Wait until every secret mesh is loaded: the audit hook appears
      // synchronously, but the meshes resolve asynchronously.
      await page.waitForFunction(
        () => {
          const audit = (window as unknown as { __summerAudit?: { snapshot(): Snapshot } }).__summerAudit;
          return Boolean(audit) && Object.keys(audit!.snapshot().secretVisibility).length >= 5;
        },
        undefined,
        { timeout: 60_000 },
      );
      // Let the deferred `scene.ready.then(setupSecrets)` callbacks settle.
      await page.waitForTimeout(800);

      const snapshot = await page.evaluate(
        () => (window as unknown as { __summerAudit: { snapshot(): Snapshot } }).__summerAudit.snapshot(),
      );

      console.log(
        `[${world}] secrets=${JSON.stringify(snapshot.secretsVisible)} ` +
          `rest=${snapshot.restAvailable} sky=${snapshot.skyTheme} room=${snapshot.room}`,
      );

      // Smoke: the world boots and the audit hook is wired.
      expect(snapshot.world).toBe(world);
      expect.soft(pageErrors, `${world}: uncaught page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);

      // Audit: exactly one secret should be visible, matching the design map.
      expect
        .soft([...snapshot.secretsVisible].sort(), `${world}: expected exactly ['${EXPECTED_SECRET[world]}']`)
        .toEqual([EXPECTED_SECRET[world]]);

      await page.screenshot({ path: `test-results/audit-${world}.png` });
    });
  }
});
