import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

// 12 Kapitel à 2 Karten, die letzten 3 noch nicht in der Vorlesung
const PKG = {
  format: 'lernapp-paket',
  formatVersion: 1,
  id: 'skript',
  title: 'Skript',
  version: 1,
  chapters: Array.from({ length: 12 }, (_, i) => ({ id: `k${i + 1}`, title: `Kapitel ${i + 1}`, ...(i >= 9 ? { later: true } : {}) })),
  cards: Array.from({ length: 24 }, (_, i) => ({ uid: `c${i}`, chapter: `k${Math.floor(i / 2) + 1}`, front: `Frage ${i}`, back: `Antwort ${i}` })),
}

test('Prüfungsseite: gekürzte Kapitelliste, Erklärungen zum Aufklappen, auf dem iPad zweispaltig', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-seite-'))
  writeFileSync(join(dir, 'skript.lernpaket.json'), JSON.stringify(PKG))
  await onboard(page)
  await createExam(page, 'Regelungstechnik')
  await importPackage(page, join(dir, 'skript.lernpaket.json'), 'Regelungstechnik')
  await page.goto('./#/pruefungen')
  await page.getByText('Regelungstechnik').first().click()

  // Nur die nächsten 5 offenen Kapitel, Rest per Knopf
  await expect(page.locator('.chapter-row')).toHaveCount(5)
  await page.getByRole('button', { name: 'Alle 12 Kapitel anzeigen (3 pausiert)' }).click()
  await expect(page.locator('.chapter-row')).toHaveCount(12)
  await expect(page.locator('.chapter-row.paused')).toHaveCount(3)
  await page.getByRole('button', { name: 'Weniger anzeigen' }).click()
  await expect(page.locator('.chapter-row')).toHaveCount(5)

  // Kennzahlen: Ziel genannt, „abrufbar“ erst ab 10 begonnenen Karten
  await expect(page.locator('.stats')).toContainText('Ziel 90 %')
  await expect(page.locator('.stats')).toContainText('ab 10 begonnenen Karten')
  await expect(page.getByText(/Anteil der Karten, die du am Klausurtag/)).toBeHidden()
  await page.getByText('Wie wird die Prognose berechnet?').click()
  await expect(page.getByText(/Anteil der Karten, die du am Klausurtag/)).toBeVisible()

  // iPhone: einspaltig; iPad quer: Verwaltung rechts neben dem Lernbereich
  const main = page.locator('.exam-main')
  const side = page.locator('.exam-side')
  expect((await side.boundingBox())!.y).toBeGreaterThan((await main.boundingBox())!.y + 100)
  await page.setViewportSize({ width: 1180, height: 820 })
  await expect.poll(async () => (await side.boundingBox())!.x).toBeGreaterThan((await main.boundingBox())!.x + 300)
  expect(errors).toEqual([])
})
