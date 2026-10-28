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

  await a.goto('./#/einstellungen')
  const download = a.waitForEvent('download')
  await a.getByRole('button', { name: 'Vorlage exportieren' }).click()
  const file = await (await download).path()
  await expect(a.getByText(/Vorlage exportiert: 1 Prüfung/)).toBeVisible()
  expect(errorsA).toEqual([])

  // Ziel: neues Gerät ohne Prüfungen
  const b = await (await browser.newContext()).newPage()
  const errorsB = collectErrors(b)
  await onboard(b, { name: 'Lisa' })
  await b.goto('./#/import')
  await b.locator('input[type=file]').first().setInputFiles(file)
  await expect(b.getByRole('heading', { name: 'Vorlage ohne Lernfortschritt' })).toContainText('Vorlage')
  await expect(b.getByText('Regelungstechnik')).toBeVisible()
  await b.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(b.locator('.notice', { hasText: 'Vorlage übernommen.' })).toContainText('1 Prüfung neu')

  // Karten sind da, aber noch nichts begonnen
  await b.goto('./#/pruefungen')
  await b.getByText('Regelungstechnik').first().click()
  await expect(b.locator('.stats')).toContainText('0 %')
  expect(errorsB).toEqual([])
})
