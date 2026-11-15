import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, isoIn, onboard } from './helpers'

test('Wochenplan: freier Tag plant nichts ein, Lernzeit je Wochentag lässt sich wählen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)
  await page.goto('./#/')
  const unterwegs = page.locator('.widget', { hasText: 'Unterwegs' })
  await expect(unterwegs).toContainText('neu')

  await page.goto('./#/einstellungen')
  await page.getByRole('radiogroup', { name: 'Lernzeit Sa' }).getByRole('radio', { name: '3×' }).click()
  await expect(page.getByRole('radiogroup', { name: 'Lernzeit Sa' }).getByRole('radio', { name: '3×' })).toHaveAttribute('aria-checked', 'true')
  // Heute freinehmen
  await page.getByLabel('Freier Tag').fill(isoIn(0))
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expect(page.getByRole('button', { name: /Freien Tag .* entfernen/ })).toBeVisible()

  await page.goto('./#/')
  await expect(unterwegs).toContainText('Heute frei')
  expect(errors).toEqual([])
})
