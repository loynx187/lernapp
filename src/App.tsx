import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AppStateProvider, useAppState } from './state'
import { Onboarding } from './pages/Onboarding'
import { Dashboard } from './pages/Dashboard'
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
      <main className="main">
        <Onboarding />
      </main>
    )
  }
  // Die Übersicht nutzt auf dem iPad die volle Breite, Unterseiten bleiben schmal und gut lesbar.
  return (
    <main className={pathname === '/' ? 'main wide' : 'main'}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/lernen/:mode" element={<SessionRoute />} />
        <Route path="/pruefungen" element={<Exams />} />
        <Route path="/pruefung/neu" element={<ExamForm />} />
        <Route path="/pruefung/:id" element={<ExamDetail />} />
        <Route path="/pruefung/:id/bearbeiten" element={<ExamForm />} />
        <Route path="/import" element={<Import />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="/hilfe" element={<Help />} />
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </main>
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
