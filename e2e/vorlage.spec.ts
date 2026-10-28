import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard, rate, revealCard } from './helpers'

test('Profil als Vorlage ohne Lernfortschritt exportieren und in einem neuen Profil übernehmen', async ({ browser }) => {
  // Quelle: Prüfung mit Beispielpaket, eine Karte gelernt
  const a = await browser.newPage()
  const errorsA = collectErrors(a)
  await onboard(a, { name: 'Leon' })
  await createExam(a, 'Regelungstechnik')
  await importPackage(a)
  await a.goto('./#/lernen/mobile')
  await revealCard(a)
  await rate(a, 'Gut')
  // eine Karte melden – die Meldung geht mit in die Vorlage
  await a.getByRole('button', { name: 'Karte melden' }).click()
  await a.getByRole('button', { name: 'Melden', exact: true }).click()
  await a.getByRole('button', { name: 'Überspringen' }).click()

  await a.goto('./#/einstellungen')
  const download = a.waitForEvent('download')
  await a.getByRole('button', { name: 'Vorlage exportieren' }).click()
  const file = await (await download).path()
  await expect(a.getByText(/Vorlage exportiert: 1 Prüfung, \d+ Karten, 1 offene Meldung/)).toBeVisible()
  // Abgleich im eigenen Profil: gleicher Stand, nichts wird überschrieben
  await a.goto('./#/import')
  await a.locator('input[type=file]').first().setInputFiles(file)
  await expect(a.locator('.notice', { hasText: 'Abgleich mit deinen Karten' })).toContainText('1 gleich')
  await a.getByRole('button', { name: 'Abbrechen' }).click()
  expect(errorsA).toEqual([])

  // Kommilitonin: ein Schritt direkt beim ersten Start
  const b = await (await browser.newContext()).newPage()
  const errorsB = collectErrors(b)
  await b.goto('./')
  await b.getByPlaceholder('Vorname').fill('Lisa')
  await b.locator('input[type=file]').setInputFiles(file)
  await expect(b.getByRole('heading', { name: /Lisa/ })).toBeVisible()
  await b.goto('./#/pruefungen')
  await b.getByText('Regelungstechnik').first().click()
  await expect(b.locator('.stats')).toContainText('0 %')
  expect(errorsB).toEqual([])

  // Vorhandenes Profil ohne Prüfungen: über „Karten importieren“ mit Vorschau
  const c = await (await browser.newContext()).newPage()
  const errorsC = collectErrors(c)
  await onboard(c, { name: 'Max' })
  await c.goto('./#/import')
  await c.locator('input[type=file]').first().setInputFiles(file)
  await expect(c.getByRole('heading', { name: 'Vorlage ohne Lernfortschritt' })).toBeVisible()
  await expect(c.getByText('Regelungstechnik')).toBeVisible()
  await expect(c.getByText(/1 offene Meldung/)).toBeVisible()
  await c.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(c.locator('.notice', { hasText: 'Vorlage übernommen.' })).toContainText('1 Prüfung neu')
  await expect(c.locator('.notice', { hasText: 'Vorlage übernommen.' })).toContainText('1 offene Meldung')
  expect(errorsC).toEqual([])
})
