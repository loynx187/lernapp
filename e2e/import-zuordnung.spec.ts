import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, onboard } from './helpers'

test('Import ordnet einzelne Pakete selbst der richtigen Prüfung zu, der Auftrag kommt von der Seite Prüfungen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-zuordnung-'))
  await onboard(page)
  await createExam(page, 'Regelungstechnik')
  await createExam(page, 'Werkstoffkunde', 70)

  // Neues Paket: am Fachnamen erkannt, obwohl die Import-Seite ohne Prüfung geöffnet wurde
  const pkg = JSON.parse(readFileSync('public/beispiel-paket.json', 'utf8'))
  pkg.id = 'wk-grundlagen'
  pkg.module = 'Werkstoffkunde'
  const file = join(dir, 'wk.lernpaket.json')
  writeFileSync(file, JSON.stringify(pkg))
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByLabel('Für welche Prüfung?')).toHaveValue(/.+/)
  await expect(page.getByLabel('Für welche Prüfung?').locator('option:checked')).toHaveText('Werkstoffkunde')
  await expect(page.getByText('Erkannt am Fachnamen im Paket.')).toBeVisible()
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()

  // Update mit abweichendem Fachnamen: bleibt in der Prüfung, in der das Paket schon liegt
  writeFileSync(file, JSON.stringify({ ...pkg, module: 'Regelungstechnik', version: pkg.version + 1 }))
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles(file)
  await expect(page.getByLabel('Für welche Prüfung?').locator('option:checked')).toHaveText('Werkstoffkunde')
  await expect(page.getByText('Erkannt: Das Paket liegt schon in dieser Prüfung.')).toBeVisible()
  await page.getByRole('button', { name: 'Aktualisieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()

  // Unbekanntes Fach bei mehreren Prüfungen: erst nach der Auswahl importierbar
  await page.goto('./#/import')
  await page.getByRole('button', { name: 'Beispielpaket ausprobieren' }).click()
  await expect(page.getByText('Keine passende Prüfung erkannt – bitte wählen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importieren' })).toBeDisabled()
  await page.getByLabel('Für welche Prüfung?').selectOption({ label: 'Regelungstechnik' })
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()

  // Prüfungsseite: kein eigener Auftrag und kein Import mehr, nur der Verweis
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link', { hasText: 'Werkstoffkunde' }).click()
  await expect(page.getByText('Fachprofil für Claude')).toBeVisible()
  await expect(page.getByRole('button', { name: /Auftrag/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Paket importieren oder aktualisieren' })).toHaveCount(0)

  // Ein Auftrag für alle Prüfungen
  await page.goto('./#/pruefungen')
  await page.getByRole('button', { name: 'Auftrag für Claude kopieren' }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  const order = JSON.parse(text.split('```json\n')[1].split('\n```')[0])
  expect(order.exams.map((e: { name: string }) => e.name)).toEqual(['Regelungstechnik', 'Werkstoffkunde'])
  expect(order.exams[1].packages[0]).toMatchObject({ id: 'wk-grundlagen', version: pkg.version + 1 })
  expect(errors).toEqual([])
})
