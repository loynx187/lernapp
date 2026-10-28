import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

const task = (uid: string, front: string, extra: object = {}) => ({ uid, type: 'task', chapter: 'k2', front, steps: ['Rechnen'], result: '42', answers: [{ value: 42 }], ...extra })
const PKG = {
  format: 'lernapp-paket',
  formatVersion: 1,
  id: 'md-test',
  title: 'Maschinendynamik Test',
  version: 1,
  chapters: [{ id: 'k1', title: 'Fragen' }, { id: 'k2', title: 'Aufgaben' }],
  cards: [
    { uid: 'q1', chapter: 'k1', front: 'Was ist ein Grenzzykel?', back: 'Isolierte periodische Lösung', topics: ['Nichtlinear'] },
    { uid: 'q2', chapter: 'k1', front: 'Was ist das Lehrsche Dämpfungsmaß?', back: 'D = δ/ω0', topics: ['Isolierung'] },
    task('a1', 'Übungsaufgabe Isolierung', { topics: ['Isolierung'] }),
    task('a2', 'Übungsaufgabe Grenzzykel', { topics: ['Nichtlinear'] }),
    task('a3', 'Probeklausur Aufgabe 13', { topics: ['Isolierung'], pastExam: true }),
  ],
}

test('Schreibtischaufgaben sind Zusatz: Probeklausur-Aufgaben zuerst, Fortschritt nur aus Karten', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-aufgaben-'))
  writeFileSync(join(dir, 'md.lernpaket.json'), JSON.stringify(PKG))
  await onboard(page)
  await createExam(page, 'Maschinendynamik', 10)
  await importPackage(page, join(dir, 'md.lernpaket.json'), 'Maschinendynamik')

  // Prüfungsseite: Fortschritt zählt nur die Karten, Aufgaben stehen getrennt
  await page.goto('./#/pruefungen')
  await expect(page.locator('a.card.link').first()).toContainText('2 Karten · 0/3 Aufgaben geübt')
  await page.locator('a.card.link').first().click()
  await expect(page.getByText('Schreibtischaufgaben: 0 von 3 geübt')).toBeVisible()

  // Schreibtisch: die Probeklausur-Aufgabe kommt zuerst, mit Begründung
  await page.goto('./#/lernen/desk')
  await expect(page.locator('.flashcard')).toContainText('Probeklausur Aufgabe 13')
  await expect(page.locator('.recommend-reason')).toContainText('Aufgabe aus einer Probe- bzw. Altklausur')

  // Einstellungen: gemessene Lernzeit (noch zu wenig Daten) und Schalter
  await page.goto('./#/einstellungen')
  await expect(page.getByText(/Ab 3 Lerntagen wird deine tatsächliche Lernzeit gemessen/).first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Budget an die gemessene Lernzeit anpassen' })).toBeChecked()

  expect(errors).toEqual([])
})
