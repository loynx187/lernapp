import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { reportCard } from './reports'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'TM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
const first = sample.cards[0]
const update = (version: number, card: object) => parsePackage({ ...sample, version, minApp: '1.19.0', cards: [card, ...sample.cards.slice(1)] })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Meldungen und Leitfragen', () => {
  it('bleiben offen, wenn ein Update nur Leitfragen ergänzt – und werden erledigt, wenn der Inhalt korrigiert wird', async () => {
    await importPackage(exam, parsePackage(sample))
    await reportCard((await db.cards.get(`e1:${sample.id}:${first.uid}`))!, 'fehler', 'Vorzeichen falsch')

    const withPrompts = { ...first, prompts: ['Was ist gegeben?', 'Was folgt daraus?'], keyPoints: ['Punkt A', 'Punkt B'] }
    const r1 = await importPackage(exam, update(sample.version + 1, withPrompts))
    expect(r1.updated).toBe(1)
    expect(r1.resolvedReports).toBe(0)
    expect((await db.reports.toArray())[0].resolvedAt).toBeUndefined()

    const r2 = await importPackage(exam, update(sample.version + 2, { ...withPrompts, back: 'korrigiert' }))
    expect(r2.resolvedReports).toBe(1)
  })
})
