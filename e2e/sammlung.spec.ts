import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

const sample = JSON.parse(readFileSync(new URL('../public/beispiel-paket.json', import.meta.url), 'utf8'))

test('Paket-Sammlung aktualisiert mehrere Prüfungen in einem Schritt', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Regelungstechnik')
  await createExam(page, 'Qualitätsmanagement')
  await importPackage(page, undefined, 'Regelungstechnik')

  // Update fürs vorhandene Paket (eine Karte korrigiert, eine entfernt) und ein neues Paket für QM
  const [first, , ...rest] = sample.cards
  const bundle = {
    format: 'lernapp-sammlung',
    formatVersion: 1,
    exams: [
      { slug: 'regelungstechnik', packages: [{ ...sample, version: sample.version + 1, cards: [{ ...first, back: 'Korrigierte Antwort' }, ...rest] }] },
      { name: 'Qualitätsmanagement', packages: [{ ...sample, id: 'qm-grundlagen', title: 'QM Grundlagen' }] },
      { name: 'Thermodynamik', packages: [{ ...sample, id: 'thermo' }] },
    ],
  }
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'updates.lernsammlung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) })
  await expect(page.getByRole('heading', { name: 'Paket-Sammlung' })).toBeVisible()
  await expect(page.getByText(`Update ${sample.version} → ${sample.version + 1}`)).toBeVisible()
  await expect(page.getByText('→ Qualitätsmanagement')).toBeVisible()
  await expect(page.getByText('keine passende Prüfung')).toBeVisible()
  await page.getByRole('button', { name: 'Übernehmen' }).click()

  const done = page.locator('.notice', { hasText: 'Paket-Sammlung übernommen.' })
  await expect(done).toContainText('2 Pakete importiert')
  await expect(done).toContainText('1 Karte geändert')
  await expect(done).toContainText('1 archiviert')
  await expect(done).toContainText('Keine passende Prüfung: Thermodynamik')

  // Erneut laden: alles aktuell, nichts zu übernehmen
  await page.locator('input[type=file]').first().setInputFiles({ name: 'updates.lernsammlung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bundle)) })
  await expect(page.getByText('schon aktuell', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Übernehmen' })).toBeDisabled()
  expect(errors).toEqual([])
})
