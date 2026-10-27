// Lernapp-Widget für Scriptable (https://scriptable.app)
//
// Zeigt den Lernfortschritt aus Fortschritt.json, die die Lernapp bei jedem
// Dropbox-Abgleich in ihren App-Ordner schreibt.
// Einrichtung: Scriptable → Einstellungen → File Bookmarks → „+“ → Pick File →
// Dropbox → Apps → (App-Ordner) → Fortschritt.json, Name: Lernapp-Fortschritt
//
// Größen: klein, mittel, groß sowie Sperrbildschirm (rund und rechteckig).

const BOOKMARK = 'Lernapp-Fortschritt'
const APP_URL = 'https://loynx187.github.io/lernapp/'

const C = {
  bg1: new Color('#2997ff'),
  bg2: new Color('#0060df'),
  text: Color.white(),
  muted: new Color('#ffffff', 0.75),
  track: new Color('#ffffff', 0.25),
  outer: Color.white(),
  inner: new Color('#7CF0A6'),
  warn: new Color('#FFD479'),
}

async function loadProgress() {
  const fm = FileManager.iCloud()
  const path = fm.bookmarkedPath(BOOKMARK)
  await fm.downloadFileFromiCloud(path)
  const data = JSON.parse(fm.readString(path))
  if (data.format !== 'lernapp-fortschritt') throw new Error('Unbekanntes Format')
  return data
}

const pct = (x) => `${Math.round((x || 0) * 100)} %`
const days = (n) => (n === 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} T`)

/** Zwei konzentrische Ringe wie in der Lernapp: außen begonnen, innen Prognose. */
function rings(outer, inner, size, outerColor = C.outer, innerColor = C.inner, track = C.track) {
  const dc = new DrawContext()
  dc.size = new Size(size, size)
  dc.opaque = false
  dc.respectScreenScale = true
  const w = size * 0.11
  const arc = (radius, value, color) => {
    const cx = size / 2
    const cy = size / 2
    // Hintergrundring
    dc.setStrokeColor(track)
    dc.setLineWidth(w)
    dc.strokeEllipse(new Rect(cx - radius, cy - radius, radius * 2, radius * 2))
    // Fortschritt als Bogen aus kurzen Liniensegmenten
    const steps = Math.max(1, Math.round(120 * Math.min(1, value)))
    const path = new Path()
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * Math.min(1, value) * i) / steps
      const p = new Point(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
      if (i === 0) path.move(p)
      else path.addLine(p)
    }
    if (value > 0.005) {
      dc.addPath(path)
      dc.setStrokeColor(color)
      dc.strokePath()
    }
  }
  arc(size / 2 - w, outer, outerColor)
  arc(size / 2 - w * 2.4, inner, innerColor)
  return dc.getImage()
}

function bar(value, width, height, color) {
  const dc = new DrawContext()
  dc.size = new Size(width, height)
  dc.opaque = false
  dc.respectScreenScale = true
  const r = height / 2
  const track = new Path()
  track.addRoundedRect(new Rect(0, 0, width, height), r, r)
  dc.addPath(track)
  dc.setFillColor(C.track)
  dc.fillPath()
  const fill = new Path()
  fill.addRoundedRect(new Rect(0, 0, Math.max(height, width * Math.min(1, value)), height), r, r)
  dc.addPath(fill)
  dc.setFillColor(color)
  dc.fillPath()
  return dc.getImage()
}

function text(stack, value, font, color = C.text) {
  const t = stack.addText(String(value))
  t.font = font
  t.textColor = color
  t.lineLimit = 1
  t.minimumScaleFactor = 0.6
  return t
}

function header(w, data, stale) {
  const row = w.addStack()
  row.centerAlignContent()
  text(row, 'Lernapp', Font.semiboldSystemFont(13), C.muted)
  row.addSpacer()
  if (data.serie > 0) text(row, `🔥 ${data.serie}`, Font.semiboldSystemFont(13), C.muted)
  if (stale) text(row, '  ⚠︎', Font.semiboldSystemFont(13), C.warn)
}

function todayLine(stack, data, small) {
  const h = data.heute
  const parts = []
  if (h.karten) parts.push(`${h.karten} Karten`)
  if (h.aufgaben) parts.push(`${h.aufgaben} ${h.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}`)
  const label = parts.length ? parts.join(' · ') : 'Für heute erledigt ✓'
  text(stack, label, Font.semiboldSystemFont(small ? 13 : 15))
  if (h.minuten && parts.length) text(stack, `ca. ${h.minuten} min`, Font.systemFont(12), C.muted)
}

function examRow(stack, e, width) {
  const row = stack.addStack()
  row.layoutVertically()
  const top = row.addStack()
  top.centerAlignContent()
  const dot = top.addText('●')
  dot.font = Font.systemFont(10)
  dot.textColor = new Color(e.farbe)
  top.addSpacer(4)
  text(top, e.name, Font.mediumSystemFont(13))
  top.addSpacer()
  text(top, `${days(e.tage)} · ${pct(e.prognose)}`, Font.systemFont(12), e.rueckstand ? C.warn : C.muted)
  row.addSpacer(3)
  row.addImage(bar(e.begonnen, width, 5, new Color(e.farbe))).imageSize = new Size(width, 5)
}

function build(data, family) {
  const w = new ListWidget()
  w.url = APP_URL
  const stale = Date.now() - new Date(data.stand).getTime() > 36 * 3600 * 1000
  const next = data.pruefungen[0]

  // Sperrbildschirm
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true
    const img = w.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 60, Color.white(), Color.white(), new Color('#ffffff', 0.3)))
    img.imageSize = new Size(52, 52)
    return w
  }
  if (family === 'accessoryRectangular') {
    text(w, next ? `${next.name} ${days(next.tage)}` : 'Lernapp', Font.semiboldSystemFont(13), Color.white())
    const h = data.heute
    text(w, h.karten + h.aufgaben ? `${h.karten + h.aufgaben} heute · ca. ${h.minuten} min` : 'Heute erledigt ✓', Font.systemFont(12), Color.white())
    text(w, `Prognose ${pct(data.gesamt.prognose)}`, Font.systemFont(12), Color.white())
    return w
  }

  const g = new LinearGradient()
  g.colors = [C.bg1, C.bg2]
  g.locations = [0, 1]
  w.backgroundGradient = g
  w.setPadding(14, 14, 14, 14)
  header(w, data, stale)
  w.addSpacer(8)

  if (family === 'small') {
    const row = w.addStack()
    row.centerAlignContent()
    row.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 64)).imageSize = new Size(58, 58)
    row.addSpacer(8)
    const col = row.addStack()
    col.layoutVertically()
    text(col, pct(data.gesamt.prognose), Font.boldSystemFont(20))
    text(col, 'Prognose', Font.systemFont(11), C.muted)
    w.addSpacer()
    todayLine(w, data, true)
    if (next) text(w, `${next.name} ${days(next.tage)}`, Font.systemFont(11), C.muted)
    return w
  }

  if (family === 'medium') {
    const row = w.addStack()
    const left = row.addStack()
    left.layoutVertically()
    left.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 80)).imageSize = new Size(72, 72)
    left.addSpacer(4)
    text(left, `Prognose ${pct(data.gesamt.prognose)}`, Font.semiboldSystemFont(11), C.muted)
    row.addSpacer(12)
    const right = row.addStack()
    right.layoutVertically()
    todayLine(right, data, false)
    right.addSpacer(8)
    for (const e of data.pruefungen.slice(0, 2)) {
      examRow(right, e, 170)
      right.addSpacer(6)
    }
    return w
  }

  // groß
  const row = w.addStack()
  row.centerAlignContent()
  row.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 96)).imageSize = new Size(86, 86)
  row.addSpacer(14)
  const col = row.addStack()
  col.layoutVertically()
  todayLine(col, data, false)
  col.addSpacer(4)
  text(col, `Begonnen ${pct(data.gesamt.begonnen)} · Prognose ${pct(data.gesamt.prognose)}`, Font.systemFont(12), C.muted)
  w.addSpacer(12)
  for (const e of data.pruefungen.slice(0, 6)) {
    examRow(w, e, 300)
    w.addSpacer(8)
  }
  w.addSpacer()
  text(w, `Stand ${new Date(data.stand).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}`, Font.systemFont(10), C.muted)
  return w
}

function errorWidget(message) {
  const w = new ListWidget()
  w.backgroundColor = C.bg2
  w.url = APP_URL
  text(w, 'Lernapp', Font.semiboldSystemFont(13), C.muted)
  w.addSpacer(6)
  text(w, message, Font.systemFont(13))
  return w
}

let widget
try {
  const data = await loadProgress()
  widget = build(data, config.widgetFamily || 'medium')
} catch (e) {
  widget = errorWidget('Fortschritt.json nicht gefunden – File Bookmark „Lernapp-Fortschritt“ und Dropbox-Sync prüfen.')
}

if (config.runsInWidget) Script.setWidget(widget)
else await widget.presentMedium()
Script.complete()
