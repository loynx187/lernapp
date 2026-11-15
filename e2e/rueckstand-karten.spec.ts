import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Rückstand wird in Karten angezeigt', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik', 3)
  await importPackage(page)
  // Kleinstes Budget: Der Kernstoff passt nicht mehr bis zur Klausur
  await page.goto('./#/einstellungen')
  await page.locator('input[type=range]').first().fill('5')

  await page.goto('./#/')
  await expect(page.locator('.widget', { hasText: 'Fortschritt' })).toContainText(/\d+ Karten? Rückstand/)
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Technische Mechanik' }).click()
  await expect(page.getByText(/\d+ Karten? Rückstand: Mit dem aktuellen Zeitbudget/)).toBeVisible()
  expect(errors).toEqual([])
})
