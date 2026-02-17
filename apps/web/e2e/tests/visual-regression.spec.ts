import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

test.describe('Visual Regression', () => {
  test('homepage - default state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await percySnapshot(page, 'Homepage - Default');
  });

  test('homepage - dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mode', 'dark');
    });
    await percySnapshot(page, 'Homepage - Dark Mode');
  });

  test('homepage - light mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-mode', 'light');
    });
    await percySnapshot(page, 'Homepage - Light Mode');
  });
});
