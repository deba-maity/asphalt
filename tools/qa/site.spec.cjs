const {test, expect} = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

for (const width of [320, 390, 768, 1440]) {
  test(`project subpath, links and accessible layout at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    const errors = [], failed = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
    await page.goto('./');
    await expect(page.locator('#version')).not.toHaveText(/loading/);
    await expect(page.locator('#windows-download')).toBeHidden();
    await expect(page.locator('#windows-unavailable')).toBeVisible();
    await expect(page.locator('#availability')).toContainText(/No public release|Public release unavailable/);
    await page.locator('#screenshots').scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    for (const path of ['guide.html', 'credits.html']) {
      await page.goto(path);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    }
    expect(errors).toEqual([]); expect(failed).toEqual([]);
    if ([390,1440].includes(width)) {
      await page.goto('./');
      await page.screenshot({path: `test-results/site-${width}.png`, fullPage: true});
    }
  });
}
test('keyboard skip, focus and reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./'); await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await expect(page.locator('.skip')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.goto('./');
  for(let index=0; index<12; index++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)).not.toBe('none');
});
test('metadata failure and no JavaScript keep public downloads unavailable', async ({browser,page}) => {
  await page.route('**/release-data.json', route => route.fulfill({status:503,body:'unavailable'}));
  await page.goto('./');
  await expect(page.locator('#availability')).toContainText('could not be loaded');
  await expect(page.locator('#windows-download')).toBeHidden();
  const context=await browser.newContext({javaScriptEnabled:false});
  const plain=await context.newPage(); await plain.goto('http://127.0.0.1:4173/ashen-vow/');
  expect(await plain.locator('noscript').textContent()).toContain('No public release link');
  await expect(plain.locator('#windows-download')).toBeHidden(); await context.close();
});
test('verified publication snapshot enables versioned links (isolated test fixture)', async ({page}) => {
  const root='https://github.com/fixture-only/ashen-vow';
  await page.route('**/release-data.json', route => route.fulfill({json:{
    version:'0.0.0-test',status:'candidate',published:true,tests:{fresh_zip:'passed'},repository_url:root,
    release_url:root+'/releases/tag/v0.0.0-test',checksum_url:root+'/releases/download/v0.0.0-test/SHA256SUMS.txt',
    artifacts:[{kind:'windows-portable',size_bytes:1048576,sha256:'a'.repeat(64),download_url:root+'/releases/download/v0.0.0-test/fixture.zip'}]
  }}));
  await page.goto('./');
  await expect(page.locator('#windows-download')).toBeVisible();
  await expect(page.locator('#windows-download')).toHaveAttribute('href',root+'/releases/download/v0.0.0-test/fixture.zip');
  await expect(page.locator('#windows-download')).not.toHaveAttribute('download');
  await expect(page.locator('#windows-unavailable')).toBeHidden();
});
