import { describe, expect, it } from 'vitest'
import type { Exam, PackageRecord, StudyCard } from './db'
import { newMemoryState } from './scheduler'
import { examStats, packageBlocks, toPlanCard } from './stats'

const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'QM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
const pkg = (packageId: string, importedAt: number, firstImportedAt?: number): PackageRecord => ({
  id: `e1:${packageId}`, profileId: 'p1', examId: 'e1', packageId, title: packageId, version: 1, importedAt, firstImportedAt, cardCount: 1,
})
const card = (packageId: string, chapter: string, chapterTitle: string, order: number): StudyCard => ({
  id: `e1:${packageId}:${chapter}-${order}`, uid: `${chapter}-${order}`, profileId: 'p1', examId: 'e1', packageId, type: 'basic',
  front: 'F', back: 'B', chapter, chapterTitle, order, archived: 0, addedAt: 0, s: newMemoryState(0),
})

describe('Pakete einer Prüfung', () => {
  it('ordnet Pakete nach dem ersten Import, auch wenn eines später aktualisiert wurde', () => {
    const blocks = packageBlocks([pkg('zweites', 200), pkg('erstes', 900, 100)])
    expect(blocks.get('e1:erstes')).toBe(0)
    expect(blocks.get('e1:zweites')).toBe(1)
    expect(toPlanCard(card('zweites', 'k1', 'X', 0), blocks).block).toBe(1)
  })

  it('zeigt gleich benannte Kapitel verschiedener Pakete getrennt und in Paket-Reihenfolge', () => {
    const blocks = packageBlocks([pkg('b', 200), pkg('a', 100)])
    const cards = [card('b', 'k1', 'Normen', 0), card('a', 'k2', 'Wertschöpfung', 100_000), card('a', 'k1', 'Was ist Qualität?', 0), card('b', 'k1', 'Normen', 1)]
    const titles = examStats(exam, cards, 0, 0.9, blocks).chapters.map((c) => `${c.title}:${c.total}`)
    expect(titles).toEqual(['Was ist Qualität?:1', 'Wertschöpfung:1', 'Normen:2'])
  })
})
