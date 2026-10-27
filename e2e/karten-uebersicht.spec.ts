import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, onboard } from './helpers'

// So geben ChatGPT & Co. Karten nach der Vorlage aus der App aus
const CHATGPT = `## Grundlagen
**F1:** Was ist Qualität?
**A1:** Grad, in dem inhärente Merkmale Anforderungen erfüllen.

F: Was ist ein inhärentes Merkmal?
A: Ein Merkmal, das dem Produkt innewohnt.

## Prozesse
F: Nenne die drei Prozessarten.
A: Führungs-, Kern- und Unterstützungsprozesse.
`

test('Karten aus anderen Tools importieren, ansehen, melden, löschen und wiederherstellen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-text-'))
  await onboard(page)
  await createExam(page, 'Qualitaetsmanagement')

  // Vorlage für andere KI-Tools kopieren
  await page.goto('./#/import')
  await page.getByRole('button', { name: 'Vorlage für ChatGPT & Co. kopieren' }).click()
  await expect(page.getByRole('button', { name: 'Vorlage kopiert ✓' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('## Kapitelname')

  // Datei eines Kommilitonen: Titel aus dem Dateinamen, Kapitel aus den Überschriften
  const file = join(dir, 'QM_Zusammenfassung_Lisa.txt')
  writeFileSync(file, CHATGPT)
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue('QM Zusammenfassung Lisa')
  await expect(page.getByText('3 Karten in 2 Kapiteln.')).toBeVisible()
  await page.getByRole('button', { name: '3 Karten importieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()

  // Erneuter Import mit gleichem Titel aktualisiert das Paket statt ein zweites anzulegen
  await page.locator('input[type=file]').first().setInputFiles(file)
  await page.getByRole('button', { name: '3 Karten importieren' }).click()
  await expect(page.getByText('0 neu, 0 aktualisiert, 3 unverändert')).toBeVisible()

  // Kartenübersicht von der Prüfungsseite aus
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: /Alle Karten ansehen/ }).click()
  await expect(page.getByRole('heading', { name: 'Karten und Meldungen' })).toBeVisible()
  const entries = page.locator('details.card-entry')
  await expect(entries).toHaveCount(3)
  await expect(page.getByText('Grundlagen', { exact: true })).toBeVisible()
  await expect(page.getByText('Prozesse', { exact: true })).toBeVisible()

  // Suche
  await page.getByPlaceholder('Karten durchsuchen').fill('prozessarten')
  await expect(entries).toHaveCount(1)
  await page.getByPlaceholder('Karten durchsuchen').fill('')

  // Karte aufklappen und melden
  const first = entries.first()
  await first.locator('summary').click()
  await expect(first).toContainText('Grad, in dem inhärente Merkmale Anforderungen erfüllen.')
  await first.getByRole('button', { name: 'Melden' }).click()
  await first.getByRole('radio', { name: 'Unklar formuliert' }).click()
  await first.getByPlaceholder('Was stimmt nicht? (optional)').fill('Quelle fehlt')
  await first.getByRole('button', { name: 'Melden' }).click()
  await expect(first).toContainText('gemeldet')

  // Filter „Gemeldet“: Meldung abhaken
  await page.getByRole('tab', { name: 'Gemeldet (1)' }).click()
  await expect(entries).toHaveCount(1)
  await expect(page.getByText('Unklar formuliert · Quelle fehlt')).toBeVisible()
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await expect(page.getByText('Keine offenen Meldungen.')).toBeVisible()

  // Löschen und wiederherstellen
  await page.getByRole('tab', { name: /Alle/ }).click()
  await entries.last().locator('summary').click()
  await entries.last().getByRole('button', { name: 'Löschen' }).click()
  await expect(entries).toHaveCount(2)
  await page.getByRole('tab', { name: 'Gelöscht (1)' }).click()
  await entries.first().locator('summary').click()
  await entries.first().getByRole('button', { name: 'Wiederherstellen' }).click()
  await expect(page.getByRole('tab', { name: 'Alle (3)' })).toBeVisible()

  expect(errors).toEqual([])
})
