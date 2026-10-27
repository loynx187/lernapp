import { db, type StudyCard } from './db'

/**
 * Löscht eine Karte aus dem Lernplan. Sie wird nur archiviert und markiert, damit
 * Paket-Updates sie nicht zurückbringen; Lernfortschritt und Bewertungen bleiben erhalten,
 * die Karte lässt sich auf der Prüfungsseite wiederherstellen. Über `updatedAt` erreicht
 * die Löschung bei der Synchronisation auch die anderen Geräte.
 */
export async function deleteCard(card: Pick<StudyCard, 'id'>, now = Date.now()) {
  await db.cards.update(card.id, { archived: 1, deletedAt: now })
}

export async function restoreCard(card: Pick<StudyCard, 'id'>) {
  await db.cards.update(card.id, { archived: 0, deletedAt: undefined })
}

/** Gelöschte Karten einer Prüfung, zuletzt gelöschte zuerst. */
export async function deletedCards(examId: string) {
  const cards = await db.cards.where('[examId+archived]').equals([examId, 1]).filter((c) => !!c.deletedAt).toArray()
  return cards.sort((a, b) => b.deletedAt! - a.deletedAt!)
}
