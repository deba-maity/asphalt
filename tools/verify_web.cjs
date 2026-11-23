// Run against an exported game with Playwright available to Node.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function verify(url) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      const counts = { created: 0, live: 0 };
      const recorded = new WeakSet();
      const live = new WeakSet();
      const gl = WebGL2RenderingContext.prototype;
      const allocate = gl.texStorage2D;
      const release = gl.deleteTexture;
      gl.texStorage2D = function (target, levels, format, width, height) {
        const result = allocate.call(this, target, levels, format, width, height);
        if (target === this.TEXTURE_CUBE_MAP && width >= 64) {
          const texture = this.getParameter(this.TEXTURE_BINDING_CUBE_MAP);
          if (texture && !recorded.has(texture)) {
            recorded.add(texture);
            live.add(texture);
            counts.created++;
            counts.live++;
          }
        }
        return result;
      };
      gl.deleteTexture = function (texture) {
        if (texture && live.delete(texture)) counts.live--;
        return release.call(this, texture);
      };
      window.courtTextureCounts = counts;
    });
    const frames = count => page.evaluate(n => new Promise(resolve => {
      function next() {
        if (--n <= 0) resolve();
        else requestAnimationFrame(next);
      }
      requestAnimationFrame(next);
    }), count);
    await page.goto(url);
    await page.locator('#status').waitFor({ state: 'detached', timeout: 120000 });
    await page.waitForFunction(() => window.courtTextureCounts.live > 0);
    await frames(10);
    const initial = await page.evaluate(() => ({ ...window.courtTextureCounts }));
    let lastCreated = initial.created;
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.mouse.click(237, 277); // Warden duel from the title.
      await page.waitForFunction(last => window.courtTextureCounts.created > last, lastCreated);
      await frames(5);
      const counts = await page.evaluate(() => ({ ...window.courtTextureCounts }));
      assert.equal(counts.live, initial.live, 'Starting a new court retained reflection textures');
      lastCreated = counts.created;
      await page.keyboard.press('Escape');
      await frames(2);
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // Return to title.
      await frames(3);
    }
    await page.mouse.click(244, 447); // Quit from title.
    const replay = page.getByRole('button', { name: 'Play again' });
    await replay.waitFor();
    await page.waitForFunction(() => window.courtTextureCounts.live === 0);
    await replay.click();
    await page.locator('#status').waitFor({ state: 'detached', timeout: 120000 });
    assert.deepEqual(errors, []);
    console.log(`Four courts held ${initial.live} reflection textures, released them on Quit, and reopened the game.`);
  } finally {
    await browser.close();
  }
}

const url = process.argv[2];
if (!url) throw new Error('Usage: node tools/verify_web.cjs <game URL>');
verify(url).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
