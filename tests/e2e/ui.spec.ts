import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import type * as Core from '@/core';

import { expect, test } from './fixtures';

/** Screen captures for review (plan §7: visual snapshots); CI uploads this folder. */
const SCREENS = fileURLToPath(new URL('../../test-results/screens/', import.meta.url));

type Theme = 'light' | 'dark';

async function openOnDemo(
  openTab: (url: string) => Promise<{ page: Page; tabId: number }>,
  openPanel: (tabId: number) => Promise<Page>,
  extensionId: string,
): Promise<{ demo: Page; panel: Page }> {
  const { page: demo, tabId } = await openTab(`chrome-extension://${extensionId}/demo.html`);
  await demo.setViewportSize({ width: 800, height: 900 });
  const panel = await openPanel(tabId);
  return { demo, panel };
}

async function scan(panel: Page): Promise<void> {
  await panel.getByRole('button', { name: /^Scan page/ }).click();
  await expect(
    panel.getByRole('listbox', { name: 'Results' }).getByRole('option').first(),
  ).toBeVisible();
}

/** The states every check walks through, in order. */
const STATES: readonly { name: string; enter: (panel: Page) => Promise<void> }[] = [
  { name: 'home', enter: () => Promise.resolve() },
  { name: 'results', enter: scan },
  {
    name: 'detail',
    enter: async (panel) => {
      // A result with text, so the detail shows where it is cut.
      await panel
        .getByRole('listbox', { name: 'Results' })
        .getByRole('option')
        .filter({ hasText: 'Waterproof hiking jacket' })
        .click();
      await expect(panel.getByRole('img', { name: /^Needs / })).toBeVisible();
    },
  },
  {
    name: 'stress',
    enter: async (panel) => {
      await panel.keyboard.press('Escape');
      await panel.getByRole('button', { name: /^(Test with longer text|Longer text)/ }).click();
      await panel.getByRole('button', { name: 'Apply and scan' }).click();
      await expect(panel.getByRole('button', { name: 'Revert' })).toBeVisible();
    },
  },
  {
    name: 'settings',
    enter: async (panel) => {
      await panel.getByRole('button', { name: 'Settings' }).click();
      await expect(panel.getByRole('heading', { name: 'Settings' })).toBeVisible();
    },
  },
  {
    name: 'shortcuts',
    enter: async (panel) => {
      await panel.getByRole('button', { name: 'Back to results' }).click();
      await panel.keyboard.press('?');
      await expect(panel.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    },
  },
  {
    name: 'commands',
    enter: async (panel) => {
      await panel.keyboard.press('Escape');
      await panel.keyboard.press('ControlOrMeta+k');
      await expect(panel.getByRole('dialog', { name: 'Commands' })).toBeVisible();
    },
  },
];

for (const theme of ['light', 'dark'] as const satisfies readonly Theme[]) {
  test(`has no serious accessibility issues (${theme})`, async ({
    openTab,
    openPanel,
    extensionId,
  }) => {
    const { panel } = await openOnDemo(openTab, openPanel, extensionId);
    // Start in the theme, as a user's OS setting would (axe samples mid-transition otherwise).
    await panel.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await panel.reload();
    const problems: string[] = [];
    for (const state of STATES) {
      await state.enter(panel);
      const { violations } = await new AxeBuilder({ page: panel })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      for (const violation of violations) {
        if (violation.impact === 'serious' || violation.impact === 'critical') {
          const targets = violation.nodes.map((node) => node.target.join(' ')).slice(0, 3);
          problems.push(
            `${state.name}: ${violation.id} (${violation.impact}) at ${targets.join(', ')}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
}

test('works with the keyboard alone', async ({ openTab, openPanel, extensionId }) => {
  const { demo, panel } = await openOnDemo(openTab, openPanel, extensionId);
  // Playwright sends keys within a millisecond of each other, faster than anyone
  // types; at that speed Radix tooltips can open after focus has already moved
  // on (under 30 ms apart). Keys are pressed at a brisk human pace instead.
  const press = async (key: string) => {
    await panel.keyboard.press(key);
    await panel.waitForTimeout(50);
  };
  const focused = () =>
    panel.evaluate(
      () =>
        document.activeElement?.getAttribute('aria-label') ??
        document.activeElement?.textContent ??
        '',
    );

  // The Home actions come after the header buttons; Tab until "Scan page".
  for (let step = 0; step < 6 && !(await focused()).startsWith('Scan page'); step += 1) {
    await press('Tab');
  }
  expect(await focused()).toMatch(/^Scan page/);
  await press('Enter');
  const list = panel.getByRole('listbox', { name: 'Results' });
  await expect(list.getByRole('option').first()).toBeVisible();

  // j/k move the selection and outline the element on the page.
  await press('j');
  await expect(list).toBeFocused();
  await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await press('j');
  await expect(list.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(demo.locator('overflow-scout-root .box[data-role="target"]')).toHaveCount(1);
  await press('k');
  await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');

  // Enter opens the details; Esc goes back.
  await press('Enter');
  await expect(panel.getByRole('img', { name: /^Needs / })).toBeVisible();
  await press('Escape');
  await expect(panel.getByRole('img', { name: /^Needs / })).toBeHidden();

  // / searches.
  await press('/');
  await expect(panel.getByRole('searchbox')).toBeFocused();
  // Font metrics decide whether this element also spills, so check what matched, not how many.
  await panel.keyboard.type('p.promo');
  await expect(list.getByRole('option').filter({ hasNotText: 'p.promo' })).toHaveCount(0);
  await expect(list.getByRole('option').first()).toContainText('p.promo');
  await press('Shift+Tab');

  // ? shows the shortcuts; Esc closes them.
  await press('?');
  await expect(panel.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await press('Escape');
  await expect(panel.getByRole('dialog')).toBeHidden();
});

test('runs actions from the command palette', async ({ openTab, openPanel, extensionId }) => {
  const { panel } = await openOnDemo(openTab, openPanel, extensionId);
  await panel.keyboard.press('ControlOrMeta+k');
  const palette = panel.getByRole('dialog', { name: 'Commands' });
  await expect(palette).toBeVisible();

  await panel.keyboard.type('stress');
  await expect(palette.getByRole('option', { name: /^Test with longer text now/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await panel.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(panel.getByRole('button', { name: 'Revert' })).toBeVisible();

  // Only commands that apply right now: Revert appears once stress is on.
  await panel.keyboard.press('ControlOrMeta+k');
  await panel.keyboard.type('revert');
  await panel.keyboard.press('Enter');
  await expect(panel.getByRole('button', { name: 'Revert' })).toBeHidden();
});

/**
 * The panel has to survive its own medicine (plan §5.1): stressed with
 * pseudo-locale text at 320 px, nothing in it may clip or spill. Truncation
 * is accepted only where the full text is available on hover (a `title`).
 */
test('passes its own stress test at 320 px', async ({ openTab, openPanel, extensionId }) => {
  const { panel } = await openOnDemo(openTab, openPanel, extensionId);
  await panel.setViewportSize({ width: 320, height: 720 });
  await panel.waitForFunction(() => 'overflowScout' in window);

  const selfTest = () =>
    panel.evaluate(async () => {
      const scout = (window as unknown as { overflowScout: typeof Core }).overflowScout;
      const result = await scout.runStressTest(document, {
        strategy: 'pseudo',
        intensity: 'worst',
      });
      result.session.revert();
      return [...result.brokenNow, ...result.atRisk]
        .filter((finding) => !(finding.kind === 'truncated' && finding.element.closest('[title]')))
        .map(
          (finding) =>
            `${finding.kind} on ${scout.elementLabel(finding.element)}: "${finding.text.slice(0, 40)}"`,
        );
    });

  const problems: string[] = [];
  for (const state of STATES) {
    await state.enter(panel);
    problems.push(...(await selfTest()).map((problem) => `${state.name}: ${problem}`));
  }
  expect(problems).toEqual([]);
});

test('captures key screens for review', async ({ openTab, openPanel, extensionId }) => {
  test.slow();
  mkdirSync(SCREENS, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    for (const width of [320, 400, 600]) {
      const { panel } = await openOnDemo(openTab, openPanel, extensionId);
      await panel.setViewportSize({ width, height: 720 });
      await panel.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await panel.reload();
      for (const state of STATES) {
        await state.enter(panel);
        await panel.screenshot({ path: `${SCREENS}${state.name}-${String(width)}-${theme}.png` });
      }
      await panel.close();
    }
  }
});
