import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

const PKG = {
  format: 'lernapp-paket',
  formatVersion: 1,
  id: 'rt-skript',
  title: 'Regelungstechnik – Skript',
  version: 1,
  chapters: [{ id: 'k1', title: 'Grundbegriffe' }, { id: 'k2', title: 'Laplace-Transformation', later: true }],
  cards: [
    { uid: 'a', chapter: 'k1', front: 'Was unterscheidet Regelung und Steuerung?', back: 'Rückführung' },
    { uid: 'b', chapter: 'k2', front: 'Laplace-Transformierte der Sprungfunktion?', back: '1/s' },
  ],
  pending: [{ id: 'altklausuren', title: 'Altklausuren', note: 'kommen im Laufe der Vorlesung' }],
}

test('Ganzes Skript importieren, spätere Kapitel pausieren und an fehlende Unterlagen erinnern', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-rt-'))
  writeFileSync(join(dir, 'rt.lernpaket.json'), JSON.stringify(PKG))
  await onboard(page)
  await createExam(page, 'Regelungstechnik')
  await importPackage(page, join(dir, 'rt.lernpaket.json'), 'Regelungstechnik')
  await expect(page.getByText(/1 Kapitel ist in der Vorlesung noch nicht dran und pausiert/)).toBeVisible()
  await expect(page.getByText(/1 fehlende Unterlage eingetragen/)).toBeVisible()

  // Startseite erinnert an die Altklausuren
  await page.goto('./#/')
  const widget = page.getByRole('link', { name: 'Fehlende Unterlagen' })
  await expect(widget).toContainText('Regelungstechnik: Altklausuren')

  // Prüfungsseite: Kapitel 2 ist pausiert und zählt nicht zum Fortschritt
  await widget.click()
  await expect(page.locator('.chapter-row.paused')).toContainText('Laplace-Transformation')
  await expect(page.locator('.stats')).toContainText('0 %')
  // Fortsetzen
  await page.getByRole('button', { name: 'Laplace-Transformation fortsetzen' }).click()
  await expect(page.locator('.chapter-row.paused')).toHaveCount(0)

  // Erinnerung zurückstellen, eigene Unterlage eintragen und abhaken
  await page.getByRole('button', { name: 'Altklausuren später erinnern' }).click()
  await expect(page.getByText(/zurückgestellt bis/)).toBeVisible()
  await page.getByLabel('Fehlende Unterlage').fill('Musterlösung Übungsblatt 3')
  await page.getByRole('button', { name: 'Eintragen' }).click()
  await page.getByRole('button', { name: 'Musterlösung Übungsblatt 3 erledigt' }).click()
  await expect(page.getByText('Erledigt (1)')).toBeVisible()
  await page.goto('./#/')
  await expect(page.getByRole('link', { name: 'Fehlende Unterlagen' })).toHaveCount(0)

  expect(errors).toEqual([])
})
