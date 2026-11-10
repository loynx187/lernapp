import { expect, test } from '@playwright/test'
import { collectErrors, onboard } from './helpers'

test('Design und Hell/Dunkel in den Einstellungen wählen, bleibt nach dem Neuladen', async ({ page }) => {
  const errors = collectErrors(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await onboard(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'standard')
  await expect(html).toHaveAttribute('data-scheme', 'light')

  await page.goto('./#/einstellungen')
  await page.getByRole('radio', { name: 'Papier' }).click()
  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(html).toHaveAttribute('data-theme', 'papier')
  await expect(html).toHaveAttribute('data-scheme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(25, 25, 24)')

  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'papier')
  await expect(html).toHaveAttribute('data-scheme', 'dark')

  // Automatisch folgt dem System
  await page.getByRole('radio', { name: 'Automatisch' }).click()
  await expect(html).toHaveAttribute('data-scheme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(html).toHaveAttribute('data-scheme', 'dark')
  expect(errors).toEqual([])
})
