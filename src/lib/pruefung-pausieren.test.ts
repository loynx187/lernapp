import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam, type Semester } from './db'
import { importPackage, parsePackage } from './packages'
import { loadStudyData } from './study'
import { buildOrder } from './profile'

const NOW = new Date(2026, 10, 15, 12, 0).getTime()
const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))
const exam = (id: string, name: string): Exam => ({ id, profileId: 'p1', semesterId: 's1', name, date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 })
const semester: Semester = { id: 's1', profileId: 'p1', name: 'S5', createdAt: 0 }

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.profiles.add({ id: 'p1', name: 'T', createdAt: 0, minutesMobile: 20, minutesDesk: 30, retention: 0.9, activeSemesterId: 's1' })
  await db.semesters.add(semester)
  for (const e of [exam('e1', 'QM'), exam('e2', 'TM')]) {
    await db.exams.add(e)
    await importPackage(e, { ...sample, id: `p-${e.id}` }, NOW)
  }
  await db.homework.add({ id: 'h1', profileId: 'p1', examId: 'e1', title: 'Blatt 1', description: '', due: '2026-11-16', minutes: 30, createdAt: 0 })
})

describe('Prüfung pausieren', () => {
  it('plant eine pausierte Prüfung nicht ein, behält ihre Hausaufgaben und meldet sie im Auftrag', async () => {
    await db.exams.update('e1', { pausedAt: NOW })
    const profile = (await db.profiles.get('p1'))!
    const d = await loadStudyData(profile, NOW)
    expect(d.exams.map((e) => e.id)).toEqual(['e2'])
    expect(new Set(d.cards.map((c) => c.examId))).toEqual(new Set(['e2']))
    expect(d.plan.exams.map((p) => p.examId)).toEqual(['e2'])
    expect(d.homework.map((h) => h.id)).toEqual(['h1'])
    // Lernstand bleibt: die Karten sind weiter da
    expect(await db.cards.where('examId').equals('e1').count()).toBe(sample.cards.length)

    const order = await buildOrder([(await db.exams.get('e1'))!, (await db.exams.get('e2'))!], semester, NOW)
    expect(order.exams.map((e) => e.paused)).toEqual([true, undefined])

    await db.exams.update('e1', { pausedAt: undefined })
    expect((await loadStudyData(profile, NOW)).exams.map((e) => e.id)).toEqual(['e1', 'e2'])
  })
})
