import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Schreibtisch-Widget führt wie Unterwegs zur Fachauswahl – auch Fächer ohne eingeplante Aufgaben lassen sich üben', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Thermodynamik', 20)
  await importPackage(page, undefined, 'Thermodynamik')
  await createExam(page, 'Werkstoffkunde', 50)
  await importPackage(page, undefined, 'Werkstoffkunde')

  await page.goto('./#/')
  await page.getByRole('link', { name: 'Schreibtisch lernen', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schreibtisch lernen' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Alle Fächer lernen' })).toBeVisible()
  // Beide Fächer haben Aufgaben – jedes ist wählbar, eingeplant („lernen“) oder zum Üben nach Bedarf („üben“)
  for (const name of ['Thermodynamik', 'Werkstoffkunde']) await expect(page.getByRole('link', { name: new RegExp(`^${name} (lernen|üben)$`) })).toBeVisible()

  await page.getByRole('link', { name: /^Werkstoffkunde (lernen|üben)$/ }).click()
  await expect(page.locator('.flashcard .meta')).toContainText('Werkstoffkunde')
  await expect(page.locator('.flashcard .meta')).not.toContainText('Thermodynamik')
  expect(errors).toEqual([])
})
