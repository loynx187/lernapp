import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, deleteExam, tombstone, type Exam, type StudyCard } from './db'
import { applyDoc, docSignature, exportDoc, mergeDocs, type SyncDoc } from './sync'
import { newMemoryState } from './scheduler'
import { recordReview, undoReview } from './study'
import { Rating } from './scheduler'

const P = 'p1'

async function seed() {
  await db.profiles.add({ id: P, name: 'Test', createdAt: 0, minutesMobile: 20, minutesDesk: 30, retention: 0.9, activeSemesterId: 's1' })
  await db.semesters.add({ id: 's1', profileId: P, name: 'S5', createdAt: 0 })
  const exam: Exam = { id: 'e1', profileId: P, semesterId: 's1', name: 'TM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
  await db.exams.add(exam)
  const card = (i: number): StudyCard => ({
    id: `e1:pk:c${i}`, uid: `c${i}`, type: 'basic', front: `F${i}`, back: `B${i}`, profileId: P, examId: 'e1',
    packageId: 'pk', order: i, archived: 0, addedAt: 0, s: newMemoryState(0),
  })
  await db.cards.bulkAdd([card(1), card(2)])
  return exam
}

const clone = (d: SyncDoc): SyncDoc => JSON.parse(JSON.stringify(d))

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('mergeDocs', () => {
  it('nimmt pro Datensatz den neueren Stand und vereinigt Bewertungen', async () => {
    await seed()
    const base = await exportDoc(P)
    const a = clone(base)
    const b = clone(base)
    a.exams[0] = { ...a.exams[0], name: 'TM alt', updatedAt: 100 }
    b.exams[0] = { ...b.exams[0], name: 'TM neu', updatedAt: 200 }
    a.reviews.push({ id: 'ra', profileId: P, examId: 'e1', cardId: 'e1:pk:c1', mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 1, durationMs: 1 })
    b.reviews.push({ id: 'rb', profileId: P, examId: 'e1', cardId: 'e1:pk:c2', mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 2, durationMs: 1 })
    const m = mergeDocs(a, b)
    expect(m.exams[0].name).toBe('TM neu')
    expect(m.reviews.map((r) => r.id).sort()).toEqual(['ra', 'rb'])
    expect(mergeDocs(b, a).exams[0].name).toBe('TM neu')
  })

  it('überträgt gelöschte Prüfungen samt Karten und Verlauf', async () => {
    await seed()
    const before = await exportDoc(P)
    await deleteExam('e1')
    const after = await exportDoc(P)
    const m = mergeDocs(after, before)
    expect(m.exams).toHaveLength(0)
    expect(m.cards).toHaveLength(0)
  })

  it('behält eine Prüfung, die nach dem Löschen woanders weiterbearbeitet wurde', async () => {
    await seed()
    const doc = await exportDoc(P)
    const other = clone(doc)
    other.exams[0].updatedAt = Date.now() + 10_000
    doc.tombstones.push(tombstone('exams', 'e1', P, Date.now()))
    expect(mergeDocs(doc, other).exams).toHaveLength(1)
  })

  it('entfernt Prüfungen gelöschter Semester und wählt ein gültiges Semester', async () => {
    await seed()
    const doc = await exportDoc(P)
    doc.semesters.push({ id: 's2', profileId: P, name: 'S6', createdAt: 1, updatedAt: 1 })
    const other = clone(doc)
    other.tombstones.push(tombstone('semesters', 's1', P, Date.now() + 1000))
    const m = mergeDocs(doc, other)
    expect(m.exams).toHaveLength(0)
    expect(m.profile.activeSemesterId).toBe('s2')
  })

  it('überträgt rückgängig gemachte Bewertungen', async () => {
    const exam = await seed()
    const profile = (await db.profiles.get(P))!
    const card = (await db.cards.get('e1:pk:c1'))!
    const { undo } = await recordReview(profile, exam, card, Rating.Good, 'mobile', 1000)
    const withReview = await exportDoc(P)
    await undoReview(undo)
    const m = mergeDocs(await exportDoc(P), withReview)
    expect(m.reviews).toHaveLength(0)
  })
})

describe('applyDoc', () => {
  it('überschreibt keine lokale Änderung, die während des Abgleichs entstand', async () => {
    const exam = await seed()
    const base = await exportDoc(P)
    const remote = clone(base)
    remote.cards[1] = { ...remote.cards[1], back: 'vom anderen Gerät', updatedAt: Date.now() + 5 }
    const merged = mergeDocs(base, remote)

    // Während des Abgleichs wird lokal Karte 1 bewertet.
    const profile = (await db.profiles.get(P))!
    await recordReview(profile, exam, (await db.cards.get('e1:pk:c1'))!, Rating.Good, 'mobile', 1000)
    await applyDoc(merged, base)

    expect((await db.cards.get('e1:pk:c1'))!.s.reps).toBe(1)
    expect((await db.cards.get('e1:pk:c2'))!.back).toBe('vom anderen Gerät')
    expect(await db.reviews.count()).toBe(1)
  })

  it('ändert nichts, wenn beide Stände gleich sind', async () => {
    await seed()
    const doc = await exportDoc(P)
    expect(docSignature(mergeDocs(doc, clone(doc)))).toBe(docSignature(doc))
  })
})

describe('syncProfile mit simulierter Dropbox', () => {
  const files = new Map<string, { data: Uint8Array; rev: number }>()
  let conflictsLeft = 0
  let calls: string[] = []

  beforeEach(() => {
    files.clear()
    conflictsLeft = 0
    calls = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const headerArg = (init.headers as Record<string, string>)['Dropbox-API-Arg']
      const arg = JSON.parse(String(headerArg ?? (typeof init.body === 'string' ? init.body : '{}')))
      calls.push(`${url.split('/2/')[1]} ${arg.path}`)
      if (url.endsWith('/files/get_metadata')) {
        const f = files.get(arg.path)
        return f ? Response.json({ rev: String(f.rev) }) : new Response('{}', { status: 409 })
      }
      if (url.endsWith('/files/list_folder')) {
        const entries = [...files.keys()].filter((p) => p.startsWith(arg.path + '/')).map((p) => ({ '.tag': 'file', name: p.split('/').pop(), path_lower: p }))
        return Response.json({ entries })
      }
      if (url.endsWith('/files/delete_v2')) {
        files.delete(arg.path)
        return Response.json({})
      }
      if (url.endsWith('/files/download')) {
        const f = files.get(arg.path)
        if (!f) return new Response('{}', { status: 409 })
        return new Response(f.data, { headers: { 'Dropbox-API-Result': JSON.stringify({ rev: String(f.rev) }) } })
      }
      if (url.endsWith('/files/upload')) {
        const f = files.get(arg.path)
        const mode = arg.mode
        if (conflictsLeft > 0 && typeof mode === 'object') {
          conflictsLeft--
          return new Response('{}', { status: 409 })
        }
        if ((mode === 'add' && f) || (typeof mode === 'object' && String(f?.rev) !== mode.update)) return new Response('{}', { status: 409 })
        const rev = (f?.rev ?? 0) + 1
        files.set(arg.path, { data: new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()), rev })
        return Response.json({ rev: String(rev) })
      }
      return new Response('{}', { status: 404 })
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  async function connect() {
    await db.meta.put({ key: `dropbox:${P}`, value: { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, connectedAt: 0 } })
  }

  it('lädt hoch, übernimmt Änderungen eines zweiten Geräts und schreibt die Erinnerung', async () => {
    const { syncProfile } = await import('./syncService')
    await seed()
    await connect()
    await syncProfile(P)
    expect(files.has(`/sync/${P}.lernsync`)).toBe(true)
    expect(new TextDecoder().decode(files.get('/Erinnerung.txt')!.data)).toMatch(/Lernplan/)

    // Zweites Gerät: Stand ändern und als neue Version hochladen.
    const { exportDoc: exp } = await import('./sync')
    const other = await exp(P)
    other.exams[0] = { ...other.exams[0], name: 'Technische Mechanik', updatedAt: Date.now() + 1000 }
    other.reviews.push({ id: 'x', profileId: P, examId: 'e1', cardId: 'e1:pk:c2', mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 5, durationMs: 1 })
    const f = files.get(`/sync/${P}.lernsync`)!
    files.set(`/sync/${P}.lernsync`, { data: new TextEncoder().encode(JSON.stringify(other)), rev: f.rev + 1 })

    conflictsLeft = 1 // ein drittes Gerät funkt einmal dazwischen
    await syncProfile(P)
    expect((await db.exams.get('e1'))!.name).toBe('Technische Mechanik')
    expect(await db.reviews.get('x')).toBeTruthy()
  })

  it('überträgt nichts, wenn sich nichts geändert hat, und lädt nur lokale Änderungen hoch', async () => {
    const { syncProfile } = await import('./syncService')
    const exam = await seed()
    await db.meta.put({ key: `dropbox:${P}`, value: { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, connectedAt: 0 } })
    await syncProfile(P)
    expect([...files.keys()].some((k) => k.startsWith(`/backups/${P}/`))).toBe(true)

    calls = []
    await syncProfile(P)
    expect(calls).toEqual([`files/get_metadata /sync/${P}.lernsync`])

    const profile = (await db.profiles.get(P))!
    await recordReview(profile, exam, (await db.cards.get('e1:pk:c1'))!, Rating.Good, 'mobile', 1000)
    calls = []
    await syncProfile(P)
    expect(calls.some((c) => c.startsWith('files/download'))).toBe(false)
    expect(calls.filter((c) => c.startsWith('files/upload /sync'))).toHaveLength(1)
  })

  it('behält nur die letzten acht Wochensicherungen', async () => {
    const { syncProfile } = await import('./syncService')
    await seed()
    await db.meta.put({ key: `dropbox:${P}`, value: { accessToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3600_000, connectedAt: 0 } })
    for (let w = 1; w <= 9; w++) files.set(`/backups/${P}/2026-KW${String(w).padStart(2, '0')}.lernsync`, { data: new Uint8Array(), rev: 1 })
    await syncProfile(P)
    const backups = [...files.keys()].filter((k) => k.startsWith(`/backups/${P}/`)).sort()
    expect(backups).toHaveLength(8)
    expect(backups[0]).toBe(`/backups/${P}/2026-KW03.lernsync`)
  })
})
