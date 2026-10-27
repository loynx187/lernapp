import { expect, test } from '@playwright/test'
import { collectErrors, onboard } from './helpers'

const PARAMS =
  '0.4775, 1.2931, 2.6047, 8.2956, 6.2037, 1.0635, 2.7852, 0.2180, 2.1650, 0.0000, 1.0805, 1.7126, 0.0010, 0.4730, 1.9209, 0.6014, 1.8729, 0.3696, 0.3808, 0.3470, 0.4232'

test('Hinweis ab 1000 Bewertungen und persönliche FSRS-Parameter', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await expect(page.getByText('Lernalgorithmus anpassen')).toHaveCount(0)

  // 1000 Bewertungen direkt in die Datenbank schreiben
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('lernapp')
        r.onsuccess = () => {
          const tx = r.result.transaction(['profiles', 'reviews'], 'readwrite')
          tx.objectStore('profiles').getAll().onsuccess = (e) => {
            const pid = (e.target as IDBRequest).result[0].id
            for (let i = 0; i < 1000; i++)
              tx.objectStore('reviews').put({ id: `r${i}`, profileId: pid, examId: 'x', cardId: `c${i % 50}`, mode: 'mobile', rating: 3, stateBefore: 2, reviewedAt: Date.now() - i * 3600e3, durationMs: 5000 })
          }
          tx.oncomplete = () => resolve()
        }
      }),
  )
  await page.reload()
  await page.getByRole('link', { name: 'Lernalgorithmus anpassen' }).click()
  await page.getByPlaceholder(/0.4775/).fill('1, 2, 3')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText(/Erwartet werden 21 Zahlen/)).toBeVisible()
  await page.getByPlaceholder(/0.4775/).fill(PARAMS)
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Persönliche Parameter gespeichert')).toBeVisible()

  await page.goto('./#/')
  await expect(page.locator('.widget').first()).toBeVisible()
  await expect(page.getByText('Lernalgorithmus anpassen')).toHaveCount(0)
  await page.goto('./#/einstellungen')
  await expect(page.getByRole('link', { name: /Lernalgorithmus \(FSRS\)/ })).toContainText('persönlich angepasst')
  expect(errors).toEqual([])
})
