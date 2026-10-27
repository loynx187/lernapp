import { expect, test } from '@playwright/test'
import { collectErrors, countRows, createExam, importPackage, onboard } from './helpers'

test('Probeklausur durchführen, auswerten und in den Lernplan übernehmen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik', 10)
  await importPackage(page)

  // Widget erscheint in den letzten drei Wochen
  await page.goto('./#/')
  await page.getByRole('link', { name: 'Probeklausur' }).click()
  await page.getByRole('radio', { name: '30 min' }).click()
  await page.getByRole('button', { name: 'Probeklausur starten' }).click()
  await expect(page.locator('.session-top .chip')).toContainText(/\d+:\d{2}/)

  const total = Number((await page.locator('.session-top small').textContent())!.split('/')[1])
  expect(total).toBeGreaterThan(2)
  for (let i = 0; i < total - 1; i++) {
    if (await page.locator('.option').count()) await page.locator('.option').nth(1).click()
    await page.getByRole('button', { name: 'Weiter' }).click()
  }
  await page.getByRole('button', { name: 'Abgeben', exact: true }).click()

  for (let i = 0; i < total; i++) {
    const graded = await page.locator('.segmented button.on').count()
    if (!graded) await page.getByRole('radio', { name: i % 2 ? 'Richtig' : 'Teilweise' }).click()
    await page.getByRole('button', { name: i < total - 1 ? 'Weiter' : 'Zur Auswertung' }).click()
  }
  await expect(page.getByText(/% der Punkte/)).toBeVisible()
  await page.getByRole('button', { name: 'Abschließen' }).click()
  await expect(page.getByRole('button', { name: 'Zur Prüfung' })).toBeVisible()
  expect(await countRows(page, 'reviews')).toBe(total)
  expect(errors).toEqual([])
})
