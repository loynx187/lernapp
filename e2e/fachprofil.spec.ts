import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, onboard } from './helpers'

test('Fachprofil hinterlegen, Auftrag kopieren, Vorschläge von Claude übernehmen', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-profil-'))
  await onboard(page)
  await createExam(page, 'Thermodynamik')

  // Fachprofil teilweise ausfüllen
  await page.getByRole('link', { name: 'Ausfüllen' }).click()
  await page.getByPlaceholder('z. B. schriftliche Klausur').fill('schriftlich')
  await page.getByRole('radio', { name: 'Hoch' }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('schriftlich · Rechenaufgaben: hoch')).toBeVisible()

  // Auftrag kopieren
  await page.getByRole('button', { name: 'Auftrag für Claude kopieren' }).click()
  await expect(page.getByRole('button', { name: 'Auftrag kopiert ✓' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/^\/kartenpaket Thermodynamik/)
  const order = JSON.parse(text.split('```json\n')[1].split('\n```')[0])
  expect(order.exams[0]).toMatchObject({ slug: 'thermodynamik', profile: { form: 'schriftlich', taskShare: 'hoch' } })

  // Paket mit Profilvorschlag: eigene Angaben bleiben, leere Felder werden ergänzt
  const pkg = JSON.parse(readFileSync('public/beispiel-paket.json', 'utf8'))
  pkg.profile = { form: 'mündlich', aids: 'Taschenrechner' }
  const pkgFile = join(dir, 'paket.lernpaket.json')
  writeFileSync(pkgFile, JSON.stringify(pkg))
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles(pkgFile)
  await page.getByRole('button', { name: 'Importieren' }).click()
  await expect(page.getByText('Claude hat fürs Fachprofil vorgeschlagen: Hilfsmittel.')).toBeVisible()
  await page.getByRole('link', { name: 'Prüfen' }).click()
  await expect(page.getByPlaceholder('z. B. schriftliche Klausur')).toHaveValue('schriftlich')
  await expect(page.getByText('Vorschlag von Claude')).toHaveCount(1)
  await page.getByRole('button', { name: 'Speichern' }).click()
  // Erst auf die Prüfungsseite warten: Speichern navigiert asynchron und würde sonst den folgenden Seitenwechsel überschreiben.
  await expect(page.getByRole('heading', { name: 'Thermodynamik' })).toBeVisible()
  await expect(page.getByText(/vorgeschlagen – bitte prüfen/)).toHaveCount(0)

  // Fachprofile-Datei von Claude für alle Prüfungen
  const profFile = join(dir, 'Fachprofile.json')
  writeFileSync(profFile, JSON.stringify({ format: 'lernapp-fachprofile', formatVersion: 1, exams: [{ name: 'Thermodynamik', slug: 'thermodynamik', profile: { duration: 120 } }] }))
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles(profFile)
  await expect(page.getByText('→ Thermodynamik')).toBeVisible()
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByText('Thermodynamik (Dauer)')).toBeVisible()

  await page.goto('./#/pruefungen')
  await expect(page.getByRole('button', { name: 'Auftrag für alle Prüfungen kopieren' })).toBeVisible()
  expect(errors).toEqual([])
})
