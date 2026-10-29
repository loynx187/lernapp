import { expect, test } from '@playwright/test'
import { collectErrors, onboard } from './helpers'

test('Ideen für Version 2: gesammelte Ideen lesen und eigene notieren', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await page.goto('./#/einstellungen')
  await page.getByRole('link', { name: /Ideen für Version 2/ }).click()
  await expect(page.getByText('Sokratisch lernen')).toBeVisible()
  await page.getByText('Leitfragen vor dem Aufdecken').click()
  await expect(page.getByText(/Tipp“ zeigt die nächste Leitfrage/)).toBeVisible()

  await page.getByPlaceholder('Was fehlt dir beim Testen?').fill('Dunkelmodus für Formeln prüfen')
  await page.getByRole('button', { name: 'Notieren' }).click()
  // Erst wenn das Eingabefeld geleert ist, ist die Notiz gespeichert (sonst steht der Text zweimal auf der Seite).
  await expect(page.getByPlaceholder('Was fehlt dir beim Testen?')).toHaveValue('')
  await expect(page.getByText('Dunkelmodus für Formeln prüfen')).toBeVisible()
  // Gespeichert im Profil: auch nach dem Verlassen der Seite noch da
  await page.goto('./#/einstellungen')
  await expect(page.getByRole('link', { name: /Ideen für Version 2/ })).toContainText('1 eigene')
  await page.getByRole('link', { name: /Ideen für Version 2/ }).click()
  await expect(page.getByText('Dunkelmodus für Formeln prüfen')).toBeVisible()
  await page.getByRole('button', { name: 'Notiz löschen' }).click()
  await expect(page.getByText('Dunkelmodus für Formeln prüfen')).toHaveCount(0)
  expect(errors).toEqual([])
})
