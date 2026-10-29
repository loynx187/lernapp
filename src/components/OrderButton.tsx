import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Exam, Semester } from '../lib/db'
import { buildOrder, orderText, rememberSlugs } from '../lib/profile'

/**
 * Kopiert den Auftrag für Claude (/kartenpaket mit Prüfungen, Fachprofilen, Paketständen
 * und offenen Meldungen). Der Text wird vorab berechnet, weil iOS das Kopieren nur
 * direkt im Tipp erlaubt.
 */
export function OrderButton({ exams, semester, label }: { exams: Exam[]; semester: Semester; label: string }) {
  const text = useLiveQuery(async () => orderText(await buildOrder(exams, semester)), [exams.map((e) => `${e.id}:${e.updatedAt}`).join(), semester.id, semester.name, semester.kind])
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle')

  async function copy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setState('ok')
    } catch {
      setState('error')
    }
    await rememberSlugs(exams)
  }

  return (
    <div className="stack">
      <button className="btn primary block" onClick={copy} disabled={!text}>
        {state === 'ok' ? 'Auftrag kopiert ✓' : label}
      </button>
      {state === 'error' && (
        <>
          <small>Kopieren nicht möglich – Text markieren und kopieren:</small>
          <textarea readOnly value={text} onFocus={(e) => e.target.select()} style={{ minHeight: 120, fontSize: 12 }} />
        </>
      )}
    </div>
  )
}

export function OrderSteps() {
  return (
    <ol className="help" style={{ margin: 0, fontSize: 14 }}>
      <li>In der Claude-App eine Claude-Code-Sitzung mit dem Repository <code>lernapp</code> starten.</li>
      <li>Auftrag einfügen und die Unterlagen anhängen (Skript, Übungen, Altklausuren).</li>
      <li>Was Claude zurückgibt (Paket-Sammlung oder Fachprofile) unter „Karten importieren“ einlesen – die App ordnet alles der richtigen Prüfung zu. Vorschläge fürs Fachprofil werden dabei übernommen und markiert.</li>
    </ol>
  )
}
