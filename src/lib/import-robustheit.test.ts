import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, EXAM_COLORS, type Exam } from './db'
import { exportPackage, importPackage, parsePackage } from './packages'
import { requiredApp } from './package-format'
import { parseTemplate } from './template'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Technische Mechanik', date: '2027-02-01', weight: 2, color: '#ff9500', createdAt: 0 }

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Mindest-App-Version', () => {
  it('ergibt sich aus Kartentypen und Feldern', () => {
    expect(requiredApp([{ type: 'basic' }])).toBeUndefined()
    expect(requiredApp([{ type: 'basic' }, { type: 'match' }])).toBe('1.15.0')
    expect(requiredApp([{ type: 'match' }, { type: 'basic', prompts: ['Warum?'] }])).toBe('1.19.0')
  })

  it('steht in geteilten Paketen, damit ältere Apps beim Empfänger warnen', async () => {
    await db.exams.add(exam)
    const cards = sample.cards.map((c, i) => (i === 0 ? { ...c, prompts: ['Was passiert mit der Spannung?'], keyPoints: ['Spannung steigt'] } : c))
    await importPackage(exam, { ...sample, cards })
    expect((await exportPackage(exam, sample.id)).minApp).toBe('1.19.0')
  })
})

describe('Vorlagen von Kommilitonen', () => {
  const template = (e: Record<string, unknown>) => ({ format: 'lernapp-vorlage', formatVersion: 1, semesters: [{ name: 'S', kind: 'dual', exams: [{ name: 'Mathe', date: '2027-02-01', packages: [], ...e }] }] })

  it('begrenzt die Wichtigkeit auf 1–3 und verwirft ungültige Farben', () => {
    const exams = (e: Record<string, unknown>) => parseTemplate(template(e)).semesters[0].exams[0]
    expect(exams({ weight: 50, color: 'url(https://example.com/x.png)' })).toMatchObject({ weight: 3, color: EXAM_COLORS[0] })
    expect(exams({ weight: 0.2, color: '#34c759' })).toMatchObject({ weight: 1, color: '#34c759' })
    expect(exams({ weight: '3' }).weight).toBe(2)
  })
})
