import { expect, test } from '@playwright/test'
import { collectErrors, countRows, createExam, importPackage, onboard } from './helpers'

test('Gemeldete Karte überspringen: ohne Bewertung, pausiert bis die Meldung erledigt ist', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)

  await page.goto('./#/lernen/mobile?extra=4')
  const flashcard = page.locator('.flashcard')
  await expect(flashcard).toBeVisible()
  const question = (await flashcard.innerText()).trim().split('\n').pop()!
  await page.getByRole('button', { name: 'Karte melden' }).click()
  await page.getByRole('button', { name: 'Melden', exact: true }).click()
  await page.getByRole('button', { name: 'Überspringen' }).click()
  await expect(page.getByText(question)).toHaveCount(0)
  expect(await countRows(page, 'reviews')).toBe(0)

  // Neue Sitzung: die gemeldete Karte kommt nicht mehr dran
  await page.goto('./#/')
  await page.goto('./#/lernen/mobile?extra=20')
  await expect(flashcard).toBeVisible()
  await expect(page.getByText(question)).toHaveCount(0)

  // Meldung abhaken → Karte ist wieder im Plan (in der Kartenübersicht nicht mehr „pausiert“)
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  await page.getByRole('link', { name: /1 offene Meldung/ }).click()
  await expect(page.locator('details.card-entry')).toContainText('gemeldet, pausiert')
  await page.getByRole('button', { name: 'Erledigt' }).click()
  await page.getByRole('tab', { name: /Alle/ }).click()
  await expect(page.getByText('pausiert')).toHaveCount(0)

  expect(errors).toEqual([])
})
