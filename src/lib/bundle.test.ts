import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { BUNDLE_FORMAT, bundlePlan, bundleTotals, importBundle, parseBundle } from './bundle'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))

const exam = (id: string, name: string, slug?: string): Exam => ({
  id, profileId: 'p1', semesterId: 's1', name, date: '2027-02-01', weight: 1, color: '#ff9500', createdAt: 0, profile: slug ? { slug } : undefined,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Paket-Sammlung', () => {
  it('lehnt ungültige Dateien verständlich ab', () => {
    expect(() => parseBundle({ format: 'x' })).toThrow('keine Paket-Sammlung')
    expect(() => parseBundle({ format: BUNDLE_FORMAT, formatVersion: 2, exams: [] })).toThrow('neueren App-Version')
    expect(() => parseBundle({ format: BUNDLE_FORMAT, formatVersion: 1, exams: [{ packages: [] }] })).toThrow('Name oder Slug')
    expect(() => parseBundle({ format: BUNDLE_FORMAT, formatVersion: 1, exams: [{ slug: 'qm', packages: [{ format: 'x' }] }] })).toThrow(/^qm: /)
  })

  it('aktualisiert mehrere Prüfungen in einem Schritt, archiviert entfernte Karten und behält den Lernfortschritt', async () => {
    const rt = exam('e1', 'Regelungstechnik')
    const qm = exam('e2', 'Qualitätsmanagement', 'qualitaetsmanagement')
    const md = exam('e3', 'Maschinendynamik')
    await db.exams.bulkAdd([rt, qm, md])
    await importPackage(rt, { ...sample, id: 'rt' }, 1)
    await importPackage(qm, { ...sample, id: 'qm', version: 5 }, 1)
    await importPackage(md, { ...sample, id: 'md' }, 1)
    const first = sample.cards[0]
    const card = (await db.cards.get(`e1:rt:${first.uid}`))!
    await db.cards.put({ ...card, s: { ...card.s, reps: 5, state: 2 } })
    await db.reports.add({ id: 'm1', profileId: 'p1', examId: 'e1', cardId: card.id, packageId: 'rt', uid: first.uid, category: 'fehler', note: 'falsch', createdAt: 1 })

    const changed = { ...sample, id: 'rt', version: sample.version + 1, cards: [{ ...first, back: 'korrigiert' }, ...sample.cards.slice(2)] }
    const bundle = parseBundle({
      format: BUNDLE_FORMAT,
      formatVersion: 1,
      exams: [
        { name: 'Regelungstechnik', slug: 'regelungstechnik', packages: [changed, { ...sample, id: 'rt-neu', title: 'Neu' }] },
        { name: 'QM (anders benannt)', slug: 'qualitaetsmanagement', packages: [{ ...sample, id: 'qm', version: 1 }] },
        // Name und Slug passen nicht, aber das Paket ist dort schon importiert
        { name: 'Maschinendynamik 2', packages: [{ ...sample, id: 'md' }] },
        { name: 'Thermodynamik', packages: [sample] },
      ],
    })
    const plan = await bundlePlan([rt, qm, md], bundle)
    expect(plan.map((p) => p.exam?.id)).toEqual(['e1', 'e2', 'e3', undefined])
    expect(plan[0].packages.map((p) => p.status)).toEqual(['neuer', 'neu'])
    expect(plan[1].packages[0]).toMatchObject({ status: 'aelter', installed: 5 })
    expect(plan[2].packages[0].status).toBe('gleich')

    const result = await importBundle(plan, 100)
    expect(result.imported.map((i) => [i.exam, i.title, i.status])).toEqual([['Regelungstechnik', sample.title, 'neuer'], ['Regelungstechnik', 'Neu', 'neu']])
    expect(result.older).toEqual([sample.title])
    expect(result.same).toEqual([sample.title])
    expect(result.unmatched).toEqual(['Thermodynamik'])
    expect(bundleTotals(result)).toMatchObject({ updated: 1, archived: 1, resolvedReports: 1, added: sample.cards.length })

    const after = (await db.cards.get(`e1:rt:${first.uid}`))!
    expect(after.back).toBe('korrigiert')
    expect(after.s.reps).toBe(5)
    expect((await db.cards.get(`e1:rt:${sample.cards[1].uid}`))!.archived).toBe(1)
    expect((await db.packages.get('e1:rt'))!.version).toBe(sample.version + 1)
    expect((await db.packages.get('e2:qm'))!.version).toBe(5)
  })

  it('bevorzugt die zuerst übergebene Prüfung (aktives Semester), wenn der Name mehrfach vorkommt', async () => {
    const alt = { ...exam('alt', 'Regelungstechnik'), semesterId: 's0' }
    const neu = exam('neu', 'Regelungstechnik')
    const bundle = parseBundle({ format: BUNDLE_FORMAT, formatVersion: 1, exams: [{ name: 'Regelungstechnik', packages: [sample] }] })
    expect((await bundlePlan([neu, alt], bundle))[0].exam?.id).toBe('neu')
  })
})
