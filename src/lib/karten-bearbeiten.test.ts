import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { exportPackage, importPackage, parsePackage } from './packages'
import { checkEdit, editCard, resetCardEdit } from './cards'
import { reportCard } from './reports'
import { buildOrder } from './profile'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Technische Mechanik', date: '2027-02-01', weight: 2, color: '#ff9500', createdAt: 0 }
const first = sample.cards[0]
const id = `e1:${sample.id}:${first.uid}`
const get = async () => (await db.cards.get(id))!

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.exams.add(exam)
  await importPackage(exam, sample, 1)
})

describe('Karten bearbeiten', () => {
  it('speichert die eigene Fassung samt Paketfassung, erledigt Meldungen und wird beim Zurückändern wieder normal', async () => {
    await reportCard(await get(), 'fehler', 'Tippfehler', 2)
    await editCard(await get(), { front: 'Eigene Frage?', back: first.back, prompts: ['Erster Tipp?'] }, 3)
    const card = await get()
    expect(card).toMatchObject({ front: 'Eigene Frage?', prompts: ['Erster Tipp?'], edit: { editedAt: 3, original: { front: first.front } } })
    expect((await db.reports.toArray())[0].resolvedAt).toBe(3)

    await editCard(card, { front: first.front, back: first.back, prompts: first.prompts }, 4)
    expect((await get()).edit).toBeUndefined()
  })

  it('behält die eigene Fassung bei Paket-Updates und merkt sich geänderte Paketinhalte', async () => {
    await editCard(await get(), { front: 'Eigene Frage?', back: first.back }, 3)
    const v3 = { ...sample, version: 3, cards: sample.cards.map((c, i) => (i === 0 ? { ...c, back: 'Neue Antwort aus dem Paket' } : c)) }
    await importPackage(exam, v3, 5)
    // Nicht bearbeitete Felder folgen dem Paket, ohne Hinweis
    let card = await get()
    expect(card).toMatchObject({ front: 'Eigene Frage?', back: 'Neue Antwort aus dem Paket', edit: { original: { front: first.front, back: 'Neue Antwort aus dem Paket' } } })
    expect(card.edit?.packageChanged).toBeUndefined()

    // Ändert das Paket die selbst bearbeitete Frage, bleibt die eigene – mit Hinweis
    await importPackage(exam, { ...v3, version: 4, cards: v3.cards.map((c, i) => (i === 0 ? { ...c, front: 'Neue Frage aus dem Paket?' } : c)) }, 6)
    card = await get()
    expect(card).toMatchObject({ front: 'Eigene Frage?', edit: { packageChanged: true, original: { front: 'Neue Frage aus dem Paket?' } } })

    await resetCardEdit(card)
    card = await get()
    expect(card).toMatchObject({ front: 'Neue Frage aus dem Paket?', back: 'Neue Antwort aus dem Paket' })
    expect(card.edit).toBeUndefined()
  })

  it('gilt nicht mehr als bearbeitet, wenn das Paket die eigene Fassung übernimmt', async () => {
    await editCard(await get(), { front: 'Eigene Frage?', back: first.back }, 3)
    await importPackage(exam, { ...sample, version: 3, cards: sample.cards.map((c, i) => (i === 0 ? { ...c, front: 'Eigene Frage?' } : c)) }, 5)
    const card = await get()
    expect(card.front).toBe('Eigene Frage?')
    expect(card.edit).toBeUndefined()
  })

  it('steht im Auftrag mit den geänderten Feldern, geteilt wird die eigene Fassung', async () => {
    await editCard(await get(), { front: first.front, back: first.back, keyPoints: ['Kernpunkt'] }, 3)
    const order = await buildOrder([exam], { id: 's1', profileId: 'p1', name: 'S', createdAt: 0 })
    expect(order.exams[0].packages[0].edited).toEqual([{ uid: first.uid, keyPoints: ['Kernpunkt'] }])
    const shared = await exportPackage(exam, sample.id)
    const card = shared.cards.find((c) => c.uid === first.uid)!
    expect(card.keyPoints).toEqual(['Kernpunkt'])
    expect('edit' in card).toBe(false)
  })

  it('prüft die Eingabe', () => {
    expect(checkEdit({ type: 'basic' }, { front: ' ', back: '' })).toMatch(/leer/)
    expect(checkEdit({ type: 'cloze' }, { front: 'ohne Lücke', back: '' })).toMatch(/Lücke/)
    expect(checkEdit({ type: 'cloze' }, { front: 'mit {{Lücke}}', back: '' })).toBeNull()
  })
})
