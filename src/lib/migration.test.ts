import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('übernimmt Bewertungen aus Version 1 mit neuer geräteübergreifender ID', async () => {
  const v1 = new Dexie('lernapp')
  v1.version(1).stores({
    profiles: 'id',
    semesters: 'id, profileId',
    exams: 'id, profileId, semesterId',
    cards: 'id, profileId, examId, [examId+archived], packageId',
    logs: '++id, profileId, examId, cardId, reviewedAt',
    packages: 'id, profileId, examId',
    snapshots: 'id, profileId, examId',
  })
  await v1.table('logs').bulkAdd([
    { profileId: 'p', examId: 'e', cardId: 'c', mode: 'mobile', rating: 3, stateBefore: 0, reviewedAt: 1, durationMs: 1 },
    { profileId: 'p', examId: 'e', cardId: 'c', mode: 'mobile', rating: 3, stateBefore: 1, reviewedAt: 2, durationMs: 1 },
  ])
  v1.close()

  const { db } = await import('./db')
  await db.open()
  const reviews = await db.reviews.toArray()
  expect(reviews).toHaveLength(2)
  expect(new Set(reviews.map((r) => r.id)).size).toBe(2)
  expect(typeof reviews[0].id).toBe('string')
  expect(db.tables.map((t) => t.name)).not.toContain('logs')
})
