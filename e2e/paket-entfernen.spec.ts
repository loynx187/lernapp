import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Ganzes Paket entfernen und wiederherstellen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Technische Mechanik' }).click()
  await expect(page.getByText(/Version 2 · 15 Karten/)).toBeVisible()

  await page.getByRole('button', { name: 'Beispiel: Festigkeitslehre entfernen' }).click()
  await expect(page.getByText('Entfernte Pakete')).toBeVisible()
  await expect(page.getByText('Für diese Prüfung gibt es noch keine Karten.')).toBeVisible()
  // Nicht unter „gelöschte Karten“ einzeln aufgeführt
  await expect(page.getByText(/gelöschte Karte/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Beispiel: Festigkeitslehre wiederherstellen' }).click()
  await expect(page.getByText('Entfernte Pakete')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Beispiel: Festigkeitslehre entfernen' })).toBeVisible()
  await expect(page.getByText('Für diese Prüfung gibt es noch keine Karten.')).toHaveCount(0)
  expect(errors).toEqual([])
})
