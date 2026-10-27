import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { AppStateProvider, useAppState } from './state'
import { Icon } from './components/ui'
import { Onboarding } from './pages/Onboarding'
import { Today } from './pages/Today'
import { Session } from './pages/Session'
import { Exams } from './pages/Exams'
import { ExamDetail } from './pages/ExamDetail'
import { ExamForm } from './pages/ExamForm'
import { Import } from './pages/Import'
import { Settings } from './pages/Settings'
import { Help } from './pages/Help'

/** Jede Sitzung neu aufbauen, auch beim direkten Wechsel zwischen zwei Sitzungen. */
function SessionRoute() {
  const location = useLocation()
  return <Session key={location.key} />
}

function Shell() {
  const { loading, profile, semester } = useAppState()
  const { pathname } = useLocation()
  if (loading) return null
  if (!profile || !semester) {
    return (
      <main className="main full">
        <Onboarding />
      </main>
    )
  }
  const inSession = pathname.startsWith('/lernen')
  return (
    <>
      <main className={inSession ? 'main full' : 'main'}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/lernen/:mode" element={<SessionRoute />} />
          <Route path="/pruefungen" element={<Exams />} />
          <Route path="/pruefung/neu" element={<ExamForm />} />
          <Route path="/pruefung/:id" element={<ExamDetail />} />
          <Route path="/pruefung/:id/bearbeiten" element={<ExamForm />} />
          <Route path="/import" element={<Import />} />
          <Route path="/einstellungen" element={<Settings />} />
          <Route path="/hilfe" element={<Help />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </main>
      {!inSession && (
        <nav className="nav" aria-label="Hauptnavigation">
          <NavLink to="/" end>
            <Icon name="today" />
            Heute
          </NavLink>
          <NavLink to="/pruefungen" className={({ isActive }) => (isActive || pathname.startsWith('/pruefung') ? 'active' : '')}>
            <Icon name="exams" />
            Prüfungen
          </NavLink>
          <NavLink to="/einstellungen">
            <Icon name="settings" />
            Einstellungen
          </NavLink>
        </nav>
      )}
    </>
  )
}

export function App() {
  return (
    <HashRouter>
      <AppStateProvider>
        <div className="app">
          <Shell />
        </div>
      </AppStateProvider>
    </HashRouter>
  )
}
