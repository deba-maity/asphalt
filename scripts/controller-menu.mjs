import assert from "node:assert/strict";

export async function verifyControllerMenu(browser, url) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(60000);
  await page.addInitScript(() => {
    const pad = { index: 2, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.testMenuPad = pad;
    window.testPadReads = 0;
    Object.defineProperty(navigator, "getGamepads", { value: () => {
      window.testPadReads++;
      return [null, null, window.testMenuPad];
    } });
  });
  const press = button => page.evaluate(async button => {
    const frame = () => new Promise(requestAnimationFrame);
    const key = window.testMenuPad.buttons[button];
    key.pressed = true; key.value = 1;
    await frame(); await frame();
    key.pressed = false; key.value = 0;
    await frame(); await frame();
  }, button);
  const focused = () => page.evaluate(() => document.activeElement.id || document.activeElement.dataset.action);
  try {
    await page.goto(url);
    await page.locator('[data-action="modes"]').waitFor();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await press(0);
    assert.equal(await focused(), "choose-mode");
    await press(0);
    assert.equal(await focused(), "choose-map");
    await press(12);
    assert.equal(await focused(), "route-guide");
    await press(0);
    assert.equal(await page.locator("#route-guide").inputValue(), "cuts");
    await press(13);
    assert.equal(await focused(), "choose-map");
    await press(0);
    assert.equal(await focused(), "start");
    await press(1);
    assert.equal(await focused(), "choose-map");
    await press(1);
    assert.equal(await focused(), "choose-mode");
    await press(1);
    assert.equal(await focused(), "modes");

    await press(0); await press(0); await press(0); await press(0);
    await page.locator("#hud").waitFor();
    await press(9);
    assert.equal(await focused(), "resume");
    await press(1);
    assert.equal(await page.locator(".pause-overlay").count(), 0);
    await press(9);
    // Start may be pressed during the starting countdown, when recovery is hidden.
    for (let i = 0; i < 4 && await focused() !== "home"; i++) await press(13);
    assert.equal(await focused(), "home");
    await press(0);
    await page.locator('[data-action="garage"]').waitFor();

    await page.locator('[data-action="garage"]').click();
    await page.locator('[data-action="filter-vehicles"][data-id="bikes"]').click();
    assert(await page.locator(".vehicle-chip-premium").count() > 0);
    assert.equal(await page.locator(".vehicle-chip-premium:not(:has(.vehicle-thumbnail.bike))").count(), 0);
    await page.locator(".vehicle-chip-premium").first().click();
    await page.locator('[data-action="garage-race-setup"]').click();
    await page.keyboard.press("Escape");
    await page.locator('[data-action="garage-race-setup"]').waitFor();
    assert.equal(await page.locator(".vehicle-chip-premium.selected .vehicle-thumbnail.bike").count(), 1);
    await page.keyboard.press("Escape");
    await page.locator('[data-action="modes"]').waitFor();
    const reads = await page.evaluate(async () => {
      window.testMenuPad = null;
      window.dispatchEvent(new Event("gamepaddisconnected"));
      const before = window.testPadReads;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.testPadReads - before;
    });
    assert.equal(reads, 0, "Disconnecting the controller stops menu polling");
    await page.locator('[data-action="modes"]').focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-action="choose-mode"]').first().waitFor();
  } finally { await page.close(); }
}
