import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Karte in der Lernsitzung löschen und auf der Prüfungsseite wiederherstellen', async ({ page }) => {
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

  // Prüfungsseite listet die gelöschte Karte
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  const deleted = page.locator('.list-item', { has: page.getByRole('button', { name: 'Wiederherstellen' }) })
  await expect(page.getByText('Gelöschte Karten', { exact: true })).toBeVisible()
  await expect(deleted).toHaveCount(1)
  await expect(deleted).toContainText(question.replace(/[*_$#>{}]/g, '').slice(0, 20))

  // Ein erneuter Import des Pakets bringt die Karte nicht zurück
  await importPackage(page)
  await expect(page.getByText('1 von dir gelöscht')).toBeVisible()
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await expect(deleted).toHaveCount(1)

  // Wiederherstellen
  await deleted.getByRole('button', { name: 'Wiederherstellen' }).click()
  await expect(page.getByText('Gelöschte Karten', { exact: true })).toHaveCount(0)

  expect(errors).toEqual([])
})
