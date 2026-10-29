import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

const sample = JSON.parse(readFileSync(new URL('../public/beispiel-paket.json', import.meta.url), 'utf8'))

test('Meldung zu einer Karte, die ein Update entfernt, ist danach erledigt', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Qualitätsmanagement')
  await importPackage(page)

  // Erste Karte der Kartenübersicht melden
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: 'Alle Karten ansehen' }).click()
  const entry = page.locator('details.card-entry').first()
  const front = (await entry.locator('summary').innerText()).trim().split('\n')[0]
  const reported = sample.cards.find((c: { front: string }) => front.includes(c.front.replace(/\*\*/g, '').slice(0, 20)))
  expect(reported).toBeTruthy()
  await entry.locator('summary').click()
  await entry.getByRole('button', { name: 'Melden' }).click()
  await entry.getByRole('button', { name: 'Melden', exact: true }).click()
  await page.getByRole('tab', { name: 'Gemeldet (1)' }).click()
  await expect(page.getByRole('button', { name: 'Meldung exportieren' })).toBeVisible()

  // Update ohne die gemeldete Karte
  const update = { ...sample, version: sample.version + 1, cards: sample.cards.filter((c: { uid: string }) => c.uid !== reported.uid) }
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'update.lernpaket.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(update)) })
  await page.getByRole('button', { name: 'Aktualisieren' }).click()
  await expect(page.locator('.notice', { hasText: 'Import abgeschlossen' })).toContainText('1 Meldung erledigt')

  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await expect(page.getByText(/offene Meldung/)).toHaveCount(0)
  await page.getByRole('link', { name: 'Alle Karten ansehen' }).click()
  await page.getByRole('tab', { name: 'Gemeldet (0)' }).click()
  await expect(page.getByText('Keine offenen Meldungen.')).toBeVisible()
  await expect(page.getByRole('button', { name: /exportieren/ })).toHaveCount(0)
  expect(errors).toEqual([])
})
