import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, movePackage, parsePackage } from './packages'
import { deleteCard, deletedCards, removePackage, restorePackage } from './cards'
import { buildOrder } from './profile'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Technische Mechanik', date: '2027-02-01', weight: 2, color: '#ff9500', createdAt: 0 }
const active = async () => (await db.cards.where('[examId+archived]').equals(['e1', 0]).toArray()).map((c) => c.uid)

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.exams.add(exam)
})

describe('Paket entfernen', () => {
  it('nimmt alle Karten aus dem Lernplan, behält den Fortschritt und stellt genau diese wieder her', async () => {
    const [a, b, c] = sample.cards.map((x) => x.uid)
    // Karte c ist in einem früheren Update aus dem Paket gefallen (archiviert), Karte b einzeln gelöscht.
    await importPackage(exam, sample, 1)
    await importPackage(exam, { ...sample, version: 3, cards: sample.cards.filter((x) => x.uid !== c) }, 2)
    await deleteCard({ id: `e1:${sample.id}:${b}` }, 5)
    const card = (await db.cards.get(`e1:${sample.id}:${a}`))!
    await db.cards.put({ ...card, s: { ...card.s, reps: 4 } })

    await removePackage('e1', sample.id, 100)
    expect(await active()).toEqual([])
    expect((await db.packages.get(`e1:${sample.id}`))!.removedAt).toBe(100)
    // Unter „gelöschte Karten“ steht nur die einzeln gelöschte
    expect((await deletedCards('e1')).map((x) => x.uid)).toEqual([b])

    await restorePackage('e1', sample.id)
    const back = await active()
    expect(back).toHaveLength(sample.cards.length - 2)
    expect(back).not.toContain(b)
    expect(back).not.toContain(c)
    expect((await db.cards.get(`e1:${sample.id}:${a}`))!.s.reps).toBe(4)
    expect((await db.packages.get(`e1:${sample.id}`))!.removedAt).toBeUndefined()
  })

  it('bleibt bei einem Update entfernt – auch neue Karten – und steht im Auftrag als entfernt', async () => {
    await importPackage(exam, sample, 1)
    await removePackage('e1', sample.id, 100)
    const neu = { ...sample.cards[0], uid: 'neu-1', front: 'Neue Frage?' }
    await importPackage(exam, { ...sample, version: 3, cards: [...sample.cards, neu] }, 200)
    expect(await active()).toEqual([])
    expect((await db.packages.get(`e1:${sample.id}`))!).toMatchObject({ version: 3, removedAt: 100 })
    await restorePackage('e1', sample.id)
    expect(await active()).toContain('neu-1')

    await removePackage('e1', sample.id, 300)
    const order = await buildOrder([exam], { id: 's1', profileId: 'p1', name: 'S', createdAt: 0 })
    expect(order.exams[0].packages[0]).toMatchObject({ id: sample.id, removed: true, deleted: undefined })
  })

  it('lässt entfernte Pakete bei der Reihenfolge außen vor', async () => {
    await importPackage(exam, { ...sample, id: 'a' }, 1)
    await importPackage(exam, { ...sample, id: 'b' }, 2)
    await importPackage(exam, { ...sample, id: 'c' }, 3)
    await removePackage('e1', 'b', 10)
    await movePackage('e1', 'c', -1)
    const pos = new Map((await db.packages.where('examId').equals('e1').toArray()).map((p) => [p.packageId, p.position]))
    expect(pos.get('c')).toBe(0)
    expect(pos.get('a')).toBe(1)
  })
})
