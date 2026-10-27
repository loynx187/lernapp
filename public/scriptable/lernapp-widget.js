// Lernapp-Widget für Scriptable (https://scriptable.app)
//
// Zeigt den Lernfortschritt aus Fortschritt.json, die die Lernapp bei jedem
// Dropbox-Abgleich in ihren App-Ordner schreibt.
// Einrichtung: Scriptable → Einstellungen → File Bookmarks → „+“ → Pick File →
// Dropbox → Apps → (App-Ordner) → Fortschritt.json, Name: Lernapp-Fortschritt
//
// Größen: klein, mittel, groß sowie Sperrbildschirm (rund und rechteckig).
//
// Transparenter Hintergrund: Skript in Scriptable starten → „Transparenten
// Hintergrund einrichten“. iOS kennt keine echt durchsichtigen Widgets – das
// Skript schneidet den passenden Ausschnitt aus einem Screenshot des leeren
// Homescreens aus. Die Position (z. B. „oben links“) kommt danach als
// Parameter ins Widget.

const BOOKMARK = 'Lernapp-Fortschritt'
const APP_URL = 'https://loynx187.github.io/lernapp/'
const DIM = 0 // 0 … 0.5: transparenten Hintergrund für bessere Lesbarkeit abdunkeln
const BG_DIR = 'Lernapp-Hintergrund'

// Widget-Positionen auf dem iPhone-Homescreen in Pixeln, je Screenshot-Höhe.
const PHONES = {
  2796: { small: 510, medium: 1092, large: 1146, left: 99, right: 681, top: 282, middle: 918, bottom: 1554 }, // 14/15 Pro Max, 15 Plus
  2778: { small: 510, medium: 1092, large: 1146, left: 96, right: 678, top: 246, middle: 882, bottom: 1518 }, // 12/13 Pro Max, 14 Plus
  2688: { small: 507, medium: 1080, large: 1137, left: 81, right: 654, top: 228, middle: 858, bottom: 1488 }, // XS Max, 11 Pro Max
  2556: { small: 474, medium: 1017, large: 1062, left: 81, right: 624, top: 270, middle: 858, bottom: 1446 }, // 14 Pro, 15, 15 Pro
  2532: { small: 474, medium: 1014, large: 1062, left: 78, right: 618, top: 231, middle: 819, bottom: 1407 }, // 12, 13, 14, 16e
  2436: { small: 465, medium: 987, large: 1035, left: 69, right: 591, top: 213, middle: 783, bottom: 1353 }, // X, XS, 11 Pro
  2340: { small: 436, medium: 936, large: 980, left: 72, right: 570, top: 212, middle: 756, bottom: 1300 }, // 12/13 mini
  2208: { small: 471, medium: 1044, large: 1071, left: 99, right: 672, top: 114, middle: 696, bottom: 1278 }, // 6–8 Plus
  1792: { small: 338, medium: 720, large: 758, left: 54, right: 436, top: 160, middle: 580, bottom: 1000 }, // XR, 11
  1334: { small: 296, medium: 642, large: 648, left: 54, right: 400, top: 60, middle: 412, bottom: 764 }, // SE 2/3, 6–8
}
const FAMILIES = ['small', 'medium', 'large']
const SIZE_LABEL = { small: 'Klein', medium: 'Mittel', large: 'Groß' }
const POSITIONS = {
  small: ['oben links', 'oben rechts', 'mitte links', 'mitte rechts', 'unten links', 'unten rechts'],
  medium: ['oben', 'mitte', 'unten'],
  large: ['oben', 'unten'],
}
let shadow = false

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
  if (shadow) {
    t.shadowColor = new Color('#000000', 0.45)
    t.shadowRadius = 3
    t.shadowOffset = new Point(0, 1)
  }
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

function build(data, family, background) {
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

  if (background) {
    w.backgroundImage = dim(background)
    shadow = true
  } else {
    const g = new LinearGradient()
    g.colors = [C.bg1, C.bg2]
    g.locations = [0, 1]
    w.backgroundGradient = g
  }
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

// ---------- Transparenter Hintergrund ----------

function bgStore() {
  let fm
  try {
    fm = FileManager.iCloud()
    fm.documentsDirectory()
  } catch (e) {
    fm = FileManager.local()
  }
  const dir = fm.joinPath(fm.documentsDirectory(), BG_DIR)
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true)
  return { fm, dir }
}

function bgPath(family, position) {
  const { fm, dir } = bgStore()
  const slug = position.trim().toLowerCase().replace(/\s+/g, '-')
  return { fm, path: fm.joinPath(dir, `${family}-${slug}.jpg`) }
}

async function loadBackground(family, position) {
  if (!position || !FAMILIES.includes(family)) return null
  const { fm, path } = bgPath(family, position)
  if (!fm.fileExists(path)) return null
  try {
    await fm.downloadFileFromiCloud(path)
  } catch (e) {
    // lokal gespeichert
  }
  return fm.readImage(path)
}

function dim(img) {
  if (!DIM) return img
  const dc = new DrawContext()
  dc.size = img.size
  dc.respectScreenScale = false
  dc.drawImageAtPoint(img, new Point(0, 0))
  dc.setFillColor(new Color('#000000', DIM))
  dc.fillRect(new Rect(0, 0, img.size.width, img.size.height))
  return dc.getImage()
}

/** Positionstabelle zur Screenshot-Höhe; unbekannte Modelle werden vom nächsten bekannten hochgerechnet. */
function phoneLayout(height) {
  if (PHONES[height]) return { layout: PHONES[height], approx: false }
  const ref = Object.keys(PHONES).map(Number).reduce((a, b) => (Math.abs(b - height) < Math.abs(a - height) ? b : a))
  const f = height / ref
  const layout = {}
  for (const [k, v] of Object.entries(PHONES[ref])) layout[k] = Math.round(v * f)
  return { layout, approx: true }
}

function cropRect(p, family, position) {
  const [row, col] = position.split(' ')
  const y = { oben: p.top, mitte: p.middle, unten: family === 'large' ? p.middle : p.bottom }[row]
  const x = family === 'small' && col === 'rechts' ? p.right : p.left
  return new Rect(x, y, family === 'small' ? p.small : p.medium, family === 'large' ? p.large : p.small)
}

function crop(img, rect) {
  const dc = new DrawContext()
  dc.size = new Size(rect.width, rect.height)
  dc.respectScreenScale = false
  dc.drawImageAtPoint(img, new Point(-rect.x, -rect.y))
  return dc.getImage()
}

async function choose(title, message, options) {
  const a = new Alert()
  a.title = title
  if (message) a.message = message
  for (const o of options) a.addAction(o)
  a.addCancelAction('Abbrechen')
  const i = await a.presentSheet()
  return i === -1 ? null : i
}

async function notice(title, message) {
  const a = new Alert()
  a.title = title
  a.message = message
  a.addAction('OK')
  await a.present()
}

async function setupBackground() {
  const start = await choose(
    'Transparenter Hintergrund',
    'iOS erlaubt keine echt durchsichtigen Widgets. Das Skript schneidet deshalb den passenden Ausschnitt aus einem Screenshot deines Homescreens aus.\n\n' +
      'Vorher: Lange auf den Homescreen drücken, bis die Symbole wackeln, ganz nach rechts auf die leere Seite wischen und dort einen Screenshot machen.',
    ['Screenshot auswählen'],
  )
  if (start == null) return
  let img
  try {
    img = await Photos.fromLibrary()
  } catch (e) {
    return
  }
  const { width, height } = img.size
  if (height / width < 1.6) {
    await notice('Nicht unterstützt', 'Bitte einen Screenshot vom iPhone im Hochformat wählen. Auf dem iPad sind die Widget-Positionen nicht einheitlich.')
    return
  }
  const { layout, approx } = phoneLayout(height)
  const fi = await choose('Widget-Größe', null, FAMILIES.map((f) => SIZE_LABEL[f]))
  if (fi == null) return
  const family = FAMILIES[fi]
  const pi = await choose('Position', 'Wo steht das Widget auf dem Homescreen?', POSITIONS[family])
  if (pi == null) return
  const position = POSITIONS[family][pi]
  const { fm, path } = bgPath(family, position)
  fm.writeImage(path, crop(img, cropRect(layout, family, position)))
  await notice(
    'Fertig',
    `Lange auf das Widget drücken → „Widget bearbeiten“ → bei „Parameter“ eingeben:\n\n${position}\n\n` +
      'Für weitere Widgets (andere Größe oder Position) die Einrichtung wiederholen. Nach einem neuen Hintergrundbild ebenfalls.' +
      (approx ? '\n\nHinweis: Dein iPhone-Modell ist nicht hinterlegt – der Ausschnitt ist geschätzt und kann leicht versetzt sein.' : ''),
  )
}

async function preview() {
  const fi = await choose('Vorschau', 'Welche Größe?', FAMILIES.map((f) => SIZE_LABEL[f]))
  if (fi == null) return
  const family = FAMILIES[fi]
  const saved = POSITIONS[family].filter((p) => {
    const { fm, path } = bgPath(family, p)
    return fm.fileExists(path)
  })
  let position = null
  if (saved.length) {
    const pi = await choose('Hintergrund', null, ['Blauer Verlauf', ...saved])
    if (pi == null) return
    position = pi === 0 ? null : saved[pi - 1]
  }
  const widget = await makeWidget(family, position)
  if (family === 'small') await widget.presentSmall()
  else if (family === 'large') await widget.presentLarge()
  else await widget.presentMedium()
}

function removeBackgrounds() {
  const { fm, dir } = bgStore()
  for (const f of fm.listContents(dir)) fm.remove(fm.joinPath(dir, f))
}

// ---------- Start ----------

async function makeWidget(family, position) {
  try {
    const data = await loadProgress()
    return build(data, family, await loadBackground(family, position))
  } catch (e) {
    return errorWidget('Fortschritt.json nicht gefunden – File Bookmark „Lernapp-Fortschritt“ und Dropbox-Sync prüfen.')
  }
}

if (config.runsInWidget) {
  Script.setWidget(await makeWidget(config.widgetFamily || 'medium', args.widgetParameter))
} else {
  const i = await choose('Lernapp-Widget', null, ['Vorschau', 'Transparenten Hintergrund einrichten', 'Hintergründe löschen'])
  if (i === 0) await preview()
  if (i === 1) await setupBackground()
  if (i === 2) {
    removeBackgrounds()
    await notice('Gelöscht', 'Die Widgets zeigen wieder den blauen Verlauf.')
  }
}
Script.complete()
