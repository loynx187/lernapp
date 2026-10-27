// Lernapp-Widget für Scriptable (https://scriptable.app)
//
// Zeigt den Lernfortschritt aus Fortschritt.json, die die Lernapp bei jedem
// Dropbox-Abgleich in ihren App-Ordner schreibt.
// Einrichtung: Scriptable → Einstellungen → File Bookmarks → „+“ → Pick File →
// Dropbox → Apps → (App-Ordner) → Fortschritt.json, Name: Lernapp-Fortschritt
//
// Hintergrund: Widget bearbeiten → Parameter „weiß“ (Standard) oder „schwarz“.
// Größen: klein, mittel, groß sowie Sperrbildschirm (rund und rechteckig).

const BOOKMARK = 'Lernapp-Fortschritt'
const APP_URL = 'https://loynx187.github.io/lernapp/'

const THEMES = {
  weiß: { bg: '#FFFFFF', text: '#1C1C1E', muted: '#8E8E93', track: '#E5E5EA', outer: '#0A84FF', inner: '#34C759', warn: '#FF9500' },
  schwarz: { bg: '#000000', text: '#FFFFFF', muted: '#8E8E93', track: '#2C2C2E', outer: '#0A84FF', inner: '#30D158', warn: '#FF9F0A' },
}
let C

function useTheme(param) {
  const p = (param || '').trim().toLowerCase()
  const name = ['schwarz', 'dunkel', 'black', 'dark'].includes(p) ? 'schwarz' : 'weiß'
  C = {}
  for (const [k, v] of Object.entries(THEMES[name])) C[k] = new Color(v)
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
const days = (n) => (n === 0 ? 'heute' : n === 1 ? 'morgen' : `in ${n} T.`)

/** Zwei dünne Ringe wie in der Lernapp: außen begonnen, innen Prognose. */
function rings(outer, inner, size, colors = {}) {
  const { outerColor = C.outer, innerColor = C.inner, track = C.track } = colors
  const dc = new DrawContext()
  dc.size = new Size(size, size)
  dc.opaque = false
  dc.respectScreenScale = true
  const w = size * 0.08
  const arc = (radius, value, color) => {
    const c = size / 2
    dc.setLineWidth(w)
    dc.setStrokeColor(track)
    dc.strokeEllipse(new Rect(c - radius, c - radius, radius * 2, radius * 2))
    const v = Math.min(1, value || 0)
    if (v < 0.005) return
    const steps = Math.max(2, Math.round(120 * v))
    const path = new Path()
    for (let i = 0; i <= steps; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * v * i) / steps
      const p = new Point(c + radius * Math.cos(a), c + radius * Math.sin(a))
      if (i === 0) path.move(p)
      else path.addLine(p)
    }
    dc.addPath(path)
    dc.setStrokeColor(color)
    dc.strokePath()
  }
  arc(size / 2 - w, outer, outerColor)
  arc(size / 2 - w * 2.6, inner, innerColor)
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
  fill.addRoundedRect(new Rect(0, 0, Math.max(height, width * Math.min(1, value || 0)), height), r, r)
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
  t.minimumScaleFactor = 0.7
  return t
}

function todayLabel(data) {
  const h = data.heute
  const parts = []
  if (h.karten) parts.push(`${h.karten} Karten`)
  if (h.aufgaben) parts.push(`${h.aufgaben} ${h.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}`)
  return parts.length ? { main: parts.join(' · '), sub: h.minuten ? `ca. ${h.minuten} min` : '' } : { main: 'Heute erledigt', sub: '' }
}

function examLine(stack, e, width) {
  const row = stack.addStack()
  row.layoutVertically()
  const top = row.addStack()
  top.centerAlignContent()
  const dot = top.addText('●')
  dot.font = Font.systemFont(8)
  dot.textColor = new Color(e.farbe)
  top.addSpacer(5)
  text(top, e.name, Font.systemFont(13))
  top.addSpacer()
  text(top, days(e.tage), Font.systemFont(12), e.rueckstand ? C.warn : C.muted)
  if (width) {
    row.addSpacer(4)
    row.addImage(bar(e.begonnen, width, 3, new Color(e.farbe))).imageSize = new Size(width, 3)
  }
}

function build(data, family) {
  const w = new ListWidget()
  w.url = APP_URL
  const stale = Date.now() - new Date(data.stand).getTime() > 36 * 3600 * 1000
  const next = data.pruefungen[0]
  const today = todayLabel(data)

  // Sperrbildschirm
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true
    const white = Color.white()
    w.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 60, { outerColor: white, innerColor: white, track: new Color('#ffffff', 0.3) })).imageSize = new Size(52, 52)
    return w
  }
  if (family === 'accessoryRectangular') {
    const white = Color.white()
    text(w, next ? `${next.name} ${days(next.tage)}` : 'Lernapp', Font.semiboldSystemFont(13), white)
    text(w, today.sub ? `${today.main} · ${today.sub}` : today.main, Font.systemFont(12), white)
    text(w, `Prognose ${pct(data.gesamt.prognose)}`, Font.systemFont(12), white)
    return w
  }

  w.backgroundColor = C.bg
  w.setPadding(16, 16, 16, 16)

  if (family === 'small') {
    w.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 48)).imageSize = new Size(44, 44)
    w.addSpacer()
    text(w, pct(data.gesamt.prognose), Font.semiboldSystemFont(22))
    text(w, stale ? 'Prognose · veraltet' : 'Prognose', Font.systemFont(11), stale ? C.warn : C.muted)
    w.addSpacer(6)
    text(w, today.main, Font.systemFont(12))
    return w
  }

  if (family === 'medium') {
    const row = w.addStack()
    row.centerAlignContent()
    const left = row.addStack()
    left.layoutVertically()
    left.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 72)).imageSize = new Size(64, 64)
    left.addSpacer(6)
    text(left, pct(data.gesamt.prognose), Font.semiboldSystemFont(15))
    text(left, 'Prognose', Font.systemFont(11), C.muted)
    row.addSpacer(18)
    const right = row.addStack()
    right.layoutVertically()
    text(right, today.main, Font.semiboldSystemFont(14))
    if (today.sub) text(right, today.sub, Font.systemFont(12), C.muted)
    right.addSpacer(10)
    for (const e of data.pruefungen.slice(0, 2)) {
      examLine(right, e)
      right.addSpacer(4)
    }
    if (stale) text(right, 'Stand veraltet', Font.systemFont(11), C.warn)
    return w
  }

  // groß
  const row = w.addStack()
  row.centerAlignContent()
  row.addImage(rings(data.gesamt.begonnen, data.gesamt.prognose, 72)).imageSize = new Size(64, 64)
  row.addSpacer(16)
  const col = row.addStack()
  col.layoutVertically()
  text(col, today.main, Font.semiboldSystemFont(15))
  text(col, `${today.sub ? today.sub + ' · ' : ''}Prognose ${pct(data.gesamt.prognose)}`, Font.systemFont(12), C.muted)
  w.addSpacer(18)
  for (const e of data.pruefungen.slice(0, 6)) {
    examLine(w, e, 290)
    w.addSpacer(12)
  }
  w.addSpacer()
  const stand = new Date(data.stand).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
  text(w, `Stand ${stand}${data.serie > 0 ? ` · Serie ${data.serie} T.` : ''}`, Font.systemFont(10), stale ? C.warn : C.muted)
  return w
}

function errorWidget(message) {
  const w = new ListWidget()
  w.backgroundColor = C.bg
  w.url = APP_URL
  w.setPadding(16, 16, 16, 16)
  text(w, 'Lernapp', Font.semiboldSystemFont(13), C.muted)
  w.addSpacer(6)
  const t = text(w, message, Font.systemFont(12))
  t.lineLimit = 0
  return w
}

async function makeWidget(family, param) {
  useTheme(param)
  try {
    return build(await loadProgress(), family)
  } catch (e) {
    return errorWidget('Fortschritt.json nicht gefunden – File Bookmark „Lernapp-Fortschritt“ und Dropbox-Sync prüfen.')
  }
}

async function choose(title, options) {
  const a = new Alert()
  a.title = title
  for (const o of options) a.addAction(o)
  a.addCancelAction('Abbrechen')
  const i = await a.presentSheet()
  return i === -1 ? null : i
}

if (config.runsInWidget) {
  Script.setWidget(await makeWidget(config.widgetFamily || 'medium', args.widgetParameter))
} else {
  // Vorschau beim Start in Scriptable
  const size = await choose('Vorschau', ['Klein', 'Mittel', 'Groß'])
  const color = size == null ? null : await choose('Hintergrund', ['Weiß', 'Schwarz'])
  if (color != null) {
    const family = ['small', 'medium', 'large'][size]
    const widget = await makeWidget(family, color === 1 ? 'schwarz' : 'weiß')
    if (family === 'small') await widget.presentSmall()
    else if (family === 'large') await widget.presentLarge()
    else await widget.presentMedium()
  }
}
Script.complete()
