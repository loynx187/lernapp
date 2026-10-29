import { expect, test } from '@playwright/test'
import { collectErrors, createExam, isoIn, onboard } from './helpers'

test('Erinnerungen: frei anlegen, zu einer Hausaufgabe setzen, auf der Startseite abhaken, per Datei übernehmen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Maschinendynamik')

  // Freie Erinnerung für heute
  await page.goto('./')
  await page.getByRole('link', { name: 'Erinnerung eintragen' }).click()
  await page.getByPlaceholder('z. B. Übungsblatt 3 am Wochenende bearbeiten').fill('Altklausur beim Dozenten anfragen')
  await page.locator('input[type=date]').fill(isoIn(0))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('heading', { name: 'Erinnerungen' })).toBeVisible()
  await expect(page.getByText('Altklausur beim Dozenten anfragen')).toBeVisible()

  // Startseite: fällige Erinnerung abhaken
  await page.goto('./')
  const widget = page.getByRole('region', { name: /Erinnerungen: 1 fällig/ })
  await expect(widget).toContainText('Altklausur beim Dozenten anfragen')
  await widget.getByRole('button', { name: 'Erledigt: Altklausur beim Dozenten anfragen' }).click()
  await expect(page.getByRole('region', { name: /fällig/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Erinnerungen: 0 offen' })).toBeVisible()

  // Hausaufgabe früher bearbeiten: Erinnerung von der Hausaufgabe aus
  await page.goto('./#/hausaufgabe/neu')
  await page.getByPlaceholder('z. B. Übungsblatt 3, Aufgabe 2').fill('Übungsblatt 3')
  await page.locator('input[type=date]').fill(isoIn(10))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await page.getByRole('link', { name: 'Erinnerung zum Bearbeiten setzen' }).click()
  await expect(page.getByPlaceholder('z. B. Übungsblatt 3 am Wochenende bearbeiten')).toHaveValue('„Übungsblatt 3“ bearbeiten')
  await expect(page.locator('input[type=date]')).toHaveValue(isoIn(8))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('.reminder-row', { hasText: 'Übungsblatt 3' })).toContainText('zu „Übungsblatt 3“')

  // Hausaufgabe erledigt → Erinnerung erledigt
  await page.goto('./#/hausaufgaben')
  await page.getByRole('link', { name: /Übungsblatt 3/ }).click()
  await page.getByRole('button', { name: 'Abhaken' }).click()
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await page.getByRole('button', { name: 'Nein' }).click()
  await page.goto('./#/erinnerungen')
  await expect(page.locator('.section-title', { hasText: 'Später' })).toHaveCount(0)
  await expect(page.locator('.reminder-row', { hasText: 'Übungsblatt 3' })).toContainText('Hausaufgabe erledigt')

  // Erinnerung per Datei (z. B. von Claude)
  const file = { format: 'lernapp-erinnerungen', formatVersion: 1, reminders: [{ id: 'pilot-feedback', title: 'Feedback zum Pilot geben', note: 'Tipps zu leicht oder zu schwer?', date: isoIn(0), exam: 'maschinendynamik' }] }
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'erinnerung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) })
  await expect(page.getByText('Tipps zu leicht oder zu schwer?')).toBeVisible()
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.locator('.notice', { hasText: '1 Erinnerung angelegt.' })).toBeVisible()
  await page.goto('./')
  await expect(page.getByRole('region', { name: /Erinnerungen: 1 fällig/ })).toContainText('Feedback zum Pilot geben')
  expect(errors).toEqual([])
})
