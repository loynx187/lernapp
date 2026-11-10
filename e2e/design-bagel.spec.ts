import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Design „Bagel“: Paletten, eigene Farben mit Kontrastprüfung und Kritzeleien', async ({ page }) => {
  const errors = collectErrors(page)
  await page.emulateMedia({ colorScheme: 'light' })
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)
  const html = page.locator('html')

  await page.goto('./#/einstellungen')
  await page.getByRole('radio', { name: 'Bagel' }).click()
  await expect(html).toHaveAttribute('data-theme', 'bagel')
  await expect(html).toHaveAttribute('data-doodles', 'on')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(243, 235, 222)')

  // Dunkel: dunkle Fassung der Palette
  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(html).toHaveAttribute('data-scheme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 18, 18)')
  await page.getByRole('radio', { name: 'Hell' }).click()

  // Eigene Farben: unlesbare Schrift wird gemeldet und lässt sich korrigieren
  await page.getByRole('radio', { name: 'Eigene' }).click()
  await page.getByLabel('Schrift', { exact: true }).fill('#fff8ee')
  await expect(page.getByRole('alert').first()).toContainText('schlecht lesbar')
  await page.getByRole('button', { name: 'Lesbare Schriftfarbe übernehmen' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Bleibt nach dem Neuladen, Kacheln tragen ihr Motiv
  await page.goto('./#/')
  await page.reload()
  await expect(html).toHaveAttribute('data-theme', 'bagel')
  await expect(page.locator('.widget[data-motif="cards"]')).toHaveCount(1)
  const motif = await page.locator('.widget[data-motif="cards"]').evaluate((el) => getComputedStyle(el, '::after').maskImage || getComputedStyle(el, '::after').webkitMaskImage)
  expect(motif).toContain('url(')

  await page.goto('./#/einstellungen')
  await page.getByRole('checkbox', { name: /Kritzeleien/ }).uncheck()
  await expect(html).toHaveAttribute('data-doodles', 'off')
  expect(errors).toEqual([])
})
