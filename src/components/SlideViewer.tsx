import { useEffect, useRef, useState } from 'react'
import { findPdf, loadPdf, storePdf } from '../lib/pdfs'
import { Link } from 'react-router-dom'
import { Icon } from './ui'

type Doc = Awaited<ReturnType<typeof loadPdf>>

/** Zeigt eine Seite der Vorlesungsunterlage als Overlay; Unterlage kommt vom Gerät, aus Dropbox oder per Dateiauswahl. */
export function SlideViewer({ file, page, profileId, onClose }: { file: string; page: number; profileId: string; onClose: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'ready' | 'error'>('loading')
  const [current, setCurrent] = useState(page)
  const canvas = useRef<HTMLCanvasElement>(null)

  const open = async (blob: Blob) => {
    try {
      const d = await loadPdf(blob)
      setDoc(d)
      setCurrent(Math.min(Math.max(1, page), d.numPages))
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    findPdf(file, profileId)
      .then((blob) => (blob ? open(blob) : setState('missing')))
      .catch(() => setState('missing'))
  }, [file, profileId])

  useEffect(() => {
    if (!doc || !canvas.current) return
    let cancelled = false
    doc.getPage(current).then((p) => {
      if (cancelled || !canvas.current) return
      const el = canvas.current
      const width = el.parentElement?.clientWidth ?? 600
      const base = p.getViewport({ scale: 1 })
      const ratio = window.devicePixelRatio || 1
      const viewport = p.getViewport({ scale: (width / base.width) * ratio })
      el.width = viewport.width
      el.height = viewport.height
      el.style.width = `${width}px`
      p.render({ canvas: el, viewport })
    })
    return () => {
      cancelled = true
    }
  }, [doc, current])

  async function pick(f?: File) {
    if (!f) return
    setState('loading')
    open(f)
    // Speichern (und ggf. Hochladen nach Dropbox) im Hintergrund – die Folie ist sofort sichtbar.
    storePdf(file, f, profileId).catch(() => {})
  }

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={`Folie aus ${file}`} onClick={onClose}>
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="grow truncate">
            <b>{file}</b>
            {state === 'ready' && doc && <small> · Seite {current} von {doc.numPages}</small>}
          </div>
          <button className="btn ghost small" onClick={onClose} aria-label="Schließen">
            <Icon name="close" />
          </button>
        </div>

        {state === 'loading' && <p className="muted">Lade Unterlage …</p>}
        {state === 'error' && <p className="error">Die Datei konnte nicht als PDF geöffnet werden.</p>}
        {state === 'missing' && (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Die Unterlage <b>{file}</b> ist auf diesem Gerät noch nicht vorhanden. Wähle die PDF-Datei einmalig aus – mit Dropbox-Sync steht sie danach auch auf deinen anderen Geräten bereit. Alle Skripte auf einmal zuordnen: <Link to="/unterlagen">Unterlagen</Link>.
            </p>
            <label className="btn primary block">
              PDF auswählen
              <input type="file" accept="application/pdf,.pdf" hidden onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
        )}
        {state === 'ready' && (
          <>
            <div className="slide-canvas">
              <canvas ref={canvas} />
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn grow" disabled={current <= 1} onClick={() => setCurrent((c) => c - 1)}>Vorherige</button>
              <button className="btn grow" disabled={!doc || current >= doc.numPages} onClick={() => setCurrent((c) => c + 1)}>Nächste</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
