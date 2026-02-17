import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should display main layout', async ({ page }) => {
    await page.goto('/');
    // Verify the main app container renders
    await expect(page.locator('#root')).toBeVisible();
  });
});
