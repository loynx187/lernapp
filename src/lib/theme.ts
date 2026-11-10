/**
 * Darstellung (Einstellungen → Darstellung): Design und Hell/Dunkel. Gilt je Gerät (localStorage), damit sie schon
 * vor dem Laden der Daten greift – index.html setzt dieselben Attribute beim Start, bevor etwas gezeichnet wird.
 */
export type Theme = 'standard' | 'papier' | 'graphit'
export type Appearance = 'auto' | 'light' | 'dark'
export interface Display {
  theme: Theme
  appearance: Appearance
}

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: 'standard', label: 'Standard', hint: 'Glas und farbiger Hintergrund' },
  { value: 'papier', label: 'Papier', hint: 'Warmes Off-White, ohne Farbe' },
  { value: 'graphit', label: 'Graphit', hint: 'Schwarz-Weiß, dunkel echtes Schwarz' },
]
export const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

const KEY = 'lernapp-darstellung'
const DEFAULT: Display = { theme: 'standard', appearance: 'auto' }

export function loadDisplay(): Display {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Display> | null
    return {
      theme: THEMES.some((t) => t.value === v?.theme) ? v!.theme! : DEFAULT.theme,
      appearance: APPEARANCES.some((a) => a.value === v?.appearance) ? v!.appearance! : DEFAULT.appearance,
    }
  } catch {
    return DEFAULT
  }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches

export function applyDisplay(d: Display) {
  const root = document.documentElement
  root.dataset.theme = d.theme
  root.dataset.scheme = d.appearance === 'auto' ? (systemDark() ? 'dark' : 'light') : d.appearance
  // Statusleiste und Ränder in der Hintergrundfarbe des Designs
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (bg) for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) m.content = bg
}

export function saveDisplay(d: Display) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
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
