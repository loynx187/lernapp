import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Prüfung pausieren und fortsetzen: nicht abgefragt, Lernstand bleibt', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)

  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Technische Mechanik' }).click()
  await page.getByRole('button', { name: 'Prüfung pausieren' }).click()
  await expect(page.getByText(/Pausiert.*seit/)).toBeVisible()

  await page.goto('./#/pruefungen')
  await expect(page.locator('a.card.link', { hasText: 'Technische Mechanik' })).toContainText('pausiert')

  await page.goto('./#/lernen/mobile')
  await expect(page.getByText('Nichts fällig')).toBeVisible()

  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Technische Mechanik' }).click()
  await page.getByRole('button', { name: 'Fortsetzen', exact: true }).click()
  await expect(page.getByText(/Pausiert.*seit/)).toHaveCount(0)
  await page.goto('./#/lernen/mobile')
  await expect(page.locator('.flashcard')).toBeVisible()
  expect(errors).toEqual([])
})
