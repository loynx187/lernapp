import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { deleteCard, resetPackage } from './cards'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Technische Mechanik', date: '2027-02-01', weight: 2, color: '#ff9500', createdAt: 0 }
const id = (uid: string) => `e1:${sample.id}:${uid}`

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.exams.add(exam)
})

describe('Lernstand zurücksetzen', () => {
  it('macht begonnene Karten des Pakets wieder neu, behält Bewertungen und lässt gelöschte Karten unberührt', async () => {
    const [a, b] = sample.cards.map((x) => x.uid)
    await importPackage(exam, sample, 1)
    for (const uid of [a, b]) {
      const card = (await db.cards.get(id(uid)))!
      await db.cards.put({ ...card, s: { ...card.s, state: 2, reps: 3, due: 5000, stability: 10 } })
    }
    await deleteCard({ id: id(b) }, 50)
    await db.reviews.add({ id: 'r1', profileId: 'p1', examId: 'e1', cardId: id(a), mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 10, durationMs: 5000 })

    expect(await resetPackage('e1', sample.id, 100)).toBe(1)
    const reset = (await db.cards.get(id(a)))!
    expect(reset.s).toMatchObject({ state: 0, reps: 0, due: 100 })
    expect(reset.archived).toBe(0)
    expect((await db.cards.get(id(b)))!.s.reps).toBe(3)
    expect(await db.reviews.count()).toBe(1)
    // Nichts mehr begonnen: zweiter Aufruf ändert nichts
    expect(await resetPackage('e1', sample.id, 200)).toBe(0)
  })
})
