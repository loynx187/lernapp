import { expect, test } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Laufende Vorlesung: Stoff zeitnah beginnen, Prognose vorläufig, Erinnerung an neue Unterlagen', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Qualitaetsmanagement', 90)
  await importPackage(page)
  await page.goto('./#/pruefungen')
  await page.getByText('Qualitaetsmanagement').click()
  await expect(page.getByText('Prognose Klausurtag')).toBeVisible()

  // Schalter einschalten, Dauer anpassen
  await page.getByRole('link', { name: 'Bearbeiten' }).click()
  await page.getByText('Vorlesung läuft noch').click()
  await expect(page.getByLabel('Tage bis neuer Stoff begonnen ist')).toHaveValue('7')
  await page.getByLabel('Tage bis neuer Stoff begonnen ist').fill('10')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Prognose (vorläufig)')).toBeVisible()
  await expect(page.getByText(/die Vorlesung läuft noch/)).toBeVisible()

  await page.getByRole('link', { name: 'Bearbeiten' }).click()
  await expect(page.getByLabel('Tage bis neuer Stoff begonnen ist')).toHaveValue('10')
  await page.goBack()

  // Zwei Wochen ohne neues Paket → Erinnerung
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('lernapp')
        r.onsuccess = () => {
          const store = r.result.transaction('packages', 'readwrite').objectStore('packages')
          store.getAll().onsuccess = (ev) => {
            for (const p of (ev.target as IDBRequest).result) store.put({ ...p, importedAt: Date.now() - 15 * 864e5 })
            store.transaction.oncomplete = () => resolve()
          }
        }
      }),
  )
  await page.reload()
  await expect(page.getByText('Neue Unterlagen da?')).toBeVisible()
  expect(errors).toEqual([])
})
