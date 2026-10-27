import { useNavigate } from 'react-router-dom'
import { Icon } from '../components/ui'

export function Help() {
  const navigate = useNavigate()
  return (
    <>
      <div className="header">
        <button className="btn ghost small" onClick={() => navigate(-1)} aria-label="Zurück">
          <Icon name="back" />
        </button>
        <h1 className="grow">Hilfe</h1>
      </div>

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
          <summary>Tägliche Erinnerung einrichten</summary>
          <p style={{ marginTop: 8 }}>Die App kommt ohne Server aus und kann deshalb selbst keine Mitteilungen schicken. So bekommst du trotzdem eine Erinnerung:</p>
          <p><b>iPhone – Erinnerungen-App:</b></p>
          <ol className="help">
            <li>Neue Erinnerung „Lernen“ anlegen.</li>
            <li>Auf ⓘ tippen → „Datum“ und „Uhrzeit“ aktivieren, z. B. 18:00.</li>
            <li>„Wiederholen“ → „Täglich“.</li>
          </ol>
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
          <summary>Karten teilen und aktualisieren</summary>
          <p style={{ marginTop: 8 }}>
            Auf der Seite einer Prüfung kannst du jedes Kartenpaket über „Teilen“ an Kommilitonen schicken (ohne deinen Lernfortschritt). Bekommst du eine neue Version desselben Pakets, importierst du sie einfach erneut: Neue Karten kommen dazu, geänderte werden aktualisiert und dein Fortschritt bleibt erhalten.
          </p>
        </details>
      </div>
    </>
  )
}
