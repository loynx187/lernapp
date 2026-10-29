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
            Mit der kostenlosen App <b>Scriptable</b> zeigt ein Widget deinen Fortschritt: Ringe (begonnen/Prognose), heutiges Pensum, Lernserie und deine Prüfungen mit Countdown – klein, mittel, groß oder auf dem Sperrbildschirm. Voraussetzung: Dropbox-Sync ist verbunden.
          </p>
          <ol className="help">
            <li>Scriptable aus dem App Store installieren.</li>
            <li>Unten auf „Widget-Skript kopieren“ tippen. In Scriptable „+“ → Code einfügen → oben als Namen „Lernapp“ eintragen → Fertig.</li>
            <li>In der Lernapp: Einstellungen → Synchronisation → „Widget-Schlüssel (Scriptable)“ → „Widget-Schlüssel kopieren“. Dann in Scriptable das Skript „Lernapp“ antippen → „Widget-Schlüssel einfügen“. Das Widget lädt den Fortschritt so direkt aus Dropbox und ist immer aktuell.</li>
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
            <li><b>Nach Fach oder gemischt:</b> Stehen heute mehrere Fächer an, führt das Widget „Unterwegs“ bzw. „Schreibtisch“ auf der Startseite zu einer Auswahl: „Alle Fächer“ wechselt zwischen den Fächern ab, darunter startest du jedes Fach einzeln. Empfohlen ist das Fach mit Rückstand, sonst das, in dem du pro Tag am meisten neuen Stoff schaffen musst – nicht das mit den meisten Wiederholungen (die sind dort fällig, wo du schon weit bist, und kommen trotzdem dran). Innerhalb eines Fachs kommen die Lektionen nacheinander, gemischt wird erst in den letzten 14 Tagen vor der Klausur.</li>
            <li><b>Gemeldete Karten</b> sind pausiert, bis sie korrigiert sind – in der Sitzung kannst du sie nach dem Melden überspringen.</li>
            <li><b>Semesterart:</b> Im dualen Semester (alle Klausuren in einer Woche) muss neuer Stoff aller Fächer bis vor Beginn der Prüfungsphase sitzen – mit längerem Wiederholungspuffer. Im regulären Semester hat jedes Fach seinen eigenen Zeitplan bis zu seiner Klausur. Einstellbar pro Semester.</li>
            <li><b>Zuordnen:</b> Bei Zuordnungskarten wählst du zu jedem Begriff links den passenden Eintrag aus der Liste (z. B. Norm → Aufgabe, Abkürzung → Bedeutung). „Prüfen“ zeigt, wie viele stimmen; danach bewertest du wie gewohnt.</li>
            <li><b>Kapitel pausieren:</b> Ist das ganze Skript importiert, pausierst du auf der Prüfungsseite unter „Kapitel“ mit dem Pause-Symbol alles, was in der Vorlesung noch nicht dran war. Neue Karten pausierter Kapitel kommen erst nach dem Fortsetzen (Play-Symbol) und zählen bis dahin nicht zum Fortschritt; schon gelernte Karten werden weiter wiederholt. Claude kann spätere Kapitel im Paket schon als pausiert markieren.</li>
            <li><b>Fehlende Unterlagen:</b> Auf der Prüfungsseite trägst du ein, was noch fehlt (z. B. Altklausuren) – optional mit Datum, ab dem erinnert werden soll. Die Startseite erinnert dich, bis du es abhakst; „Später“ stellt die Erinnerung eine Woche zurück. Wiederkehrende Erinnerungen (z. B. das wöchentliche Übungsblatt) kommen nach „Diesmal erledigt“ zum nächsten Termin wieder. Claude kann solche Erinnerungen auch über das Kartenpaket oder eine Fachprofil-Datei anlegen, und offene stehen im Auftrag für Claude.</li>
            <li><b>Laufende Vorlesung:</b> Kommen die Unterlagen nach und nach, schalte bei der Prüfung „Vorlesung läuft noch“ ein. Neuer Stoff wird dann innerhalb einer Woche nach dem Import begonnen (Dauer einstellbar), statt bis zur Klausur gestreckt zu werden – so lernst du im Takt der Vorlesung und hast am Ende Zeit für Wiederholung und Altklausuren. Die Prognose gilt so lange als vorläufig. Sind alle Unterlagen da, den Schalter wieder ausschalten.</li>
            <li><b>Lerntag:</b> Ein Lerntag geht von 4:00 bis 4:00 Uhr. Wer nach Mitternacht lernt, lernt noch für den Vortag – Pensum und Lernserie stimmen trotzdem.</li>
            <li><b>Kernstoff zuerst:</b> Karten mit geringer Klausurrelevanz (Zusatzstoff) kommen nur dran, wenn nach dem Kernstoff noch Zeit übrig ist.</li>
            <li><b>Karten sind Pflicht, Aufgaben Zusatz:</b> Fortschritt, Prognose und Rückstand zählen nur die Karteikarten. Schreibtischaufgaben müssen nicht alle bis zur Klausur geschafft sein: Nach Hausaufgaben und fälligen Wiederholungen geübter Aufgaben füllt die App deine Schreibtisch-Zeit mit empfohlenen Aufgaben – Aufgaben aus Probe- und Altklausuren zuerst, dann Themen, deren Karten du oft vergisst. Themen, deren Karten du noch gar nicht begonnen hast, kommen später. Warum eine Aufgabe empfohlen ist, steht über der Aufgabe.</li>
            <li><b>Zeitbudget:</b> Reicht deine eingestellte Zeit nicht, bekommen nahe und wichtige Prüfungen Vorrang und die App zeigt dir, wie viel Zeit nötig wäre. Die App misst außerdem, wie lange du tatsächlich lernst: Ab drei Lerntagen plant sie mit einem Wert zwischen Einstellung und Messung (höchstens halb bzw. anderthalb so viel wie eingestellt). Abschaltbar unter Einstellungen.</li>
          </ul>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Deine Daten und Updates</summary>
          <ul className="help" style={{ marginTop: 8 }}>
            <li><b>Speicherort:</b> Alles liegt auf deinem Gerät, mit Dropbox-Sync zusätzlich in deiner Dropbox (inkl. Wochensicherungen der letzten 8 Wochen). Die App bittet den Browser, die Daten dauerhaft zu behalten; am zuverlässigsten klappt das, wenn die App auf dem Homescreen installiert ist.</li>
            <li><b>Vorlage ohne Lernfortschritt:</b> Einstellungen → „Vorlage exportieren“ speichert alle Semester, Prüfungen (mit Termin, Fachprofil und offenen Erinnerungen), Kartenpakete und offene Meldungen in einer Datei – ohne Lernstand, Bewertungen, Hausaufgaben und persönliche Einstellungen. Kommilitonen tippen beim ersten Start auf „Vorlage von Kommilitonen übernehmen“ und wählen die Datei – damit ist alles in einem Schritt eingerichtet. In einem bestehenden Profil geht es unter „Karten importieren“: Prüfungen mit gleichem Namen werden ergänzt, der Lernfortschritt bleibt. So übernimmst du auch Korrekturen von Kommilitonen – die Vorschau zeigt, welche Pakete bei ihnen neuer sind; deren geänderte Karten werden korrigiert, ältere Pakete überschreiben deine neueren nicht, und es werden keine Karten entfernt.</li>
            <li><b>Ohne Dropbox:</b> Die App erinnert dich wöchentlich daran, unter Einstellungen → „Sicherung exportieren“ eine Sicherungsdatei anzulegen, z. B. in iCloud Drive.</li>
            <li><b>Updates:</b> Neue Versionen werden beim Öffnen der App übernommen. Kommt eine während des Lernens, erscheint danach „Neue Version verfügbar“ – eine Lernsitzung oder Probeklausur wird nie unterbrochen.</li>
            <li><b>Probeklausur:</b> Wird laufend gespeichert. Wechselst du zwischendurch die App oder wird sie beendet, geht es beim nächsten Öffnen an derselben Stelle weiter – die Zeit läuft wie in der echten Klausur weiter.</li>
            <li><b>Fehler:</b> Geht etwas schief, zeigt die App eine Fehlerseite mit „Neu laden“ und „Sicherung exportieren“. Deine Daten sind davon nicht betroffen.</li>
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
            Auf der Seite einer Prüfung (und in den letzten drei Wochen auf der Übersicht) startest du eine Probeklausur mit Zeitlimit. Die App wählt vor allem Rechenaufgaben aus allen Kapiteln, klausurrelevante Themen bevorzugt. Nach der Abgabe vergleichst du mit den Lösungen; Multiple Choice, Zuordnungen und Zahlenergebnisse werden automatisch bewertet. Die Auswertung zeigt, welche Kapitel noch Übung brauchen.
          </p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Hausaufgaben</summary>
          <p style={{ marginTop: 8 }}>
            Hausaufgaben trägst du direkt auf der Startseite ein (Widget „Hausaufgaben“ → „Eintragen“) oder auf der Seite der Prüfung – mit Abgabetermin, geschätzter Dauer und optional einem Foto des Aufgabenblatts. Die App verteilt die Dauer bis zur Abgabe auf die Tage und reserviert diese Zeit fest in deinem Schreibtisch-Budget – anders als Übungsaufgaben sind Hausaufgaben Pflicht, und die Anpassung an die gemessene Lernzeit verkleinert diesen Anteil nie. Für Aufgaben bleibt nur die übrige Zeit; reicht das Budget nicht einmal für die Hausaufgaben, zeigt das Schreibtisch-Widget „Budget zu knapp“. Ab drei Tagen vor der Abgabe kommt die Hausaufgabe in der Schreibtisch-Sitzung von selbst vor den Karten dran; früher kannst du sie jederzeit unter „Hausaufgaben“ vorziehen.
          </p>
          <p>
            Beim Abhaken kannst du deine Lösung notieren oder fotografieren und die Aufgabe als Übungsaufgabe behalten – dann wird sie zur Klausurvorbereitung wie eine Karte wiederholt.
          </p>
        </details>
        <details>
          <summary>Erinnerungen</summary>
          <p style={{ marginTop: 8 }}>
            Für alles, was keinen Abgabetermin hat oder früher erledigt werden soll: Widget „Erinnerungen“ → „Eintragen“ (oder unter Hausaufgaben → „Erinnerungen“). Eine Erinnerung hat einen Titel, optional eine Notiz und einen Tag, ab dem sie fällig ist; verknüpfen kannst du sie mit einer Prüfung oder einer Hausaufgabe. Auf einer Hausaufgabe setzt „Erinnerung zum Bearbeiten setzen“ eine Erinnerung zwei Tage vor der Abgabe – ist die Hausaufgabe erledigt, ist es die Erinnerung auch.
          </p>
          <p>
            Fällige Erinnerungen stehen auf der Startseite zum Abhaken; auf der Seite „Erinnerungen“ lassen sie sich auch auf morgen verschieben. Sie stehen außerdem in der täglichen Kurzbefehle-Erinnerung und werden über Dropbox abgeglichen. Claude kann dir Erinnerungen als Datei mitschicken – Import unter „Karten importieren“.
          </p>
        </details>
      </div>

      <div className="card stack">
        <details>
          <summary>Karten teilen und aktualisieren</summary>
          <p style={{ marginTop: 8 }}>
            Auf der Seite einer Prüfung kannst du jedes Kartenpaket über „Teilen“ an Kommilitonen schicken (ohne deinen Lernfortschritt). Bekommst du eine neue Version desselben Pakets, importierst du sie einfach erneut: Neue Karten kommen dazu, geänderte werden aktualisiert und dein Fortschritt bleibt erhalten.
          </p>
          <p>
            Karten aus ChatGPT, NotebookLM, Anki, Quizlet oder Excel lassen sich unter „Karten importieren“ → „Karten aus anderen Tools“ einlesen. Die Schaltfläche „Vorlage für ChatGPT &amp; Co. kopieren“ liefert eine Anweisung für andere KI-Tools, damit Kapitel und Reihenfolge erhalten bleiben.
          </p>
          <p>
            Unter Prüfung → „Alle Karten ansehen“ findest du alle Karten in Lernreihenfolge – zum Nachlesen, Melden, Löschen und Wiederherstellen. Die Reihenfolge der Pakete änderst du auf der Prüfungsseite mit ↑/↓.
          </p>
        </details>
      </div>
    </>
  )
}
