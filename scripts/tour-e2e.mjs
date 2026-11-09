import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.CELLCAST_URL || 'http://127.0.0.1:3003';
const browser = await chromium.launch({ headless: true });
const evidence = { url: base, errors: [], widths: [] };
const assert = (condition, message) => { if (!condition) throw Error(message); };
await mkdir('docs/evidence', { recursive: true });
try {
  for (const width of [1440, 768, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => evidence.errors.push(error.message));
    await page.goto(base);
    await page.getByRole('button', { name: 'Start guided tour', exact: true }).click();
    const heading = page.locator('#research-tour-title');
    const dialog = page.getByRole('dialog');
    await heading.filter({ hasText: 'Start with a real study' }).waitFor();
    await page.screenshot({ path: `docs/evidence/tour-${width}.png` });
    const checkBounds = async () => {
      await page.waitForFunction(() => {
        const box = document.querySelector('.research-tour-popover')?.getBoundingClientRect();
        return box && box.x >= 0 && box.right <= innerWidth + 1 && box.y >= 0 && box.bottom <= innerHeight + 1;
      }, undefined, { timeout: 3000 });
      const box = await page.locator('.research-tour-popover').boundingBox();
      assert(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 1001, `Popover outside ${width}px viewport: ${JSON.stringify(box)}`);
    };
    await checkBounds();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await heading.filter({ hasText: 'Know where the cells came from' }).waitFor();
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await heading.filter({ hasText: 'Start with a real study' }).waitFor();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await heading.filter({ hasText: 'Know where the cells came from' }).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.activeElement?.classList.contains('tour-trigger'));
    assert(await page.getByRole('button', { name: 'Resume tour', exact: true }).evaluate(e => e === document.activeElement), 'Focus did not return to tour trigger');
    await page.reload();
    assert(await page.getByRole('region', { name: 'Learn CellCast' }).count() === 0, 'Invitation reappeared after pausing');
    await page.getByRole('button', { name: 'Resume tour', exact: true }).click();
    await heading.filter({ hasText: 'Know where the cells came from' }).waitFor();
    for (const title of ['Read the cell landscape', 'Ask about a gene', 'Choose a fair comparison', 'Run your first comparison']) {
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      await heading.filter({ hasText: title }).waitFor();
      await checkBounds();
      if (title === 'Ask about a gene' && width === 1440) {
        await page.getByRole('combobox', { name: 'Choose gene', exact: true }).click({ timeout: 60000 });
        await page.getByRole('textbox', { name: 'Search genes', exact: true }).fill('AT3G18780');
        await page.getByRole('option').filter({ hasText: 'AT3G18780' }).first().click({ timeout: 30000 });
      }
    }
    assert(await dialog.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), 'Experiment continued without a result');
    if (width === 1440) {
      await page.getByRole('button', { name: 'Compare expression', exact: true }).click({ timeout: 60000 });
      await page.locator('.comparison-results').waitFor({ timeout: 60000 });
      await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
      evidence.comparison = await page.locator('.comparison-results').getAttribute('data-gene');
    } else {
      await dialog.getByRole('button', { name: 'Skip this experiment', exact: true }).click();
    }
    await heading.filter({ hasText: 'Read the evidence carefully' }).waitFor();
    await checkBounds();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await heading.filter({ hasText: 'Understand what the models do' }).waitFor();
    await checkBounds();
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await heading.filter({ hasText: 'Keep a research trail' }).waitFor();
    await dialog.getByRole('button', { name: 'Finish tour', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert(JSON.parse(await page.evaluate(() => localStorage.getItem('cellcast-learning-tour-v1'))).status === 'completed', 'Completion not stored');
    await page.getByRole('button', { name: 'Guided tour', exact: true }).click();
    await heading.filter({ hasText: 'Start with a real study' }).waitFor();
    await dialog.getByRole('button', { name: 'Save & exit', exact: true }).click();
    evidence.widths.push({ width, completed: true, resume: true, restart: true, bounds: true });
    await context.close();
  }
  assert(evidence.errors.length === 0, `Browser errors: ${evidence.errors.join(', ')}`);
  await writeFile('docs/evidence/tour-e2e.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await browser.close(); }
