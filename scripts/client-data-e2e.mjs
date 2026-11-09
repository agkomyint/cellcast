import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const base = process.env.CELLCAST_URL || 'http://127.0.0.1:3010';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const evidence = { url: base, checkedAt: new Date().toISOString(), atlasRequests: [], proxyRequests: [], errors: [] };
const assert = (condition, message) => { if (!condition) throw Error(message); };
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('request', request => {
  const url = request.url();
  if (url.startsWith('https://www.ebi.ac.uk/gxa/sc/json/')) evidence.atlasRequests.push(url);
  if (url.startsWith(base + '/api/datasets')) evidence.proxyRequests.push(url);
});
const chooseGene = async gene => {
  await page.getByRole('combobox', { name: 'Choose gene', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search genes', exact: true }).fill(gene);
  await page.getByRole('option').filter({ hasText: gene }).first().click({ timeout: 45000 });
};
try {
  await page.goto(base);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  const run = page.getByRole('button', { name: 'Compare expression', exact: true });
  await page.getByRole('combobox', { name: 'Group A', exact: true }).locator('option').first().waitFor({ state: 'attached', timeout: 120000 });
  await chooseGene('AT1G01010');
  let failedRequests = 0;
  const expression = '**/json/cell-plots/E-CURD-4/expression/AT1G01010?*';
  await page.route(expression, route => { failedRequests++; return route.abort('timedout'); });
  await run.click();
  await page.getByRole('alert').filter({ hasText: 'Could not reach Single Cell Expression Atlas' }).waitFor();
  assert(failedRequests === 2, 'A temporary failure should retry exactly once');
  assert(await page.getByRole('link', { name: /Open source study/ }).count() === 1, 'Source recovery link missing');
  await page.unroute(expression);
  await page.getByRole('button', { name: 'Retry comparison', exact: true }).click();
  await page.locator('.comparison-results[data-gene="AT1G01010"]').waitFor({ timeout: 120000 });
  evidence.failedRequestRecovery = true;
  evidence.result = await page.locator('.comparison-results').innerText();
  const requestsBefore = evidence.atlasRequests.filter(url => url.includes('/expression/')).length;
  await run.click();
  await page.getByRole('status').filter({ hasText: 'Using saved measured expression' }).waitFor();
  await page.locator('.comparison-results[data-gene="AT1G01010"]').waitFor();
  assert(evidence.atlasRequests.filter(url => url.includes('/expression/')).length === requestsBefore, 'Repeated comparison refetched the same expression');
  evidence.savedExpressionReuse = true;
  await page.screenshot({ path: 'docs/evidence/client-data-desktop.png' });
  await page.reload();
  const populations = '**/json/cell-plots/E-CURD-4/clusters/**';
  // Reload with an unavailable upstream source, while genuine IndexedDB data remains.
  await page.route(populations, route => route.abort('timedout'));
  await page.reload();
  await page.getByRole('status').filter({ hasText: 'Atlas could not be refreshed. Showing saved cells' }).waitFor({ timeout: 30000 });
  assert(await page.getByRole('combobox', { name: 'Group A', exact: true }).locator('option').count() > 0, 'Cached cell groups were lost');
  await page.unroute(populations);
  await page.getByRole('button', { name: 'Retry study', exact: true }).click();
  await page.locator('.repository-error[role="alert"]').waitFor({ state: 'hidden', timeout: 120000 });
  await run.waitFor();
  evidence.savedCellRecovery = true;
  assert(evidence.proxyRequests.every(url => /\/configuration$/.test(url)), 'Measured data still passed through the server proxy');
  assert(evidence.atlasRequests.some(url => url.endsWith('/json/experiments')), 'Catalogue was not fetched directly');
  assert(evidence.atlasRequests.some(url => url.includes('/json/suggestions')), 'Gene suggestions were not fetched directly');
  assert(evidence.atlasRequests.some(url => url.includes('/clusters/')), 'Cell coordinates were not fetched directly');
  assert(evidence.atlasRequests.some(url => url.includes('/expression/')), 'Expression was not fetched directly');
  assert(evidence.errors.length === 0, `Browser errors: ${evidence.errors.join(', ')}`);
  await writeFile('docs/evidence/client-data-e2e.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ directAtlasRequests: evidence.atlasRequests.length, configurationRequests: evidence.proxyRequests.length, failureRecovery: true, cachedExpression: true, cachedCells: true, errors: evidence.errors }));
} finally { await browser.close(); }
