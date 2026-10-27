import { useMemo } from 'react'
import { renderRich, type ClozeSide } from '../lib/render'

export function Rich({ text, cloze = 'none' }: { text: string; cloze?: ClozeSide }) {
  const html = useMemo(() => renderRich(text, cloze), [text, cloze])
  return <div className="content" dangerouslySetInnerHTML={{ __html: html }} />
}
