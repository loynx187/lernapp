import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard, rate } from './helpers'

const PKG = {
  format: 'lernapp-paket',
  formatVersion: 1,
  id: 'qm-normen',
  title: 'QM – Normen',
  version: 1,
  cards: [
    {
      uid: 'k1-f011-1',
      type: 'match',
      front: 'Ordne jeder Norm der ISO-9000-Familie ihre Aufgabe zu.',
      pairs: [
        ['ISO 9000', 'Grundlagen und Begriffe'],
        ['ISO 9001', 'Anforderungen an ein QMS'],
        ['ISO 9004', 'Leitfaden für nachhaltigen Erfolg'],
        ['ISO 19011', 'Leitfaden für Audits'],
      ],
      back: 'Nur ISO 9001 ist Zertifizierungsgrundlage.',
    },
  ],
}

test('Zuordnen-Karte: Auswahl je Begriff, Prüfen zeigt Treffer, danach bewerten', async ({ page }) => {
  const errors = collectErrors(page)
  const dir = mkdtempSync(join(tmpdir(), 'lernapp-match-'))
  writeFileSync(join(dir, 'qm.lernpaket.json'), JSON.stringify(PKG))
  await onboard(page)
  await createExam(page, 'Qualitätsmanagement')
  await importPackage(page, join(dir, 'qm.lernpaket.json'), 'Qualitätsmanagement')
  await page.goto('./#/lernen/mobile')
  await expect(page.locator('.flashcard')).toContainText('Ordne jeder Norm')
  const check = page.getByRole('button', { name: 'Prüfen' })
  await expect(check).toBeDisabled()
  // drei richtig, eine vertauscht
  await page.getByLabel('Zuordnung für ISO 9000').selectOption({ label: 'Grundlagen und Begriffe' })
  await page.getByLabel('Zuordnung für ISO 9001').selectOption({ label: 'Anforderungen an ein QMS' })
  await page.getByLabel('Zuordnung für ISO 9004').selectOption({ label: 'Leitfaden für Audits' })
  await page.getByLabel('Zuordnung für ISO 19011').selectOption({ label: 'Leitfaden für Audits' })
  await check.click()
  await expect(page.locator('.flashcard')).toContainText('3 von 4 richtig')
  await expect(page.locator('.match-row.wrong')).toHaveCount(1)
  await expect(page.locator('.match-row.wrong')).toContainText('Leitfaden für nachhaltigen Erfolg')
  await rate(page, 'Schwer')
  expect(errors).toEqual([])
})
