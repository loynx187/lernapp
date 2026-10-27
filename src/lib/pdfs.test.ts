import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { matchFiles, normalizeName, requiredDocuments } from './pdfs'
import { db } from './db'
import { newMemoryState } from './scheduler'

describe('matchFiles', () => {
  it('ordnet Dateien exakt oder unabhängig von Schreibweise zu', () => {
    const required = ['02_Vorlesungsblock_1-3.pdf', 'TM2 Skript Teil 1.pdf']
    const files = [{ name: '02_Vorlesungsblock_1-3.pdf' }, { name: 'tm2_skript_teil_1.PDF' }, { name: 'Altklausur 2024.pdf' }]
    const { matched, unmatched } = matchFiles(files, required)
    expect(matched.get('02_Vorlesungsblock_1-3.pdf')?.name).toBe('02_Vorlesungsblock_1-3.pdf')
    expect(matched.get('TM2 Skript Teil 1.pdf')?.name).toBe('tm2_skript_teil_1.PDF')
    expect(unmatched.map((f) => f.name)).toEqual(['Altklausur 2024.pdf'])
  })

  it('ignoriert Umlaute-Varianten und Sonderzeichen', () => {
    expect(normalizeName('Übung Thermo.pdf')).toBe(normalizeName('Ubung_Thermo.pdf'))
  })
})

describe('requiredDocuments', () => {
  it('sammelt die Unterlagen der Karten je Prüfung', async () => {
    const card = (id: string, examId: string, file?: string) => ({
      id, uid: id, type: 'basic' as const, front: 'F', back: 'B', profileId: 'p', examId, packageId: 'pk',
      order: 0, archived: 0 as const, addedAt: 0, s: newMemoryState(0), source: file ? { file, slide: 1 } : undefined,
    })
    await db.cards.bulkPut([card('a', 'e1', 'A.pdf'), card('b', 'e1', 'A.pdf'), card('c', 'e2', 'A.pdf'), card('d', 'e2', 'B.pdf'), card('e', 'e2')])
    const docs = await requiredDocuments(['e1', 'e2'])
    expect(docs).toEqual([
      { name: 'A.pdf', examIds: ['e1', 'e2'], cards: 3 },
      { name: 'B.pdf', examIds: ['e2'], cards: 1 },
    ])
  })
})
