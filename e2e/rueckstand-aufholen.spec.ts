import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard, revealCard } from './helpers'

test('Schalter „Rückstand aufholen“ plant das volle Tagesziel ein', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik', 3)
  await importPackage(page)
  await page.goto('./#/einstellungen')
  await page.locator('input[type=range]').first().fill('5')
  await page.goto('./#/')
  await expect(page.locator('.widget', { hasText: 'Fortschritt' })).toContainText(/\d+ Karten? Rückstand/)

  await page.goto('./#/einstellungen')
  await page.getByLabel('Rückstand aufholen').click()
  await expect(page.getByLabel('Rückstand aufholen')).toBeChecked()
  await page.goto('./#/')
  await expect(page.locator('.widget', { hasText: 'Fortschritt' })).not.toContainText('Rückstand')
  expect(errors).toEqual([])
})

test('Karten im Lernschritt kommen erst nach der angezeigten Zeit wieder', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)
  await page.goto('./#/lernen/mobile')
  const first = await page.locator('.flashcard').innerText()
  await revealCard(page)
  await expect(page.locator('.ratings button', { hasText: 'Nochmal' })).toContainText('min')
  await page.locator('.ratings button', { hasText: 'Nochmal' }).click()
  // Die nächste Karte ist eine andere; die Nochmal-Karte wartet
  await expect(page.locator('.flashcard')).toBeVisible()
  expect(await page.locator('.flashcard').innerText()).not.toBe(first)
  expect(errors).toEqual([])
})
