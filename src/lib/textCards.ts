import { PACKAGE_FORMAT, slugify, type CardPackage } from './package-format'

/** Ein Frage-Antwort-Paar aus Text oder Fremdformat; `chapter` aus Überschriften („## Kapitel“). */
export interface TextCard {
  front: string
  back: string
  chapter?: string
}

const Q_LABEL = /^(?:\d+[.)]\s*)?(?:F|Frage|Q|Question|Vorderseite|Front|Begriff|Term)\s*\d*\s*[:.)]\s*/i
const A_LABEL = /^(?:A|Antwort|Answer|Rückseite|Back|Definition|Lösung)\s*\d*\s*[:.)]\s*/i
const CHAPTER = /^(?:#{1,6}\s+(.+?)\s*#*$|(?:Kapitel|Thema|Chapter|Topic)\s*[:.]\s*(.+))$/i

/** Entfernt Markdown-Fettdruck um Labels („**Frage:**“) und HTML aus Anki-Exporten. */
function clean(line: string): string {
  return line
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p|span|b|i|u|strong|em)[^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/^\s*[-*]\s+(?=\*\*|F|Q|A)/, '')
    .replace(/^\*\*([^*]+?)\*\*\s*/, '$1 ')
    .replace(/^__([^_]+?)__\s*/, '$1 ')
    .trim()
}

const chapterOf = (line: string) => {
  const m = line.trim().match(CHAPTER)
  return m ? (m[1] ?? m[2]).replace(/\*+/g, '').trim() : undefined
}

/** Zerlegt eine CSV-Zeile mit Anführungszeichen ("…""…") am gegebenen Trennzeichen. */
function splitCsv(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"' && !cur.trim()) quoted = true
    else if (line.startsWith(sep, i)) {
      out.push(cur)
      cur = ''
      i += sep.length - 1
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Karten aus JSON anderer Tools: Listen mit question/answer, front/back, frage/antwort, term/definition … */
function fromJson(raw: unknown): TextCard[] | null {
  const list = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.cards ?? (raw as Record<string, unknown>)?.flashcards ?? (raw as Record<string, unknown>)?.karten
  if (!Array.isArray(list)) return null
  const pick = (o: Record<string, unknown>, keys: string[]) => {
    for (const k of Object.keys(o)) if (keys.includes(k.toLowerCase()) && typeof o[k] === 'string') return (o[k] as string).trim()
    return ''
  }
  const cards = list
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => ({
      front: pick(o, ['front', 'question', 'frage', 'q', 'term', 'begriff', 'vorderseite', 'prompt']),
      back: pick(o, ['back', 'answer', 'antwort', 'a', 'definition', 'rückseite', 'ruckseite', 'solution', 'lösung', 'response']),
      chapter: pick(o, ['chapter', 'kapitel', 'topic', 'thema', 'deck', 'category']) || undefined,
    }))
    .filter((c) => c.front && c.back)
  return cards.length ? cards : null
}

/**
 * Liest Frage/Antwort-Paare aus Text anderer Tools (NotebookLM, Quizlet, Anki, ChatGPT, Excel …):
 * - Blöcke mit „F:“/„Frage:“/„Q:“ und „A:“/„Antwort:“ (auch fett oder nummeriert, mehrzeilige Antworten)
 * - je Zeile „Frage<TAB>Antwort“, „Frage ;; Antwort“, „Frage;Antwort“ oder CSV mit Anführungszeichen
 * - Markdown-Tabellen mit zwei Spalten
 * - JSON-Listen mit Feldern wie question/answer oder front/back
 * Überschriften („## Thema“ oder „Kapitel: …“) gruppieren die folgenden Karten als Kapitel.
 */
export function parseTextCards(text: string): TextCard[] {
  const src = text.replace(/\r\n?/g, '\n').replace(/^﻿/, '')
  if (/^\s*[[{]/.test(src)) {
    try {
      const cards = fromJson(JSON.parse(src))
      if (cards) return cards
    } catch {
      // kein JSON – als Text lesen
    }
  }
  // Anki-Kopfzeilen wie „#separator:tab“ überspringen
  const lines = src.split('\n').filter((l) => !/^#[a-z]+:/i.test(l.trim()))
  // Blockweise lesen (Leerzeile trennt), damit verschiedene Formate in einem Text funktionieren
  const ctx: Ctx = { chapter: undefined }
  const out: TextCard[] = []
  let block: string[] = []
  let lastLabelled = false
  const flushBlock = () => {
    if (!block.some((l) => l.trim())) return (block = [])
    let cards: TextCard[]
    if (block.some((l) => Q_LABEL.test(clean(l)))) {
      cards = labelled(block, ctx)
      lastLabelled = true
    } else if (block.filter((l) => /^\s*\|.*\|\s*$/.test(l)).length >= 2) {
      cards = table(block, ctx)
      lastLabelled = false
    } else {
      cards = separated(block, ctx)
      // Weiterer Absatz einer mehrzeiligen Antwort („F:/A:“ mit Leerzeile in der Antwort)
      const text = block.map(clean).join('\n').trim()
      if (!cards.length && lastLabelled && out.length && !block.some((l) => chapterOf(l))) out[out.length - 1].back += `\n\n${text}`
      else lastLabelled = false
    }
    out.push(...cards)
    block = []
  }
  for (const line of lines) {
    if (line.trim()) block.push(line)
    else flushBlock()
  }
  flushBlock()
  return out
}

interface Ctx {
  chapter: string | undefined
}

function labelled(lines: string[], ctx: Ctx): TextCard[] {
  const out: TextCard[] = []
  let cur: TextCard | null = null
  let field: 'front' | 'back' = 'front'
  const flush = () => {
    if (cur && cur.front.trim() && cur.back.trim()) out.push({ ...cur, front: cur.front.trim(), back: cur.back.trim() })
    cur = null
  }
  for (const raw of lines) {
    const line = clean(raw)
    const ch = !Q_LABEL.test(line) && !A_LABEL.test(line) ? chapterOf(raw) : undefined
    if (ch) {
      flush()
      ctx.chapter = ch
    } else if (Q_LABEL.test(line)) {
      flush()
      cur = { front: line.replace(Q_LABEL, ''), back: '', chapter: ctx.chapter }
      field = 'front'
    } else if (cur && A_LABEL.test(line)) {
      field = 'back'
      cur.back = line.replace(A_LABEL, '')
    } else if (cur) {
      cur[field] += `\n${line}`
    }
  }
  flush()
  return out
}

function table(lines: string[], ctx: Ctx): TextCard[] {
  const out: TextCard[] = []
  let header = true
  lines.forEach((raw, i) => {
    const ch = chapterOf(raw)
    if (ch) {
      ctx.chapter = ch
      header = true
      return
    }
    if (!/^\s*\|.*\|\s*$/.test(raw)) return
    const cells = raw.trim().slice(1, -1).split('|').map((c) => c.trim())
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return
    // Erste Zeile ist Kopfzeile, wenn eine Trennzeile folgt
    const wasHeader = header
    header = false
    if (wasHeader && /^\s*\|\s*:?-{2,}/.test(lines[i + 1] ?? '')) return
    if (cells.length >= 2 && cells[0] && cells.slice(1).join(' ').trim()) {
      out.push({ front: cells[0], back: cells.slice(1).filter(Boolean).join('\n'), chapter: ctx.chapter })
    }
  })
  return out
}

function separated(lines: string[], ctx: Ctx): TextCard[] {
  const out: TextCard[] = []
  for (const raw of lines) {
    const ch = chapterOf(raw)
    if (ch) {
      ctx.chapter = ch
      continue
    }
    const line = raw.replace(/<br\s*\/?>/gi, '\n')
    let parts: string[]
    if (line.includes('\t')) parts = splitCsv(line, '\t')
    else if (/\s;;\s/.test(line)) parts = line.split(/\s;;\s/).map((s) => s.trim())
    else if (line.trim().startsWith('"')) parts = splitCsv(line, /^"(?:[^"]|"")*"\s*;/.test(line.trim()) ? ';' : ',')
    else if (line.includes(';')) parts = splitCsv(line, ';')
    else continue
    const [front, ...rest] = parts.map((p) => clean(p))
    const back = rest.filter(Boolean).join('\n')
    if (front && back) out.push({ front, back, chapter: ctx.chapter })
  }
  return out
}

/** Kurzer, stabiler Fingerabdruck – gleiche Frage ergibt bei erneutem Import dieselbe uid. */
function hash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/**
 * Baut ein Kartenpaket aus eingefügten Karten. Paket-ID und uids leiten sich aus Titel und
 * Fragetext ab: Wer dieselbe (ergänzte) Datei mit gleichem Titel erneut importiert, aktualisiert
 * das Paket, statt ein zweites anzulegen – der Lernfortschritt bleibt.
 */
export function textToPackage(title: string, cards: TextCard[]): CardPackage {
  const chapters: { id: string; title: string }[] = []
  const chapterId = (t?: string) => {
    if (!t) return undefined
    let ch = chapters.find((c) => c.title === t)
    if (!ch) chapters.push((ch = { id: `k${chapters.length + 1}`, title: t }))
    return ch.id
  }
  const seen = new Map<string, number>()
  return {
    format: PACKAGE_FORMAT,
    formatVersion: 1,
    id: `text-${slugify(title) || 'karten'}`,
    title,
    version: 1,
    chapters,
    cards: cards.map((c) => {
      const base = `t-${hash(c.front.trim().toLowerCase())}`
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      return { uid: n > 1 ? `${base}-${n}` : base, type: 'basic' as const, chapter: chapterId(c.chapter), front: c.front, back: c.back }
    }),
  }
}

/** Anleitung für ChatGPT, Gemini, NotebookLM & Co., damit deren Karten hier sauber importiert werden. */
export const OTHER_AI_PROMPT = `Erstelle aus den angehängten Vorlesungsunterlagen Karteikarten für die Prüfungsvorbereitung.

Regeln:
- Nur prüfungsrelevante Kerninhalte, eine Karte = ein abfragbarer Gedanke.
- Reihenfolge wie im Skript. Vor jedem Thema bzw. Kapitel eine Überschrift im Format „## Kapitelname“.
- Jede Karte genau so:
F: <Frage>
A: <Antwort, gern mehrzeilig>

- Zwischen zwei Karten eine Leerzeile. Formeln in LaTeX zwischen $…$.
- Gib nur die Karten aus, ohne weiteren Text davor oder danach.`
