import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard, rate, revealCard } from './helpers'

test('Startseite zeigt Fächer getrennt, empfiehlt eines und lernt nur dieses Fach', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Thermodynamik', 20)
  await importPackage(page, undefined, 'Thermodynamik')
  await createExam(page, 'Werkstoffkunde', 50)
  await importPackage(page, undefined, 'Werkstoffkunde')

  await page.goto('./#/')
  const subjects = page.locator('section.widget')
  await expect(subjects).toHaveCount(2)
  // Empfohlen ist das Fach mit dem meisten offenen Pensum (die nähere Klausur führt mehr neue Karten ein)
  await expect(subjects.first()).toContainText('Thermodynamik')
  await expect(subjects.first()).toContainText('Empfohlen')
  await expect(page.getByRole('link', { name: 'Unterwegs lernen', exact: true })).toContainText('alle Fächer')

  // Nur Werkstoffkunde lernen
  await page.getByRole('link', { name: 'Werkstoffkunde: Unterwegs lernen' }).click()
  const meta = page.locator('.flashcard .meta')
  for (let i = 0; i < 2; i++) {
    await expect(meta).toContainText('Werkstoffkunde')
    await expect(meta).not.toContainText('Thermodynamik')
    await revealCard(page)
    await rate(page, 'Gut')
  }

  // Am Ende wird das nächste Fach angeboten
  await expect(page.getByRole('heading', { name: 'Geschafft!' })).toBeVisible()
  await page.getByRole('link', { name: /Weiter mit Thermodynamik/ }).click()
  await expect(meta).toContainText('Thermodynamik')

  expect(errors).toEqual([])
})
