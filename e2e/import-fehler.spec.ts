import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

test('Import fängt alte Paketversionen, Dateien am falschen Ort und Byte-Order-Mark ab', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-importfehler-'))
  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  const pkg = JSON.parse(readFileSync('public/beispiel-paket.json', 'utf8'))

  // Version 5 importieren (mit Byte-Order-Mark wie aus Excel/Windows)
  const v5 = join(dir, 'v5.lernpaket.json')
  writeFileSync(v5, '﻿' + JSON.stringify({ ...pkg, version: 5 }))
  await importPackage(page, v5)

  // Alte Version 3 aus den Downloads: wird nicht importiert
  const v3 = join(dir, 'v3.lernpaket.json')
  writeFileSync(v3, JSON.stringify({ ...pkg, version: 3 }))
  await page.goto('./#/import')
  await page.locator('input[type=file]').first().setInputFiles(v3)
  await expect(page.getByText(/Du hast schon die neuere Version 5/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aktualisieren' })).toBeDisabled()

  await page.getByRole('button', { name: 'Abbrechen' }).click()

  // Sicherung statt Kartenpaket: Hinweis, wohin sie gehört
  const backup = join(dir, 'Sicherung.json')
  writeFileSync(backup, JSON.stringify({ format: 'lernapp-backup', formatVersion: 2 }))
  await page.locator('input[type=file]').first().setInputFiles(backup)
  await expect(page.getByText(/Das ist eine Sicherung deiner Lerndaten/)).toBeVisible()

  // Auftrag für Claude versehentlich als Datei gewählt
  const order = join(dir, 'Auftrag.json')
  writeFileSync(order, JSON.stringify({ format: 'lernapp-auftrag', formatVersion: 1, exams: [] }))
  await page.locator('input[type=file]').first().setInputFiles(order)
  await expect(page.getByText(/Das ist ein Auftrag für Claude/)).toBeVisible()
  expect(errors).toEqual([])
})
