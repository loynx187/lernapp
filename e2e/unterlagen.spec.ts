import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, type Browser, type TestInfo } from '@playwright/test'
import { collectErrors, connectDropbox, createExam, importPackage, newDropbox, onboard, revealCard, useFakeDropbox, type FakeDropbox } from './helpers'

const PACKAGE = 'e2e/fixtures/folien-paket.json'

/**
 * Erzeugt ein selbst gestaltetes Test-PDF mit drei Seiten („Testfolie 1–3“). Der Pfad darf keine
 * Umlaute enthalten (Testnamen tun das) – sonst wählt Chromium die Datei stillschweigend nicht aus.
 */
async function makePdf(browser: Browser, info: TestInfo): Promise<string> {
  const dir = join(tmpdir(), `lernapp-e2e-${info.testId}`)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, 'Testskript.pdf')
  const page = await browser.newPage()
  await page.setContent(
    [1, 2, 3].map((i) => `<section style="height:90vh;display:flex;align-items:center;justify-content:center;font:48px sans-serif;${i > 1 ? 'page-break-before:always' : ''}">Testfolie ${i}</section>`).join(''),
  )
  await page.pdf({ path, width: '1280px', height: '720px' })
  await page.close()
  return path
}

async function device(browser: Browser, box?: FakeDropbox) {
  const ctx = await browser.newContext()
  if (box) await useFakeDropbox(ctx, box)
  const page = await ctx.newPage()
  return { ctx, page, errors: collectErrors(page) }
}

test('Unterlagen einmal auswählen und auf allen Geräten nutzen (Dropbox)', async ({ browser }, info) => {
  const pdf = await makePdf(browser, info)
  const box = newDropbox()

  // Gerät A: Unterlagen auf einmal zuordnen – wandern automatisch nach Dropbox
  const A = await device(browser, box)
  await onboard(A.page)
  await createExam(A.page, 'Testfach')
  await importPackage(A.page, PACKAGE)
  await connectDropbox(A.page)
  await A.page.goto('./#/unterlagen')
  await expect(A.page.getByText('0 von 1 Unterlagen auf diesem Gerät')).toBeVisible()
  await A.page.locator('input[type=file][multiple]').setInputFiles([pdf])
  await expect(A.page.getByText(/1 Unterlage zugeordnet und in Dropbox abgelegt/)).toBeVisible()
  await expect(A.page.getByText('auf diesem Gerät', { exact: true })).toBeVisible()
  expect(box.files.has('/unterlagen/testskript.pdf')).toBe(true)

  // Gerät B: Profil übernehmen, Folie öffnet sich ohne Dateiauswahl
  const B = await device(browser, box)
  await B.page.goto('./')
  await B.page.getByRole('button', { name: /Profil von einem anderen Gerät laden/ }).click()
  await B.page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(B.page.locator('.widget').first()).toBeVisible()
  await B.page.goto('./#/lernen/mobile?extra=1')
  await revealCard(B.page)
  await B.page.getByRole('button', { name: 'Folie ansehen' }).click()
  await expect(B.page.locator('.slide-canvas canvas')).toBeVisible()
  await expect(B.page.locator('.sheet-panel')).toContainText('Seite 1 von 3')

  expect([...A.errors, ...B.errors]).toEqual([])
  await A.ctx.close()
  await B.ctx.close()
})

test('Ohne Dropbox: Unterlage einmal pro Gerät auswählen', async ({ browser, page }, info) => {
  const pdf = await makePdf(browser, info)
  const errors = collectErrors(page)
  await onboard(page)
  await createExam(page, 'Testfach')
  await importPackage(page, PACKAGE)
  await page.goto('./#/lernen/mobile?extra=3')
  await revealCard(page)
  await page.getByRole('button', { name: 'Folie ansehen' }).click()
  await expect(page.getByText(/ist auf diesem Gerät noch nicht vorhanden/)).toBeVisible()
  await page.locator('.sheet input[type=file]').setInputFiles(pdf)
  await expect(page.locator('.slide-canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Schließen' }).click()

  // Beim nächsten Öffnen direkt vom Gerät
  await page.getByRole('button', { name: 'Folie ansehen' }).click()
  await expect(page.locator('.slide-canvas canvas')).toBeVisible()
  await page.getByRole('button', { name: 'Schließen' }).click()
  await page.goto('./#/unterlagen')
  await expect(page.getByText('1 von 1 Unterlagen auf diesem Gerät.')).toBeVisible()
  expect(errors).toEqual([])
})
