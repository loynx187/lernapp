import { expect, test } from '@playwright/test'
import { collectErrors, connectDropbox, countRows, createExam, importPackage, newDropbox, onboard, rate, revealCard, useFakeDropbox } from './helpers'

test('Zwei Geräte über Dropbox: verbinden, übernehmen, abgleichen, sichern', async ({ browser }) => {
  const box = newDropbox()

  // Gerät A: Profil anlegen, lernen, verbinden
  const ctxA = await browser.newContext()
  await useFakeDropbox(ctxA, box)
  const a = await ctxA.newPage()
  const errorsA = collectErrors(a)
  await onboard(a)
  await createExam(a, 'Technische Mechanik')
  await importPackage(a)
  await a.goto('./#/lernen/mobile?extra=2')
  for (let i = 0; i < 2; i++) {
    await revealCard(a)
    await rate(a, 'Einfach')
  }
  await connectDropbox(a)
  const files = [...box.files.keys()]
  expect(files.some((f) => f.startsWith('/sync/'))).toBe(true)
  expect(files).toContain('/erinnerung.txt')
  expect(files.some((f) => f.startsWith('/backups/'))).toBe(true)
  expect(box.files.get('/erinnerung.txt')!.body.toString()).toMatch(/^Lernplan/)

  // Gerät B: Profil aus Dropbox übernehmen
  const ctxB = await browser.newContext()
  await useFakeDropbox(ctxB, box)
  const b = await ctxB.newPage()
  const errorsB = collectErrors(b)
  await b.goto('./')
  await b.getByRole('button', { name: /Profil von einem anderen Gerät laden/ }).click()
  await b.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(b.locator('.widget').first()).toBeVisible()
  await expect(b.locator('.page-header')).toContainText('synchronisiert')
  expect(await countRows(b, 'reviews')).toBe(2)

  // B lernt weiter, A übernimmt den Stand
  await b.goto('./#/lernen/mobile?extra=1')
  await revealCard(b)
  await rate(b, 'Gut')
  await b.goto('./#/einstellungen')
  await b.getByRole('button', { name: 'Jetzt abgleichen' }).click()
  await expect(b.getByText(/Zuletzt abgeglichen/)).toBeVisible()
  await a.getByRole('button', { name: 'Jetzt abgleichen' }).click()
  await expect.poll(() => countRows(a, 'reviews')).toBe(3)

  // Ohne Änderungen fragt der Abgleich nur die Dateiversion ab
  await expect(a.getByRole('button', { name: 'Jetzt abgleichen' })).toBeEnabled()
  box.requests.length = 0
  await a.getByRole('button', { name: 'Jetzt abgleichen' }).click()
  await expect.poll(() => box.requests.length).toBeGreaterThan(0)
  await a.waitForTimeout(500)
  // (ein automatischer Abgleich kann zeitgleich laufen – auch er darf nur die Version abfragen)
  expect(new Set(box.requests)).toEqual(new Set(['files/get_metadata']))

  // Wochensicherung ist sichtbar
  await a.getByRole('button', { name: 'Wochensicherungen anzeigen' }).click()
  await expect(a.getByRole('button', { name: 'Wiederherstellen' })).toBeVisible()

  expect([...errorsA, ...errorsB]).toEqual([])
  await ctxA.close()
  await ctxB.close()
})
