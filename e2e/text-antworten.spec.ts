import { expect, test } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard, rate } from './helpers'

const pkg = {
  format: 'lernapp-paket',
  formatVersion: 1,
  id: 'scl-test',
  title: 'SCL-Test',
  version: 1,
  cards: [
    {
      uid: 'a1',
      type: 'task',
      front: 'Wandeln Sie $1000_{10}$ in eine Hexadezimalzahl um.',
      steps: ['$1000 = 3 \\cdot 256 + 14 \\cdot 16 + 8$'],
      result: '$3E8_{16}$',
      answers: [{ text: ['3E8', '16#3E8'] }],
    },
    {
      uid: 'c1',
      type: 'cloze',
      front: 'Ergänzen Sie die Schrittkette:\n\n```\nCASE #SchrittNr OF\n  1: IF #S1 {{THEN}}\n       #SchrittNr := 2;\n     END_IF;\nEND_CASE;\n```',
    },
  ],
}

test('Textantworten prüfen und SCL-Code mit Lücke anzeigen', async ({ page }) => {
  const errors = collectErrors(page)
  const file = join(mkdtempSync(join(tmpdir(), 'lernapp-scl-')), 'scl.lernpaket.json')
  writeFileSync(file, JSON.stringify(pkg))
  await onboard(page)
  await createExam(page, 'Steuerungstechnik')
  await importPackage(page, file)

  // Lückentext im Code-Block: feste Schrift, Lücke verdeckt, nach dem Aufdecken gefüllt
  await page.goto('./#/lernen/mobile')
  const code = page.locator('.flashcard pre code')
  await expect(code).toContainText('CASE #SchrittNr OF')
  await expect(code.locator('.cloze')).toHaveCount(1)
  expect(await code.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('pre')
  await page.getByRole('button', { name: 'Antwort zeigen' }).click()
  await expect(page.locator('.flashcard pre code .cloze-fill')).toHaveText('THEN')
  await rate(page, 'Gut')
  await page.goto('./#/')
  await expect(page.locator('.widget').first()).toBeVisible()

  // Aufgabe mit Textantwort (Hexadezimalzahl), Groß-/Kleinschreibung egal
  await page.goto('./#/lernen/desk')
  await expect(page.locator('.flashcard')).toContainText('Hexadezimalzahl')
  await page.getByPlaceholder('Antwort').fill('3e8')
  await page.getByRole('button', { name: 'Lösung' }).click()
  await expect(page.getByText('Ergebnis richtig!')).toBeVisible()

  expect(errors).toEqual([])
})
