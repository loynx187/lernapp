import { PageHeader } from '../components/ui'

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
