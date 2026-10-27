import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { exportPackage, importPackage, parsePackage, parseTextCards } from './packages'
import { deleteCard, deletedCards, restoreCard } from './cards'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'TM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('parsePackage', () => {
  it('akzeptiert das Beispielpaket', () => {
    const p = parsePackage(sample)
    expect(p.cards.length).toBeGreaterThan(10)
    expect(p.cards.some((c) => c.type === 'task' && c.steps?.length)).toBe(true)
  })
  it('lehnt fehlerhafte Pakete mit verständlicher Meldung ab', () => {
    expect(() => parsePackage({})).toThrow(/Dateiformat/)
    expect(() => parsePackage({ ...sample, cards: [{ uid: 'a', front: 'x' }, { uid: 'a', front: 'y' }] })).toThrow(/doppelt/)
    expect(() => parsePackage({ ...sample, cards: [{ uid: 'a', type: 'mc', front: 'x', options: ['a', 'b'], correct: [5] }] })).toThrow(/richtige/)
  })
  it('verwirft Bilder, die keine Daten-URL sind', () => {
    const p = parsePackage({ ...sample, cards: [{ uid: 'a', front: 'x', image: 'https://example.com/x.png' }] })
    expect(p.cards[0].image).toBeUndefined()
  })
})

describe('importPackage', () => {
  it('behält beim Update den Lernfortschritt und archiviert entfernte Karten', async () => {
    const v1 = parsePackage(sample)
    const r1 = await importPackage(exam, v1, 1000)
    expect(r1.added).toBe(v1.cards.length)

    const learned = await db.cards.get(`e1:${v1.id}:k1-01`)
    await db.cards.put({ ...learned!, s: { ...learned!.s, state: 2, reps: 5 } })

    const v2 = parsePackage({
      ...sample,
      version: 2,
      cards: [
        { ...sample.cards[0], back: 'Neue Erklärung' },
        ...sample.cards.slice(2),
        { uid: 'k9-01', type: 'basic', front: 'Neu', back: 'Karte' },
      ],
    })
    const r2 = await importPackage(exam, v2, 2000)
    expect(r2).toMatchObject({ added: 1, updated: 1, archived: 1 })

    const after = await db.cards.get(`e1:${v1.id}:k1-01`)
    expect(after!.back).toBe('Neue Erklärung')
    expect(after!.s.reps).toBe(5)
    expect((await db.cards.get(`e1:${v1.id}:k1-02`))!.archived).toBe(1)
    expect((await db.packages.get(`e1:${v1.id}`))!.version).toBe(2)
    // Der erste Import bestimmt die Reihenfolge der Pakete, auch nach einem Update.
    expect((await db.packages.get(`e1:${v1.id}`))!).toMatchObject({ importedAt: 2000, firstImportedAt: 1000 })

    const r3 = await importPackage(exam, v1, 3000)
    expect(r3.restored).toBe(1)
  })

  it('lässt gelöschte Karten auch nach einem Update gelöscht und stellt sie mit Fortschritt wieder her', async () => {
    const v1 = parsePackage(sample)
    await importPackage(exam, v1, 1000)
    const id = `e1:${v1.id}:k1-01`
    await db.cards.update(id, { s: { ...(await db.cards.get(id))!.s, reps: 3 } })
    await deleteCard({ id }, 1500)
    expect((await db.cards.where('[examId+archived]').equals(['e1', 0]).primaryKeys())).not.toContain(id)

    const v2 = parsePackage({ ...sample, version: 2, cards: [{ ...sample.cards[0], back: 'Neu' }, ...sample.cards.slice(1)] })
    const r = await importPackage(exam, v2, 2000)
    expect(r).toMatchObject({ deleted: 1, restored: 0, updated: 0 })
    const after = (await db.cards.get(id))!
    expect(after).toMatchObject({ archived: 1, deletedAt: 1500, back: 'Neu' })
    expect((await deletedCards('e1')).map((c) => c.id)).toEqual([id])

    await restoreCard({ id })
    const back = (await db.cards.get(id))!
    expect(back.archived).toBe(0)
    expect(back.deletedAt).toBeUndefined()
    expect(back.s.reps).toBe(3)
    expect(await deletedCards('e1')).toEqual([])
  })

  it('exportiert ein Paket ohne Lernfortschritt, das sich wieder importieren lässt', async () => {
    await importPackage(exam, parsePackage(sample))
    const out = await exportPackage(exam, sample.id)
    expect(JSON.stringify(out)).not.toContain('stability')
    expect(parsePackage(JSON.parse(JSON.stringify(out))).cards.length).toBe(sample.cards.length)
  })
})

describe('parseTextCards', () => {
  it('liest Tab-, ;;- und F:/A:-Formate', () => {
    const text = 'Was ist E?\tElastizitätsmodul\nWas ist G? ;; Schubmodul\n\nF: Was ist ν?\nA: Querkontraktionszahl\nca. 0,3'
    expect(parseTextCards(text)).toEqual([
      { front: 'Was ist E?', back: 'Elastizitätsmodul' },
      { front: 'Was ist G?', back: 'Schubmodul' },
      { front: 'Was ist ν?', back: 'Querkontraktionszahl\nca. 0,3' },
    ])
  })
})

describe('Meldungen', () => {
  it('werden erledigt, wenn ein Update die gemeldete Karte ändert', async () => {
    const { reportCard, exportReports } = await import('./reports')
    const v1 = parsePackage(sample)
    await importPackage(exam, v1)
    const card = (await db.cards.get(`e1:${v1.id}:k1-01`))!
    const other = (await db.cards.get(`e1:${v1.id}:k1-02`))!
    await reportCard(card, 'unklar', 'Einheit fehlt')
    await reportCard(other, 'fehler', '')

    const exported = await exportReports(exam)
    expect(exported.reports.map((r) => r.uid).sort()).toEqual(['k1-01', 'k1-02'])
    expect(exported.reports[0].front).toBeTruthy()

    const v2 = parsePackage({ ...sample, version: 2, cards: [{ ...sample.cards[0], back: 'mit Einheit' }, ...sample.cards.slice(1)] })
    const r = await importPackage(exam, v2)
    expect(r.resolvedReports).toBe(1)
    expect((await exportReports(exam)).reports.map((x) => x.uid)).toEqual(['k1-02'])
  })
})
