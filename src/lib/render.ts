import katex from 'katex'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

const MATH = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g
const CLOZE = /\{\{(?:c\d+::)?([\s\S]+?)\}\}/g

export type ClozeSide = 'front' | 'back' | 'none'

/**
 * Wandelt Karteninhalt in sicheres HTML um: Markdown, Formeln in $…$ / $$…$$ (KaTeX)
 * und Lückentext-Markierungen {{…}}.
 */
export function renderRich(text: string, cloze: ClozeSide = 'none'): string {
  const math: string[] = []
  let src = text.replace(MATH, (_m, block1, block2, inline1, inline2) => {
    const display = block1 !== undefined || block2 !== undefined
    const tex = block1 ?? block2 ?? inline1 ?? inline2
    let html: string
    try {
      html = katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, output: 'html' })
    } catch {
      html = `<code>${tex}</code>`
    }
    math.push(html)
    return `%%M${math.length - 1}%%`
  })
  if (cloze !== 'none') {
    src = src.replace(CLOZE, (_m, inner) =>
      cloze === 'front' ? '<span class="cloze">[ … ]</span>' : `<span class="cloze-fill">${inner}</span>`,
    )
  }
  let html = marked.parse(src, { async: false }) as string
  html = html.replace(/%%M(\d+)%%/g, (_m, i) => math[Number(i)])
  return DOMPurify.sanitize(html)
}
