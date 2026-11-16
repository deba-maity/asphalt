const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.', testMatch: 'site.spec.cjs', fullyParallel: false, workers: 1,
  reporter: [['list'], ['json', {outputFile: 'test-results/results.json'}]],
  use: {baseURL: 'http://127.0.0.1:4173/ashen-vow/', headless: true,
    launchOptions: process.env.QA_CHROMIUM_PATH ? {executablePath: process.env.QA_CHROMIUM_PATH} : {}},
  webServer: {command: 'python ../preview_site.py --base /ashen-vow/ --port 4173', url: 'http://127.0.0.1:4173/ashen-vow/', reuseExistingServer: false, timeout: 30000}
});
