/**
 * Darstellung (Einstellungen → Darstellung): Design, Hell/Dunkel und – beim Design „Bagel“ – Farbpalette, eigene
 * Farben und Kritzeleien. Gilt je Gerät (localStorage), damit sie schon vor dem Laden der Daten greift: index.html
 * setzt die gespeicherten Attribute und Farben beim Start, bevor etwas gezeichnet wird.
 */
export type Theme = 'standard' | 'papier' | 'graphit' | 'bagel'
export type Appearance = 'auto' | 'light' | 'dark'
export type PaletteId = 'kobalt' | 'tomate' | 'salbei' | 'eigene'

/** Die vier frei wählbaren Grundfarben; alles Weitere (Nebentext, Rahmen, Flächen) wird daraus gemischt. */
export interface Colors {
  bg: string
  tile: string
  ink: string
  accent: string
}

export interface Display {
  theme: Theme
  appearance: Appearance
  palette: PaletteId
  colors: Colors
  doodles: boolean
}

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Glas und farbiger Hintergrund' },
  { value: 'papier', label: 'Papier', hint: 'Warmes Off-White, ohne Farbe' },
  { value: 'graphit', label: 'Graphit', hint: 'Schwarz-Weiß, dunkel echtes Schwarz' },
  { value: 'bagel', label: 'Bagel', hint: 'Feste Kacheln, Bagel-Überschriften, Farben und Kritzeleien wählbar' },
]
export const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

/** Paletten für „Bagel“, je mit heller und dunkler Fassung. */
export const PALETTES: { value: Exclude<PaletteId, 'eigene'>; label: string; light: Colors; dark: Colors }[] = [
  {
    value: 'kobalt',
    label: 'Kobalt',
    light: { bg: '#f3ebde', tile: '#fffaf2', ink: '#1b1b1b', accent: '#1f3fbf' },
    dark: { bg: '#121212', tile: '#1d1d1c', ink: '#f6efe4', accent: '#8fa8ff' },
  },
  {
    value: 'tomate',
    label: 'Tomate',
    light: { bg: '#f2eadf', tile: '#fffaf3', ink: '#1f1a17', accent: '#c8402a' },
    dark: { bg: '#1a1614', tile: '#24201d', ink: '#f4ede2', accent: '#f0795d' },
  },
  {
    value: 'salbei',
    label: 'Salbei',
    light: { bg: '#eef1ea', tile: '#fbfcf8', ink: '#1e2621', accent: '#4a6e5c' },
    dark: { bg: '#151a17', tile: '#1d231f', ink: '#e7ece8', accent: '#8fb8a3' },
  },
]

const KEY = 'lernapp-darstellung'
const DEFAULT: Display = { theme: 'standard', appearance: 'auto', palette: 'kobalt', colors: PALETTES[0].light, doodles: true }
const HEX = /^#[0-9a-f]{6}$/i

function validColors(c: Partial<Colors> | undefined): Colors {
  const pick = (k: keyof Colors) => (c && HEX.test(c[k] ?? '') ? c[k]! : DEFAULT.colors[k])
  return { bg: pick('bg'), tile: pick('tile'), ink: pick('ink'), accent: pick('accent') }
}

export function loadDisplay(): Display {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Display> | null
    return {
      theme: THEMES.some((t) => t.value === v?.theme) ? v!.theme! : DEFAULT.theme,
      appearance: APPEARANCES.some((a) => a.value === v?.appearance) ? v!.appearance! : DEFAULT.appearance,
      palette: v?.palette === 'eigene' || PALETTES.some((p) => p.value === v?.palette) ? v!.palette! : DEFAULT.palette,
      colors: validColors(v?.colors),
      doodles: v?.doodles !== false,
    }
  } catch {
    return DEFAULT
  }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

/** Relative Leuchtdichte nach WCAG. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhältnis nach WCAG (1 … 21). */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Lesbare Schriftfarbe auf einem Hintergrund: fast Schwarz oder fast Weiß. */
export const readableOn = (bg: string) => (contrast('#1b1b1b', bg) >= contrast('#f6f3ee', bg) ? '#1b1b1b' : '#f6f3ee')

/** Hinweise zur Lesbarkeit eigener Farben (Text mindestens 4,5 : 1, Akzent mindestens 3 : 1 nach WCAG). */
export function colorWarnings(c: Colors): string[] {
  const out: string[] = []
  if (contrast(c.ink, c.tile) < 4.5) out.push('Die Schrift ist auf den Kacheln schlecht lesbar.')
  if (contrast(c.ink, c.bg) < 4.5) out.push('Die Schrift ist auf dem Hintergrund schlecht lesbar.')
  if (contrast(c.accent, c.tile) < 3) out.push('Icons und Buttons heben sich kaum von den Kacheln ab.')
  return out
}

/** Farben, die beim Design „Bagel“ gelten – abhängig von Hell/Dunkel (bei „Automatisch“ vom System). */
export function activeColors(d: Display, systemIsDark = systemDark()): Colors {
  if (d.palette === 'eigene') return d.colors
  const dark = d.appearance === 'dark' || (d.appearance === 'auto' && systemIsDark)
  const p = PALETTES.find((x) => x.value === d.palette) ?? PALETTES[0]
  return dark ? p.dark : p.light
}

interface Resolved {
  scheme: 'light' | 'dark'
  doodles?: 'on' | 'off'
  vars: Record<string, string>
}

/** Attribute und Farbvariablen für das Wurzelelement; index.html wendet die gespeicherte Fassung beim Start an. */
export function resolveDisplay(d: Display, systemIsDark = systemDark()): Resolved {
  if (d.theme !== 'bagel') return { scheme: d.appearance === 'auto' ? (systemIsDark ? 'dark' : 'light') : d.appearance, vars: {} }
  const c = activeColors(d, systemIsDark)
  return {
    scheme: luminance(c.bg) < 0.2 ? 'dark' : 'light',
    doodles: d.doodles ? 'on' : 'off',
    vars: { '--k-bg': c.bg, '--k-tile': c.tile, '--k-ink': c.ink, '--k-accent': c.accent, '--k-on-accent': readableOn(c.accent) },
  }
}

const VARS = ['--k-bg', '--k-tile', '--k-ink', '--k-accent', '--k-on-accent']

export function applyDisplay(d: Display) {
  const root = document.documentElement
  const r = resolveDisplay(d)
  root.dataset.theme = d.theme
  root.dataset.scheme = r.scheme
  if (r.doodles) root.dataset.doodles = r.doodles
  else delete root.dataset.doodles
  for (const v of VARS) root.style.removeProperty(v)
  for (const [k, v] of Object.entries(r.vars)) root.style.setProperty(k, v)
  // Statusleiste und Ränder in der Hintergrundfarbe des Designs
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (bg) for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = bg
}

export function saveDisplay(d: Display) {
  try {
    // `boot`: fertig aufgelöste Fassung für hell und dunkel – index.html braucht so keine eigene Logik.
    localStorage.setItem(KEY, JSON.stringify({ ...d, boot: { light: resolveDisplay(d, false), dark: resolveDisplay(d, true) } }))
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
  applyDisplay(d)
}

/** Beim Start: gespeicherte Darstellung anwenden und bei „Automatisch“ dem System folgen. */
export function initDisplay() {
  applyDisplay(loadDisplay())
  if (typeof matchMedia === 'function') matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyDisplay(loadDisplay()))
}
