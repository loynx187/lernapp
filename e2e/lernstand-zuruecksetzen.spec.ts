import { expect, test } from '@playwright/test'
import { collectErrors, countRows, createExam, importPackage, onboard, rate, revealCard } from './helpers'

test('Lernstand eines Pakets zurücksetzen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)

  await page.goto('./#/lernen/mobile')
  await revealCard(page)
  await rate(page, 'Gut')
  await expect(page.locator('.session-count')).toHaveText(/^1\/\d+$/)

  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Technische Mechanik' }).click()
  const dialogs: string[] = []
  page.on('dialog', (d) => dialogs.push(d.message()))
  await page.getByRole('button', { name: 'Lernstand von Beispiel: Festigkeitslehre zurücksetzen' }).click()
  await expect.poll(() => dialogs.length).toBe(2)
  expect(dialogs[1]).toBe('1 Karte zurückgesetzt.')
  // Bewertungen bleiben, das Paket bleibt aktiv
  expect(await countRows(page, 'reviews')).toBe(1)
  await expect(page.getByRole('button', { name: 'Beispiel: Festigkeitslehre entfernen' })).toBeVisible()
  expect(errors).toEqual([])
})
