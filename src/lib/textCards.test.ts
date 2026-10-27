import { describe, expect, it } from 'vitest'
import { plainText } from './cards'
import { parsePackage } from './package-format'
import { parseTextCards, textToPackage } from './textCards'

const fb = (cards: { front: string; back: string; chapter?: string }[]) => cards.map((c) => [c.front, c.back, c.chapter])

describe('Karten aus anderen Tools', () => {
  it('liest ChatGPT-/NotebookLM-Ausgaben mit Überschriften, Fettdruck und mehrzeiligen Antworten', () => {
    const text = `## Grundlagen
**Frage:** Was ist Qualität?
**Antwort:** Grad, in dem inhärente Merkmale
Anforderungen erfüllen.

Q1: Was ist PDCA?
A1: Plan, Do, Check, Act

Nach Act beginnt der nächste Plan.

## Normen
1. Frage: Ist eine Norm verbindlich?
Antwort: Grundsätzlich freiwillig.`
    expect(fb(parseTextCards(text))).toEqual([
      ['Was ist Qualität?', 'Grad, in dem inhärente Merkmale\nAnforderungen erfüllen.', 'Grundlagen'],
      ['Was ist PDCA?', 'Plan, Do, Check, Act\n\nNach Act beginnt der nächste Plan.', 'Grundlagen'],
      ['Ist eine Norm verbindlich?', 'Grundsätzlich freiwillig.', 'Normen'],
    ])
  })

  it('liest Anki-, Quizlet- und Excel-Exporte (Tab, Semikolon, CSV mit Anführungszeichen)', () => {
    const text = '#separator:tab\n#html:true\nWas ist E?\tElastizitätsmodul<br>in MPa\n"Was ist G; kurz?";"Schubmodul, ""G"""\nWas ist ν?;Querkontraktionszahl\n"Was ist σ?","Spannung, Kraft je Fläche"'
    expect(fb(parseTextCards(text))).toEqual([
      ['Was ist E?', 'Elastizitätsmodul\nin MPa', undefined],
      ['Was ist G; kurz?', 'Schubmodul, "G"', undefined],
      ['Was ist ν?', 'Querkontraktionszahl', undefined],
      ['Was ist σ?', 'Spannung, Kraft je Fläche', undefined],
    ])
  })

  it('liest Markdown-Tabellen und JSON-Listen', () => {
    const table = '| Begriff | Erklärung |\n|---|---|\n| SIPOC | Suppliers, Inputs, Process, Outputs, Customers |\n| KPI | wichtigster Leistungsindikator |'
    expect(fb(parseTextCards(table))).toEqual([
      ['SIPOC', 'Suppliers, Inputs, Process, Outputs, Customers', undefined],
      ['KPI', 'wichtigster Leistungsindikator', undefined],
    ])
    const json = JSON.stringify({ flashcards: [{ Question: 'Was ist 8D?', Answer: 'Problemlösung in 8 Disziplinen', topic: 'Problemlösung' }, { term: 'leer' }] })
    expect(fb(parseTextCards(json))).toEqual([['Was ist 8D?', 'Problemlösung in 8 Disziplinen', 'Problemlösung']])
  })

  it('baut ein gültiges Paket mit Kapiteln und stabilen IDs für spätere Updates', () => {
    const cards = parseTextCards('## Kapitel A\nF: Eins?\nA: 1\n\nF: Zwei?\nA: 2\n\n## Kapitel B\nF: Drei?\nA: 3')
    const pkg = parsePackage(textToPackage('QM Zusammenfassung (Lisa)', cards))
    expect(pkg.id).toBe('text-qm-zusammenfassung-lisa')
    expect(pkg.chapters).toEqual([{ id: 'k1', title: 'Kapitel A' }, { id: 'k2', title: 'Kapitel B' }])
    expect(pkg.cards.map((c) => c.chapter)).toEqual(['k1', 'k1', 'k2'])
    // Ergänzte Datei, gleicher Titel: gleiche Paket-ID, bekannte Fragen behalten ihre uid
    const again = textToPackage('QM Zusammenfassung (Lisa)', [{ front: 'Neu?', back: 'x' }, ...cards])
    expect(again.id).toBe(pkg.id)
    expect(again.cards.slice(1).map((c) => c.uid)).toEqual(pkg.cards.map((c) => c.uid))
  })
})

describe('plainText', () => {
  it('macht Formeln für einzeilige Listen lesbar', () => {
    expect(plainText('Das **Hookesche Gesetz** lautet $\\sigma = $ {{$E \\cdot \\varepsilon$}}.')).toBe('Das Hookesche Gesetz lautet σ = E · ε.')
    expect(plainText('Kragträger (l = 2\\,\\mathrm{m})')).toBe('Kragträger (l = 2 m)')
  })
})
