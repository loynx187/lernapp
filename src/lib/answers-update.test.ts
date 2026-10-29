import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam } from './db'
import { importPackage, parsePackage } from './packages'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'TM', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }
const task = sample.cards.find((c: { type?: string; answers?: unknown[] }) => c.type === 'task' && c.answers?.length)
const withTask = (version: number, t: object) => ({ ...sample, version, cards: sample.cards.map((c: { uid: string }) => (c.uid === task.uid ? t : c)) })

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Update von Rechenaufgaben', () => {
  it('erkennt geänderte Ergebnisse als Änderung und entfernt gestrichene', async () => {
    expect(task).toBeTruthy()
    await importPackage(exam, parsePackage(sample))
    const id = `e1:${sample.id}:${task.uid}`

    const changed = await importPackage(exam, parsePackage(withTask(sample.version + 1, { ...task, answers: [{ value: 42, unit: 'MPa' }] })))
    expect(changed.updated).toBe(1)
    expect((await db.cards.get(id))!.answers).toEqual([{ value: 42, unit: 'MPa' }])

    const { answers: _drop, ...without } = task
    const removed = await importPackage(exam, parsePackage(withTask(sample.version + 2, without)))
    expect(removed.updated).toBe(1)
    expect((await db.cards.get(id))!.answers).toBeUndefined()
  })
})
