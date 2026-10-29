import { useState } from 'react'
import { useActive } from '../state'
import { db, uid } from '../lib/db'
import { IDEAS_V2 } from '../lib/ideas'
import { PageHeader } from '../components/ui'

/** Ideen für Version 2.0.0 – gesammelt während der Testphase, eigene Notizen werden mit dem Profil abgeglichen. */
export function Ideas() {
  const { profile } = useActive()
  const [text, setText] = useState('')
  const own = profile.ideas ?? []

  async function add() {
    const t = text.trim()
    if (!t) return
    await db.profiles.update(profile.id, { ideas: [...own, { id: uid(), text: t, createdAt: Date.now() }] })
    setText('')
  }
  const remove = (id: string) => db.profiles.update(profile.id, { ideas: own.filter((i) => i.id !== id) })

  return (
    <>
      <PageHeader back title="Ideen für Version 2" subtitle="Wird nach der Testphase umgesetzt" />

      <div className="section-title">Eigene Notizen</div>
      <div className="card stack">
        {own.map((i) => (
          <div key={i.id} className="row between" style={{ alignItems: 'flex-start', gap: 8 }}>
            <span style={{ minWidth: 0 }}>{i.text}</span>
            <button className="btn small ghost danger" onClick={() => remove(i.id)} aria-label="Notiz löschen">Löschen</button>
          </div>
        ))}
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Neue Idee</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Was fehlt dir beim Testen?" />
        </label>
        <button className="btn primary block" disabled={!text.trim()} onClick={add}>Notieren</button>
      </div>

      {IDEAS_V2.map((g) => (
        <div key={g.title}>
          <div className="section-title">{g.title}</div>
          <div className="card stack">
            {g.intro && <p className="muted" style={{ margin: 0, fontSize: 14 }}>{g.intro}</p>}
            {g.ideas.map((i) => (
              <details key={i.title} className="explain">
                <summary>{i.title}</summary>
                <p style={{ fontSize: 15 }}>{i.text}</p>
              </details>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
