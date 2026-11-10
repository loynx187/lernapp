import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectErrors, createExam, onboard } from './helpers'

const sample = JSON.parse(readFileSync(new URL('../public/beispiel-paket.json', import.meta.url), 'utf8'))
const pkg = {
  ...sample,
  minApp: '1.19.0',
  cards: sample.cards.map((c: { type?: string }) => (c.type === 'task' ? c : { ...c, prompts: ['Was ist hier gegeben?', 'Welcher Zusammenhang gilt?'] })),
}

test('Karte und Tipps in der Lernsitzung bearbeiten, in der Kartenübersicht zurücksetzen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Maschinendynamik')
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'paket.lernpaket.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pkg)) })
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()
  await page.goto('./#/einstellungen')
  await page.getByLabel('Sokratisches Lernen (Test)').click()
  await expect(page.getByLabel('Sokratisches Lernen (Test)')).toBeChecked()

  await page.goto('./#/lernen/mobile')
  await expect(page.locator('.flashcard')).toBeVisible()
  await page.getByRole('button', { name: 'Karte bearbeiten' }).click()
  const front = page.getByLabel('Frage')
  const original = await front.inputValue()
  await front.fill('Meine eigene Frage?')
  await page.getByLabel('Tipps').fill('Mein eigener Tipp?\nZweiter Tipp?')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('.flashcard')).toContainText('Meine eigene Frage?')
  await page.getByRole('button', { name: 'Tipp (1/2)' }).click()
  await expect(page.locator('.hints')).toContainText('Mein eigener Tipp?')

  // Leere Frage wird nicht gespeichert
  await page.getByRole('button', { name: 'Karte bearbeiten' }).click()
  await page.getByLabel('Frage').fill('  ')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('alert')).toContainText('nicht leer')
  await page.getByRole('button', { name: 'Abbrechen' }).click()

  // Kartenübersicht: als bearbeitet markiert, Paketfassung wiederherstellen
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Maschinendynamik' }).click()
  const examId = page.url().split('/pruefung/')[1]
  await page.goto(`./#/pruefung/${examId}/karten`)
  const item = page.locator('details', { hasText: 'Meine eigene Frage?' })
  await expect(item).toContainText('bearbeitet')
  await item.locator('summary').click()
  await item.getByRole('button', { name: 'Bearbeiten' }).click()
  await item.getByRole('button', { name: 'Paketfassung wiederherstellen' }).click()
  await expect(page.locator('details', { hasText: 'Meine eigene Frage?' })).toHaveCount(0)
  await expect(page.getByText(original.split('\n')[0].replace(/\*\*/g, '').slice(0, 20)).first()).toBeVisible()
  expect(errors).toEqual([])
})
