import { useState } from 'react'
import { PageHeader } from '../components/ui'

/** Kopiert das Scriptable-Skript in die Zwischenablage (Datei liegt unter public/scriptable). */
function CopyWidgetScript() {
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle')
  async function copy() {
    try {
      const code = await (await fetch('scriptable/lernapp-widget.js')).text()
      await navigator.clipboard.writeText(code)
      setState('ok')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="stack">
      <button className="btn primary block" onClick={copy}>
        {state === 'ok' ? 'Skript kopiert ✓' : 'Widget-Skript kopieren'}
      </button>
      {state === 'error' && (
        <small>
          Kopieren nicht möglich – Skript stattdessen <a href="scriptable/lernapp-widget.js" target="_blank" rel="noreferrer">hier öffnen</a> und markieren.
        </small>
      )}
    </div>
  )
}

export function Help() {
  return (
    <>
      <PageHeader back title="Hilfe" />

      <div className="card stack">
        <details open>
          <summary>Auf dem Homescreen installieren</summary>
          <p style={{ marginTop: 8 }}><b>iPhone / iPad:</b> Seite in Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.</p>
          <p><b>Android:</b> Seite in Chrome öffnen → Menü ⋮ → „App installieren“.</p>
          <p className="muted">Danach startet die App wie eine normale App, funktioniert offline und deine Daten bleiben dauerhaft gespeichert.</p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Zwischen Geräten synchronisieren</summary>
          <ol className="help" style={{ marginTop: 8 }}>
            <li>Auf dem ersten Gerät: Einstellungen → Synchronisation → „Mit Dropbox verbinden“ und bei Dropbox anmelden.</li>
            <li>Auf dem zweiten Gerät die App öffnen und beim ersten Start „Profil von einem anderen Gerät laden (Dropbox)“ wählen.</li>
          </ol>
          <p className="muted">Danach gleicht die App automatisch ab: beim Öffnen, nach dem Lernen und alle paar Minuten. Lernst du auf beiden Geräten offline, werden die Stände beim nächsten Abgleich zusammengeführt. Die App sieht nur ihren eigenen Ordner in deiner Dropbox.</p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Widget für den Homescreen</summary>
          <p style={{ marginTop: 8 }}>
            Mit der kostenlosen App <b>Scriptable</b> zeigt ein Widget deinen Fortschritt: Ringe (begonnen/Prognose), heutiges Pensum, Lernserie und deine Prüfungen mit Countdown – klein, mittel, groß oder auf dem Sperrbildschirm. Voraussetzung: Dropbox-Sync ist verbunden und die Dropbox-App ist in der Dateien-App aktiviert.
          </p>
          <ol className="help">
            <li>Scriptable aus dem App Store installieren.</li>
            <li>In Scriptable: Einstellungen (Zahnrad) → „File Bookmarks“ → „+“ → „Pick File“ → Dropbox → Apps → (App-Ordner) → <code>Fortschritt.json</code>. Als Namen genau <code>Lernapp-Fortschritt</code> eingeben.</li>
            <li>Unten auf „Widget-Skript kopieren“ tippen. In Scriptable „+“ → Code einfügen → oben als Namen „Lernapp“ eintragen → Fertig.</li>
            <li>Lange auf den Homescreen drücken → „+“ → Scriptable → Größe wählen → Widget hinzufügen. Dann lange auf das Widget drücken → „Widget bearbeiten“ → Script: „Lernapp“.</li>
          </ol>
          <CopyWidgetScript />
          <p style={{ marginTop: 10 }}>
            <b>Hintergrund:</b> Standard ist Weiß. Für Schwarz lange auf das Widget drücken → „Widget bearbeiten“ → bei „Parameter“ <code>schwarz</code> eintragen. Tippst du das Skript in Scriptable an, zeigt es eine Vorschau.
          </p>
          <p className="muted">
            Das Widget zeigt den Stand des letzten Abgleichs; iOS aktualisiert Widgets etwa alle 15–60 Minuten. Ein ⚠︎ erscheint, wenn der Stand älter als 36 Stunden ist. Ein Tipp aufs Widget öffnet die Lernapp.
          </p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Tägliche Erinnerung einrichten</summary>
          <p style={{ marginTop: 8 }}>Die App kommt ohne Server aus und kann deshalb selbst keine Mitteilungen schicken. So bekommst du trotzdem eine Erinnerung:</p>
          <p><b>iPhone mit Tagesplan (Dropbox-Sync nötig):</b> Bei jedem Abgleich legt die App die Datei <code>Erinnerung.txt</code> in ihrem Dropbox-Ordner ab, z. B. „Lernplan Mittwoch: Unterwegs 34 Karten · ca. 15 min“. Ein Kurzbefehl zeigt sie täglich als Mitteilung an:</p>
          <ol className="help">
            <li>Dropbox-App installieren und in der Dateien-App unter „Durchsuchen“ → „…“ → „Bearbeiten“ Dropbox aktivieren.</li>
            <li>Kurzbefehle-App → „Automation“ → „+“ → „Tageszeit“ → Uhrzeit wählen, „Täglich“, „Sofort ausführen“.</li>
            <li>Aktion „Datei abrufen“ hinzufügen, „Dokumentauswahl anzeigen“ ausschalten und die Datei <i>Dropbox → Apps → (App-Ordner) → Erinnerung.txt</i> wählen.</li>
            <li>Aktion „Mitteilung anzeigen“ hinzufügen und als Text die „Datei“ aus dem vorigen Schritt einsetzen.</li>
          </ol>
          <p><b>iPhone ohne Dropbox – Erinnerungen-App:</b> Neue Erinnerung „Lernen“ anlegen, über ⓘ Datum und Uhrzeit aktivieren, „Wiederholen“ → „Täglich“.</p>
          <p><b>Android:</b> In der Uhr-App einen täglichen Wecker oder im Kalender einen täglichen Termin mit Benachrichtigung anlegen.</p>
          <p className="muted">Was du heute lernen solltest, berechnet die App beim Öffnen automatisch neu – auch wenn du einen Tag ausgelassen hast.</p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>So funktioniert der Lernplan</summary>
          <ul className="help" style={{ marginTop: 8 }}>
            <li><b>Abrufen statt Lesen:</b> Jede Karte fragt dich aktiv ab – das verankert Wissen nachweislich besser als Wiederlesen.</li>
            <li><b>Verteilte Wiederholung (FSRS):</b> Für jede Karte wird geschätzt, wann du sie vergessen würdest. Sie kommt kurz vorher wieder dran.</li>
            <li><b>Rückwärts vom Klausurtermin:</b> Neuer Stoff wird gleichmäßig verteilt, sodass er einige Tage vor der Klausur komplett begonnen ist. Danach wird nur noch gefestigt, und jede Karte kommt in den letzten Tagen vor der Klausur noch einmal dran.</li>
            <li><b>Gemischt üben:</b> Karten verschiedener Fächer und Kapitel werden abwechselnd abgefragt.</li>
            <li><b>Semesterart:</b> Im dualen Semester (alle Klausuren in einer Woche) muss neuer Stoff aller Fächer bis vor Beginn der Prüfungsphase sitzen – mit längerem Wiederholungspuffer. Im regulären Semester hat jedes Fach seinen eigenen Zeitplan bis zu seiner Klausur. Einstellbar pro Semester.</li>
            <li><b>Laufende Vorlesung:</b> Kommen die Unterlagen nach und nach, schalte bei der Prüfung „Vorlesung läuft noch“ ein. Neuer Stoff wird dann innerhalb einer Woche nach dem Import begonnen (Dauer einstellbar), statt bis zur Klausur gestreckt zu werden – so lernst du im Takt der Vorlesung und hast am Ende Zeit für Wiederholung und Altklausuren. Die Prognose gilt so lange als vorläufig. Sind alle Unterlagen da, den Schalter wieder ausschalten.</li>
            <li><b>Kernstoff zuerst:</b> Karten mit geringer Klausurrelevanz (Zusatzstoff) kommen nur dran, wenn nach dem Kernstoff noch Zeit übrig ist.</li>
            <li><b>Zeitbudget:</b> Reicht deine eingestellte Zeit nicht, bekommen nahe und wichtige Prüfungen Vorrang und die App zeigt dir, wie viel Zeit nötig wäre.</li>
          </ul>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Wie bewerte ich mich richtig?</summary>
          <ul className="help" style={{ marginTop: 8 }}>
            <li><b>Nochmal:</b> nicht gewusst oder falsch.</li>
            <li><b>Schwer:</b> gewusst, aber nur mit Mühe oder unvollständig.</li>
            <li><b>Gut:</b> gewusst – der Normalfall.</li>
            <li><b>Einfach:</b> sofort und sicher gewusst.</li>
          </ul>
          <p className="muted">Bei Rechenaufgaben: erst auf Papier rechnen, dann Schritt für Schritt vergleichen. Ehrlich bewerten lohnt sich – der Plan wird dadurch genauer.</p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Folie ansehen</summary>
          <p style={{ marginTop: 8 }}>
            Nach dem Aufdecken einer Karte öffnet „Folie ansehen“ die passende Seite der Vorlesungsunterlage. Unter Einstellungen → <i>Unterlagen</i> wählst du alle Skripte auf einmal aus (z. B. aus iCloud Drive in der Dateien-App); die App ordnet sie anhand der Dateinamen zu.
          </p>
          <p>
            <b>Mehrere Geräte:</b> Mit Dropbox-Sync legt die App ausgewählte Unterlagen zusätzlich in deiner Dropbox ab – deine anderen Geräte laden sie dann automatisch. Ohne Sync wählst du sie auf jedem Gerät einmal aus. Einen iCloud-Ordner dauerhaft verknüpfen können Web-Apps auf dem iPhone leider nicht.
          </p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Probeklausur</summary>
          <p style={{ marginTop: 8 }}>
            Auf der Seite einer Prüfung (und in den letzten drei Wochen auf der Übersicht) startest du eine Probeklausur mit Zeitlimit. Die App wählt vor allem Rechenaufgaben aus allen Kapiteln, klausurrelevante Themen bevorzugt. Nach der Abgabe vergleichst du mit den Lösungen; Multiple Choice und Zahlenergebnisse werden automatisch bewertet. Die Auswertung zeigt, welche Kapitel noch Übung brauchen.
          </p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Karten teilen und aktualisieren</summary>
          <p style={{ marginTop: 8 }}>
            Auf der Seite einer Prüfung kannst du jedes Kartenpaket über „Teilen“ an Kommilitonen schicken (ohne deinen Lernfortschritt). Bekommst du eine neue Version desselben Pakets, importierst du sie einfach erneut: Neue Karten kommen dazu, geänderte werden aktualisiert und dein Fortschritt bleibt erhalten.
          </p>
        </details>
      </div>
    </>
  )
}
