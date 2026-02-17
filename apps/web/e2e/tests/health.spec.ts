import { test, expect } from '@playwright/test';

test.describe('App Health', () => {
  test('should load the web app', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Auto Claude/);
  });

  test('API health check should respond', async ({ request }) => {
    const response = await request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
