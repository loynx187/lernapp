import { expect, test, type Page } from '@playwright/test'
import { collectErrors, createExam, importPackage, onboard, rate, revealCard } from './helpers'

/** Ändert Datensätze direkt in der lokalen Datenbank (simuliert vergangene Zeit oder beschädigte Daten). */
async function patchAll(page: Page, table: string, patch: Record<string, unknown>) {
  await page.evaluate(
    ([t, p]) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open('lernapp')
        r.onsuccess = () => {
          const store = r.result.transaction(t as string, 'readwrite').objectStore(t as string)
          store.getAll().onsuccess = (ev) => {
            for (const row of (ev.target as IDBRequest).result) store.put({ ...row, ...(p as object) })
            store.transaction.oncomplete = () => resolve()
          }
        }
      }),
    [table, patch] as const,
  )
}

test('Ohne Dropbox erinnert die App nach einer Woche an eine Sicherung', async ({ page }) => {
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Werkstoffkunde')
  await importPackage(page)
  await page.goto('./#/lernen/mobile')
  await revealCard(page)
  await rate(page, 'Gut')
  await page.goto('./#/')
  await expect(page.getByText('Noch keine Sicherung')).toHaveCount(0)

  await patchAll(page, 'reviews', { reviewedAt: Date.now() - 8 * 864e5 })
  await page.reload()
  await expect(page.getByText('Noch keine Sicherung')).toBeVisible()

  await page.getByText('Noch keine Sicherung').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sicherung exportieren' }).click()
  expect((await download).suggestedFilename()).toMatch(/^lernapp-sicherung-/)
  await page.goto('./#/')
  await expect(page.locator('.widget').first()).toBeVisible()
  await expect(page.getByText(/Noch keine Sicherung|Letzte Sicherung vor/)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Anzeigefehler führen zu einer Fehlerseite mit Ausweg statt einer weißen Seite', async ({ page }) => {
  collectErrors(page)
  await onboard(page)
  await createExam(page, 'Werkstoffkunde')
  const url = page.url()
  await patchAll(page, 'exams', { name: { kaputt: true } })
  await page.goto(url)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('Hier ist etwas schiefgelaufen')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Sicherung exportieren' }).click()
  expect((await download).suggestedFilename()).toMatch(/^lernapp-sicherung-/)
  await expect(page.getByRole('button', { name: 'Sicherung erstellt ✓' })).toBeVisible()
})
