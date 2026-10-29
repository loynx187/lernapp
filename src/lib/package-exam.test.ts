import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'
import { packageExam } from './bundle'

const sample = parsePackage(JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8')))

const exam = (id: string, name: string, slug?: string): Exam => ({
  id, profileId: 'p1', semesterId: 's1', name, date: '2027-02-01', weight: 1, color: '#ff9500', createdAt: 0, profile: slug ? { slug } : undefined,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Prüfung für ein einzelnes Paket erkennen', () => {
  const rt = exam('e1', 'Regelungstechnik')
  const qm = exam('e2', 'Qualitätsmanagement', 'qualitaetsmanagement')

  it('nimmt bei Updates die Prüfung, in der das Paket schon liegt – auch wenn der Fachname abweicht', async () => {
    await db.exams.bulkAdd([rt, qm])
    await importPackage(qm, { ...sample, id: 'qm-grundlagen' }, 1)
    const r = await packageExam([rt, qm], { ...sample, id: 'qm-grundlagen', module: 'Regelungstechnik', version: 2 })
    expect(r).toEqual({ exam: qm, installed: true })
  })

  it('erkennt neue Pakete am Archiv-Ordner oder am Fachnamen', async () => {
    await db.exams.bulkAdd([rt, qm])
    expect((await packageExam([rt, qm], { ...sample, id: 'x', module: 'QM', profile: { slug: 'qualitaetsmanagement' } })).exam?.id).toBe('e2')
    expect((await packageExam([rt, qm], { ...sample, id: 'y', module: 'Regelungstechnik' })).exam?.id).toBe('e1')
  })

  it('liefert ohne Treffer keine Prüfung', async () => {
    await db.exams.bulkAdd([rt, qm])
    expect(await packageExam([rt, qm], sample)).toEqual({ exam: undefined, installed: false })
  })
})
