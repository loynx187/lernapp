import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { collectErrors, createExam, onboard, revealCard } from './helpers'

const sample = JSON.parse(readFileSync(new URL('../public/beispiel-paket.json', import.meta.url), 'utf8'))
const socraticPkg = {
  ...sample,
  minApp: '1.19.0',
  cards: sample.cards.map((c: { type?: string }) =>
    c.type === 'task' ? c : { ...c, prompts: ['Was ist hier gegeben?', 'Welcher Zusammenhang gilt?'], keyPoints: ['Erster Kernpunkt', 'Zweiter Kernpunkt'] },
  ),
}

async function importSocratic(page: import('@playwright/test').Page) {
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles({ name: 'paket.lernpaket.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(socraticPkg)) })
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByText('Import abgeschlossen')).toBeVisible()
}

test('Sokratisches Lernen: ausgeschaltet wie bisher, eingeschaltet mit Tipps, Kernpunkten und Bewertungsvorschlag', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Maschinendynamik')
  await importSocratic(page)

  // Standard: aus – keine Tipps, keine Kernpunkte
  await page.goto('./#/lernen/mobile')
  await expect(page.locator('.flashcard')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tipp/ })).toHaveCount(0)
  await revealCard(page)
  await expect(page.locator('.keypoints')).toHaveCount(0)
  await expect(page.locator('.suggestion')).toHaveCount(0)

  // Einschalten
  await page.goto('./#/einstellungen')
  // Die Einstellung wird gespeichert und erst danach im Häkchen angezeigt
  await page.getByLabel('Sokratisches Lernen (Test)').click()
  await expect(page.getByLabel('Sokratisches Lernen (Test)')).toBeChecked()

  await page.goto('./#/lernen/mobile')
  await expect(page.locator('.flashcard')).toBeVisible()
  await page.getByRole('button', { name: 'Tipp (1/2)' }).click()
  await expect(page.locator('.hints')).toContainText('Was ist hier gegeben?')
  await expect(page.locator('.hints')).not.toContainText('Welcher Zusammenhang gilt?')
  await page.getByRole('button', { name: 'Tipp (2/2)' }).click()
  await expect(page.locator('.hints li')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /^Tipp/ })).toHaveCount(0)
  await revealCard(page)

  await expect(page.locator('.keypoints')).toContainText('Erster Kernpunkt')
  await expect(page.locator('.suggestion')).toHaveCount(0)
  await page.getByLabel('Erster Kernpunkt').check()
  await page.getByLabel('Zweiter Kernpunkt').check()
  // Alles gewusst, aber mit Tipps → „Schwer“
  await expect(page.locator('.suggestion')).toContainText('Vorschlag: Schwer – 2 von 2 Kernpunkten, 2 Tipps')
  await expect(page.locator('.ratings button.suggested')).toContainText('Schwer')
  await page.locator('.ratings button', { hasText: 'Gut' }).click()

  // Nächste Karte startet ohne Tipps und Häkchen
  await expect(page.locator('.hints')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tipp (1/2)' })).toBeVisible()

  // Kartenübersicht zeigt Leitfragen und Kernpunkte
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: 'Alle Karten ansehen' }).click()
  await page.locator('details.card-entry summary').first().click()
  await expect(page.locator('details.card-entry').first()).toContainText('Leitfragen')
  await expect(page.locator('details.card-entry').first()).toContainText('Kernpunkte')
  expect(errors).toEqual([])
})
