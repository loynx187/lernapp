import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { exportPackage, importPackage, parsePackage } from './packages'
import { appTooOld, compareVersions } from './package-format'
import { Rating } from './scheduler'
import { suggestRating } from './socratic'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'TM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
const withPrompts = (version: number, prompts = ['Was passiert mit der Energie?', 'Was folgt daraus?']) => ({
  ...sample,
  version,
  minApp: '1.19.0',
  cards: [{ ...sample.cards[0], prompts, keyPoints: ['Erster Punkt', ' ', 'Zweiter Punkt'] }, ...sample.cards.slice(1)],
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Sokratisches Lernen', () => {
  it('liest Leitfragen, Kernpunkte und minApp aus dem Paket (leere Einträge fallen weg)', () => {
    const p = parsePackage(withPrompts(1))
    expect(p.minApp).toBe('1.19.0')
    expect(p.cards[0].prompts).toEqual(['Was passiert mit der Energie?', 'Was folgt daraus?'])
    expect(p.cards[0].keyPoints).toEqual(['Erster Punkt', 'Zweiter Punkt'])
    expect(p.cards[1].prompts).toBeUndefined()
    expect(parsePackage({ ...sample, minApp: 'neu' }).minApp).toBeUndefined()
  })

  it('warnt, wenn das Paket eine neuere App braucht', () => {
    expect(compareVersions('1.18.0', '1.19.0')).toBeLessThan(0)
    expect(compareVersions('1.19.1', '1.19.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '1.99.9')).toBeGreaterThan(0)
    expect(appTooOld({ title: 'MD', minApp: '1.19.0' }, '1.18.0')).toMatch(/braucht App-Version 1\.19\.0/)
    expect(appTooOld({ title: 'MD', minApp: '1.19.0' }, '1.19.0')).toBeUndefined()
    expect(appTooOld({ title: 'MD' }, '1.0.0')).toBeUndefined()
  })

  it('erkennt geänderte Leitfragen als Update, behält den Lernstand und exportiert sie wieder', async () => {
    await importPackage(exam, parsePackage(sample))
    const id = `e1:${sample.id}:${sample.cards[0].uid}`
    const before = (await db.cards.get(id))!
    await db.cards.put({ ...before, s: { ...before.s, reps: 4, state: 2 } })

    const r = await importPackage(exam, parsePackage(withPrompts(sample.version + 1)))
    expect(r.updated).toBe(1)
    const after = (await db.cards.get(id))!
    expect(after.prompts).toHaveLength(2)
    expect(after.s.reps).toBe(4)

    // Entfernt ein späteres Update die Leitfragen, verschwinden sie auch in der App.
    const r2 = await importPackage(exam, parsePackage({ ...sample, version: sample.version + 2 }))
    expect(r2.updated).toBe(1)
    expect((await db.cards.get(id))!.prompts).toBeUndefined()

    await importPackage(exam, parsePackage(withPrompts(sample.version + 3)))
    const exported = await exportPackage(exam, sample.id)
    expect(exported.cards[0].keyPoints).toEqual(['Erster Punkt', 'Zweiter Punkt'])
  })

  it('schlägt eine Bewertung aus Kernpunkten und Tipps vor', () => {
    expect(suggestRating({ checked: 0, total: 0, hints: 0 })).toBeUndefined()
    expect(suggestRating({ checked: 0, total: 0, hints: 1 })).toBe(Rating.Hard)
    expect(suggestRating({ checked: 1, total: 4, hints: 0 })).toBe(Rating.Again)
    expect(suggestRating({ checked: 2, total: 4, hints: 0 })).toBe(Rating.Hard)
    expect(suggestRating({ checked: 4, total: 5, hints: 0 })).toBe(Rating.Good)
    expect(suggestRating({ checked: 4, total: 4, hints: 1 })).toBe(Rating.Hard)
  })
})
