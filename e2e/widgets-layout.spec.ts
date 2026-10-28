import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard } from './helpers'

const pkg = (id: string) => ({
  format: 'lernapp-paket',
  formatVersion: 1,
  id,
  title: id,
  version: 1,
  cards: [
    ...Array.from({ length: 12 }, (_, i) => ({ uid: `k${i}`, front: `Frage ${i}`, back: `Antwort ${i}` })),
    { uid: 't1', type: 'task', front: 'Aufgabe', steps: ['Schritt'], result: '42' },
  ],
  pending: [
    { id: 'altklausuren', title: 'Altklausuren mit einem recht langen Titel', note: 'kommen später' },
    { id: 'loesungen', title: 'Lösungshinweise zum Übungsblatt' },
    { id: 'skript', title: 'Fehlender Skriptteil' },
  ],
})

test('Widgets schneiden ihren Inhalt auf keiner Bildschirmgröße ab', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-widgets-'))
  await onboard(page)
  for (const name of ['Regelungstechnik', 'Maschinendynamik']) {
    const file = join(dir, `${name}.lernpaket.json`)
    writeFileSync(file, JSON.stringify(pkg(name.toLowerCase())))
    await createExam(page, name)
    await importPackage(page, file, name)
  }
  await page.goto('./#/')
  await expect(page.getByRole('link', { name: 'Unterwegs lernen', exact: true })).toContainText('Fach wählen')
  await expect(page.getByRole('link', { name: 'Fehlende Unterlagen' })).toContainText('weitere')

  // iPhone, iPad hoch und quer
  for (const size of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 1366, height: 1024 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(100)
    const clipped = await page.locator('.widget').evaluateAll((els) =>
      els.filter((el) => el.scrollHeight > el.clientHeight + 1).map((el) => el.querySelector('.widget-title')?.textContent),
    )
    expect(clipped, `abgeschnitten bei ${size.width}×${size.height}`).toEqual([])
  }
  expect(errors).toEqual([])
})
