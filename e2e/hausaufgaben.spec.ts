import { expect, test } from '@playwright/test'
import { collectErrors, createExam, isoIn, onboard } from './helpers'

test('Hausaufgaben anlegen, am Schreibtisch erledigen, vorziehen und als Übung behalten', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Steuerungstechnik')

  // Fällige Hausaufgabe über die Prüfungsseite anlegen
  await page.getByRole('link', { name: 'Hausaufgabe hinzufügen' }).click()
  await page.getByPlaceholder('z. B. Übungsblatt 3, Aufgabe 2').fill('KV-Diagramm Blatt 2')
  await page.getByPlaceholder(/Aufgabenstellung/).fill('Vereinfache $Y = X_1 X_2 + X_1 \\overline{X_2}$')
  await page.locator('input[type=date]').fill(isoIn(2))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('heading', { name: 'KV-Diagramm Blatt 2' })).toBeVisible()

  // Noch nicht fällige Hausaufgabe direkt von der Startseite aus eintragen
  await page.goto('./#/')
  await page.getByRole('link', { name: 'Hausaufgabe eintragen' }).click()
  await page.getByPlaceholder('z. B. Übungsblatt 3, Aufgabe 2').fill('SCL-Ampel')
  await page.locator('input[type=date]').fill(isoIn(14))
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('heading', { name: 'SCL-Ampel' })).toBeVisible()

  // Startseite: Hausaufgaben-Widget und Schreibtisch
  await page.goto('./#/')
  await expect(page.getByRole('link', { name: 'Hausaufgaben: 2 offen' })).toBeVisible()
  await page.getByRole('link', { name: 'Schreibtisch lernen', exact: true }).click()

  // Fällige Hausaufgabe kommt zuerst; abhaken mit Lösung und als Übung behalten
  await expect(page.locator('.flashcard')).toContainText('KV-Diagramm Blatt 2')
  await page.getByRole('button', { name: 'Abhaken' }).click()
  await page.getByPlaceholder('Ergebnis oder Notizen (optional)').fill('Y = X1')
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await page.getByRole('button', { name: 'Ja, behalten' }).click()

  // Danach: keine fällige mehr, die spätere lässt sich vorziehen
  await page.getByRole('link', { name: 'Hausaufgabe vorziehen (1)' }).click()
  await expect(page.getByText('Noch nicht fällig')).toBeVisible()
  await page.getByRole('link', { name: /SCL-Ampel/ }).click()
  await page.getByRole('button', { name: 'Abhaken' }).click()
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await page.getByRole('button', { name: 'Nein' }).click()
  await expect(page.getByText('Erledigt', { exact: true })).toBeVisible()

  // Die behaltene Hausaufgabe ist jetzt eine Übungsaufgabe der Prüfung
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: /Alle Karten ansehen/ }).click()
  const entry = page.locator('details.card-entry', { hasText: 'KV-Diagramm Blatt 2' })
  await expect(entry).toHaveCount(1)
  await entry.locator('summary').click()
  await expect(entry).toContainText('Y = X1')

  expect(errors).toEqual([])
})
