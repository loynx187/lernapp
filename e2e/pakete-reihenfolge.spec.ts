import { expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectErrors, createExam, importPackage, onboard, rate, revealCard } from './helpers'

test('Neue Karten kommen Paket für Paket, Kapitel bleiben je Paket getrennt', async ({ page }) => {
  const errors = collectErrors(page)
  // Zweites Paket mit denselben Kapitel-IDs (k1, k2, …) wie das Beispielpaket – wie bei mehreren Vorlesungsblöcken
  const sample = JSON.parse(readFileSync('public/beispiel-paket.json', 'utf8'))
  const second = {
    ...sample,
    id: 'zweiter-block',
    title: 'Zweiter Block',
    chapters: sample.chapters.map((c: { id: string; title: string }) => ({ ...c, title: `Block 2: ${c.title}` })),
    cards: sample.cards.map((c: { front: string }) => ({ ...c, front: `Block 2 – ${c.front}` })),
  }
  const file = join(mkdtempSync(join(tmpdir(), 'lernapp-bloecke-')), 'zweiter.lernpaket.json')
  writeFileSync(file, JSON.stringify(second))

  await onboard(page)
  await createExam(page, 'Technische Mechanik')
  await importPackage(page)
  await importPackage(page, file)

  // Kapitelübersicht: erst alle Kapitel des ersten Pakets, dann die des zweiten
  await page.goto('./#/pruefungen')
  await page.locator('a.card.link').first().click()
  const titles = await page.locator('.chapter-row > span').allInnerTexts()
  expect(titles).toEqual([...sample.chapters.map((c: { title: string }) => c.title), ...second.chapters.map((c: { title: string }) => c.title)])

  // Lernsitzung mit zusätzlichen neuen Karten: alle stammen zuerst aus dem zuerst importierten Paket
  await page.goto('./#/lernen/mobile?extra=6')
  for (let i = 0; i < 8; i++) {
    await expect(page.locator('.flashcard')).toBeVisible()
    await expect(page.locator('.flashcard')).not.toContainText('Block 2 –')
    await revealCard(page)
    await rate(page, 'Gut')
  }

  expect(errors).toEqual([])
})
