import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Karte in der Lernsitzung löschen und in der Kartenübersicht wiederherstellen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)

  // Erste Karte der Sitzung löschen – sie verschwindet aus der Sitzung
  await page.goto('./#/lernen/mobile')
  const flashcard = page.locator('.flashcard')
  await expect(flashcard).toBeVisible()
  const question = (await flashcard.innerText()).trim().split('\n').pop()!
  await page.getByRole('button', { name: 'Karte löschen' }).click()
  await expect(page.getByText(question)).toHaveCount(0)

  // Prüfungsseite verlinkt die gelöschte Karte in die Kartenübersicht
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: /1 gelöschte Karte/ }).click()
  await expect(page.getByRole('tab', { name: 'Gelöscht (1)' })).toHaveAttribute('aria-selected', 'true')
  const deleted = page.locator('details.card-entry')
  await expect(deleted).toHaveCount(1)
  await expect(deleted).toContainText(question.replace(/[*_$#>{}]/g, '').slice(0, 20))

  // Ein erneuter Import des Pakets bringt die Karte nicht zurück
  await importPackage(page)
  await expect(page.getByText('1 von dir gelöscht')).toBeVisible()
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: /1 gelöschte Karte/ }).click()
  await expect(deleted).toHaveCount(1)

  // Wiederherstellen
  await deleted.locator('summary').click()
  await deleted.getByRole('button', { name: 'Wiederherstellen' }).click()
  await expect(page.getByText('Keine gelöschten Karten.')).toBeVisible()
  await page.getByRole('tab', { name: /Alle/ }).click()
  await expect(page.locator('details.card-entry', { hasText: question.replace(/[*_$#>{}]/g, '').slice(0, 20) })).toHaveCount(1)

  expect(errors).toEqual([])
})
