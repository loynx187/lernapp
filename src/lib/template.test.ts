import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { createTemplate, importTemplate, parseTemplate } from './template'
import { chapterKey } from './pending'
import { sortPackages } from './stats'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))

async function setup() {
  await db.profiles.add({ id: 'p1', name: 'Leon', createdAt: 0, minutesMobile: 20, minutesDesk: 30, retention: 0.9, activeSemesterId: 's1', fsrsWeights: [1, 2, 3] })
  await db.semesters.add({ id: 's1', profileId: 'p1', name: '5. Semester', kind: 'dual', createdAt: 0 })
  const exam: Exam = {
    id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Regelungstechnik', date: '2027-02-01', weight: 2, color: '#ff9500', createdAt: 0,
    profile: { form: 'schriftlich', duration: 120 },
    pendingDocs: [{ id: 'alt', title: 'Altklausuren' }, { id: 'fertig', title: 'Skript', doneAt: 5 }],
  }
  await db.exams.add(exam)
  const pkg = parsePackage(sample)
  await importPackage(exam, { ...pkg, id: 'b', title: 'B' }, 1000)
  await importPackage(exam, { ...pkg, id: 'a', title: 'A' }, 2000)
  // Lernfortschritt, Löschung und Pause
  const card = (await db.cards.get(`e1:b:${pkg.cards[0].uid}`))!
  await db.cards.put({ ...card, s: { ...card.s, reps: 7, state: 2 } })
  await db.cards.update(`e1:b:${pkg.cards[1].uid}`, { archived: 1, deletedAt: 10 })
  await db.exams.update('e1', { pausedChapters: [chapterKey({ packageId: 'a', chapter: pkg.cards[0].chapter })] })
  await db.reports.add({ id: 'm1', profileId: 'p1', examId: 'e1', cardId: `e1:a:${pkg.cards[2].uid}`, packageId: 'a', uid: pkg.cards[2].uid, category: 'fehler', note: 'Vorzeichen falsch', createdAt: 100 })
  await db.reports.add({ id: 'm2', profileId: 'p1', examId: 'e1', cardId: `e1:a:${pkg.cards[3].uid}`, packageId: 'a', uid: pkg.cards[3].uid, category: 'unklar', note: '', createdAt: 100, resolvedAt: 200 })
  await db.reviews.add({ id: 'r1', profileId: 'p1', examId: 'e1', cardId: card.id, mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 1, durationMs: 1000 })
  return pkg
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Profil-Vorlage', () => {
  it('enthält Prüfungen und Karten, aber keinen Lernfortschritt', async () => {
    const pkg = await setup()
    const t = parseTemplate(JSON.parse(JSON.stringify(await createTemplate('p1'))))
    const json = JSON.stringify(t)
    expect(json).not.toContain('stability')
    expect(json).not.toContain('fsrsWeights')
    expect(json).not.toContain('reviewedAt')
    const exam = t.semesters[0].exams[0]
    expect(t.semesters[0]).toMatchObject({ name: '5. Semester', kind: 'dual', active: true })
    expect(exam).toMatchObject({ name: 'Regelungstechnik', date: '2027-02-01', weight: 2, profile: { form: 'schriftlich', duration: 120 } })
    expect(exam.pending?.map((d) => d.id)).toEqual(['alt'])
    expect(exam.packages.map((p) => p.id)).toEqual(['b', 'a'])
    expect(exam.packages[0].cards).toHaveLength(pkg.cards.length - 1) // gelöschte Karte fehlt
    expect(exam.packages[1].chapters?.find((c) => c.id === pkg.cards[0].chapter)?.later).toBe(true)
    // nur die offene Meldung
    expect(exam.reports).toEqual([{ packageId: 'a', uid: pkg.cards[2].uid, category: 'fehler', note: 'Vorzeichen falsch', reportedAt: new Date(100).toISOString() }])
  })

  it('legt in einem neuen Profil alles ohne Fortschritt an, Reihenfolge und Pausen bleiben', async () => {
    const pkg = await setup()
    const t = await createTemplate('p1')
    await db.profiles.add({ id: 'p2', name: 'Lisa', createdAt: 0, minutesMobile: 20, minutesDesk: 30, retention: 0.9 })
    const r = await importTemplate('p2', t, 50_000)
    expect(r).toMatchObject({ semestersAdded: 1, examsAdded: 1, packages: 2, skipped: [] })
    const exam = (await db.exams.where('profileId').equals('p2').first())!
    expect(exam).toMatchObject({ name: 'Regelungstechnik', profile: { duration: 120 } })
    expect(exam.pendingDocs?.map((d) => d.id)).toEqual(['alt'])
    expect(exam.pausedChapters).toEqual([chapterKey({ packageId: 'a', chapter: pkg.cards[0].chapter })])
    expect(sortPackages(await db.packages.where('examId').equals(exam.id).toArray()).map((p) => p.packageId)).toEqual(['b', 'a'])
    const cards = await db.cards.where('examId').equals(exam.id).toArray()
    expect(cards.every((c) => c.profileId === 'p2' && c.s.reps === 0)).toBe(true)
    expect((await db.profiles.get('p2'))!.activeSemesterId).toBe(exam.semesterId)
    // Meldung gilt auch hier: Karte pausiert, bis ein Update sie ändert
    expect(r.reports).toBe(1)
    const { pausedCardIds } = await import('./study')
    expect([...(await pausedCardIds([exam.id]))]).toEqual([`${exam.id}:a:${pkg.cards[2].uid}`])
  })

  it('ordnet vorhandene Prüfungen über den Namen zu und behält dort den Fortschritt', async () => {
    const pkg = await setup()
    const t = await createTemplate('p1')
    const r = await importTemplate('p1', t, 50_000)
    expect(r).toMatchObject({ semestersAdded: 0, examsAdded: 0, examsUpdated: 1, reports: 0 })
    expect(await db.reports.count()).toBe(2)
    expect(await db.exams.count()).toBe(1)
    expect((await db.cards.get(`e1:b:${pkg.cards[0].uid}`))!.s.reps).toBe(7)
    expect((await db.cards.get(`e1:b:${pkg.cards[1].uid}`))!.deletedAt).toBe(10)
  })

  it('übernimmt Korrekturen aus einer neueren Vorlage, auch bei anderem Semesternamen', async () => {
    const pkg = await setup()
    const t = await createTemplate('p1')
    // Kommilitone: anderes Semester, Paket b in Version 2 mit korrigierter Karte, eine Karte bei ihm gelöscht
    t.semesters[0].name = 'WS 26/27'
    const b = t.semesters[0].exams[0].packages[0]
    b.version = 2
    b.cards = b.cards.map((c) => (c.uid === pkg.cards[0].uid ? { ...c, back: 'Korrigiert' } : c)).filter((c) => c.uid !== pkg.cards[4].uid)
    t.semesters[0].exams[0].reports = []
    const r = await importTemplate('p1', t, 50_000)
    expect(r).toMatchObject({ semestersAdded: 0, examsAdded: 0, examsUpdated: 1, cardsChanged: 1, olderSkipped: [] })
    expect(await db.semesters.count()).toBe(1)
    const card = (await db.cards.get(`e1:b:${pkg.cards[0].uid}`))!
    expect(card).toMatchObject({ back: 'Korrigiert', archived: 0 })
    expect(card.s.reps).toBe(7)
    // beim Kommilitonen fehlende Karte bleibt bei mir erhalten
    expect((await db.cards.get(`e1:b:${pkg.cards[4].uid}`))!.archived).toBe(0)
    expect((await db.packages.get('e1:b'))!.version).toBe(2)
  })

  it('dreht neuere eigene Pakete nicht auf eine ältere Vorlage zurück', async () => {
    const pkg = await setup()
    const t = await createTemplate('p1')
    await db.packages.update('e1:a', { version: 3 })
    const a = t.semesters[0].exams[0].packages[1]
    a.cards = a.cards.map((c) => ({ ...c, back: 'Alt' }))
    await db.reports.clear()
    const r = await importTemplate('p1', t, 50_000)
    expect(r.olderSkipped).toEqual([a.title])
    expect((await db.cards.get(`e1:a:${pkg.cards[0].uid}`))!.back).not.toBe('Alt')
    expect(r.reports).toBe(0) // Meldungen zur älteren Version werden nicht übernommen
  })

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseTemplate(sample)).toThrow(/keine Lernapp-Vorlage/)
  })
})
