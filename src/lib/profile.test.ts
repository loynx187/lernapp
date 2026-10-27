import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { db, type Exam, type Semester } from './db'
import { importPackage, parsePackage } from './packages'
import { buildOrder, matchExam, mergeProfile, orderText, parseProfilesFile, slugify } from './profile'
import { reportCard } from './reports'

const sample = JSON.parse(readFileSync(new URL('../../public/beispiel-paket.json', import.meta.url), 'utf8'))
const semester: Semester = { id: 's1', profileId: 'p1', name: '5. Semester', createdAt: 0, kind: 'dual' }
const exam: Exam = { id: 'e1', profileId: 'p1', semesterId: 's1', name: 'Technische Mechanik II', date: '2027-02-01', weight: 2, color: '#000', createdAt: 0 }

beforeEach(async () => {
  await db.delete()
  await db.open()
  await db.semesters.add(semester)
  await db.exams.add(exam)
})

describe('Fachprofil', () => {
  it('bildet Ordnernamen wie im Inhalte-Archiv', () => {
    expect(slugify('Qualitätsmanagement')).toBe('qualitaetsmanagement')
    expect(slugify('Technische Mechanik II')).toBe('technische-mechanik-ii')
    expect(slugify('Strömungslehre & Wärmeübertragung')).toBe('stroemungslehre-waermeuebertragung')
  })

  it('übernimmt Vorschläge nur in leere oder unbestätigte Felder', () => {
    const { profile, changed } = mergeProfile({ form: 'mündlich', duration: 30, suggested: ['duration'] }, { form: 'schriftlich', duration: 90, aids: 'Taschenrechner' }, false)
    expect(profile.form).toBe('mündlich')
    expect(profile.duration).toBe(90)
    expect(profile.aids).toBe('Taschenrechner')
    expect(changed.sort()).toEqual(['aids', 'duration'])
    expect(profile.suggested?.sort()).toEqual(['aids', 'duration'])
    expect(mergeProfile({ form: 'mündlich' }, { form: 'schriftlich' }, true).profile.form).toBe('schriftlich')
  })

  it('liest Fachprofile von Claude und ordnet sie Prüfungen zu', () => {
    const entries = parseProfilesFile({
      format: 'lernapp-fachprofile',
      exams: [
        { name: 'Technische Mechanik 2', slug: 'technische-mechanik-ii', profile: { taskShare: 'hoch', unbekannt: 1 } },
        { name: 'Leer', profile: {} },
      ],
    })
    expect(entries).toHaveLength(1)
    expect(entries[0].profile).toEqual({ taskShare: 'hoch', slug: 'technische-mechanik-ii' })
    expect(matchExam([exam], entries[0])?.id).toBe('e1')
    expect(() => parseProfilesFile({ format: 'x' })).toThrow(/Fachprofile/)
  })

  it('übernimmt beim Paketimport das vorgeschlagene Fachprofil', async () => {
    const pkg = parsePackage({ ...sample, profile: { form: 'schriftlich', taskShare: 'hoch', slug: 'tm2' } })
    const r = await importPackage(exam, pkg)
    expect(r.profileFields.sort()).toEqual(['form', 'taskShare'])
    const stored = (await db.exams.get('e1'))!.profile!
    expect(stored).toMatchObject({ form: 'schriftlich', taskShare: 'hoch', slug: 'tm2' })
  })
})

describe('Auftrag für Claude', () => {
  it('enthält Fachprofil, Pakete und offene Meldungen', async () => {
    const pkg = parsePackage(sample)
    await importPackage(exam, pkg)
    const card = (await db.cards.toArray())[0]
    await reportCard(card, 'fehler', 'Vorzeichen falsch')
    await db.exams.update('e1', { profile: { aids: 'Taschenrechner', suggested: ['aids'] } })
    const order = await buildOrder([(await db.exams.get('e1'))!], semester)
    expect(order).toMatchObject({ format: 'lernapp-auftrag', semester: { kind: 'dual' } })
    const e = order.exams[0]
    expect(e).toMatchObject({ name: 'Technische Mechanik II', slug: 'technische-mechanik-ii', profile: { aids: 'Taschenrechner' }, unconfirmed: ['aids'] })
    expect(e.packages).toEqual([{ id: pkg.id, title: pkg.title, version: pkg.version, cards: pkg.cards.length }])
    expect(e.reports?.[0]).toMatchObject({ uid: card.uid, note: 'Vorzeichen falsch', front: card.front })
    const text = orderText(order)
    expect(text.startsWith('/kartenpaket Technische Mechanik II')).toBe(true)
    expect(JSON.parse(text.split('```json\n')[1].split('\n```')[0])).toEqual(JSON.parse(JSON.stringify(order)))
  })
})
