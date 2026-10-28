import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { completePending, duePending, mergePending, snoozePending, toggleChapterPause } from './pending'
import { loadStudyData } from './study'
import { examStats } from './stats'

const NOW = new Date(2026, 9, 28, 12, 0).getTime()
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Regelungstechnik', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
const pkg = (version: number, extra: object = {}) =>
  parsePackage({
    format: 'lernapp-paket',
    formatVersion: 1,
    id: 'rt',
    title: 'Regelungstechnik',
    version,
    chapters: [{ id: 'k1', title: 'Grundlagen' }, { id: 'k2', title: 'Laplace', later: true }],
    cards: [
      { uid: 'a', chapter: 'k1', front: 'Was ist eine Regelung?', back: 'Rückführung' },
      { uid: 'b', chapter: 'k2', front: 'Laplace von 1?', back: '1/s' },
    ],
    pending: [{ id: 'altklausuren', title: 'Altklausuren', note: 'kommen im Laufe der Vorlesung' }],
    ...extra,
  })

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.profiles.add({ id: 'p1', name: 'T', createdAt: 0, minutesMobile: 20, minutesDesk: 30, retention: 0.9, activeSemesterId: 's1' })
  await db.semesters.add({ id: 's1', profileId: 'p1', name: 'S5', createdAt: 0 })
  await db.exams.add(exam)
})

describe('Fehlende Unterlagen', () => {
  it('erinnert ab dem Starttag, lässt sich zurückstellen und abhaken', () => {
    const e = { pendingDocs: [{ id: 'a', title: 'Altklausuren' }, { id: 'b', title: 'Lösungen', from: '2026-11-15' }] }
    expect(duePending(e, NOW).map((d) => d.id)).toEqual(['a'])
    expect(duePending({ pendingDocs: [{ id: 'a', title: 'A', snoozedUntil: '2026-11-04' }] }, NOW)).toEqual([])
    expect(duePending({ pendingDocs: [{ id: 'a', title: 'A', doneAt: 1 }] }, NOW)).toEqual([])
  })

  it('übernimmt Erinnerungen aus Paketen nur einmal – erledigte bleiben erledigt', async () => {
    expect(mergePending([{ id: 'x', title: 'X', doneAt: 1 }], [{ id: 'x', title: 'X' }])).toBeUndefined()
    const first = await importPackage(exam, pkg(1), NOW)
    expect(first.pendingAdded).toBe(1)
    await completePending(exam, 'altklausuren', NOW)
    const second = await importPackage(exam, pkg(2), NOW)
    expect(second.pendingAdded).toBe(0)
    expect((await db.exams.get('e1'))!.pendingDocs).toEqual([{ id: 'altklausuren', title: 'Altklausuren', note: 'kommen im Laufe der Vorlesung', doneAt: NOW }])
  })

  it('stellt eine Erinnerung eine Woche zurück', async () => {
    await importPackage(exam, pkg(1), NOW)
    await snoozePending(exam, 'altklausuren', NOW)
    const e = (await db.exams.get('e1'))!
    expect(e.pendingDocs![0].snoozedUntil).toBe('2026-11-04')
    expect(duePending(e, NOW)).toEqual([])
  })
})

describe('Kapitel pausieren', () => {
  it('pausiert spätere Kapitel beim ersten Import und plant ihre neuen Karten nicht ein', async () => {
    const r = await importPackage(exam, pkg(1), NOW)
    expect(r.pausedChapters).toBe(1)
    let e = (await db.exams.get('e1'))!
    expect(e.pausedChapters).toEqual(['rt:k2'])
    const profile = (await db.profiles.get('p1'))!
    let d = await loadStudyData(profile, NOW)
    expect(d.cards.map((c) => c.uid)).toEqual(['a'])
    // Fortschritt zählt das pausierte Kapitel nicht mit, zeigt es aber an
    const st = examStats(e, await db.cards.toArray(), NOW, 0.9)
    expect(st.total).toBe(1)
    expect(st.chapters.find((c) => c.chapter === 'rt:k2')).toMatchObject({ paused: true, total: 1 })

    // Fortsetzen: Karten kommen dazu; ein späteres Update pausiert das Kapitel nicht erneut
    await toggleChapterPause(e, 'rt:k2')
    await importPackage(exam, pkg(2), NOW)
    e = (await db.exams.get('e1'))!
    expect(e.pausedChapters).toEqual([])
    d = await loadStudyData(profile, NOW)
    expect(d.cards.map((c) => c.uid).sort()).toEqual(['a', 'b'])
  })
})
