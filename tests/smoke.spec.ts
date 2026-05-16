import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('https://chronico-diabo.vercel.app/fr/login');
  await expect(page.locator('text=Connexion Chronico')).toBeVisible();
});

test('signup page loads', async ({ page }) => {
  await page.goto('https://chronico-diabo.vercel.app/fr/signup');
  await expect(page.locator('text=Créer un compte Chronico')).toBeVisible();
});

test('home page loads', async ({ page }) => {
  await page.goto('https://chronico-diabo.vercel.app/fr');
  await expect(page.locator('text=Diabo')).toBeVisible();
});
