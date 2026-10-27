import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAppState } from './state'
import { disconnect as dropboxDisconnect, DROPBOX_APP_KEY, getTokens, handleAuthRedirect, startAuth } from './lib/dropbox'
import { getSyncStatus, syncProfile } from './lib/syncService'

interface SyncState {
  /** Dropbox-Sync ist für diese App-Installation eingerichtet (App-Schlüssel vorhanden). */
  available: boolean
  connected: boolean
  syncing: boolean
  lastSync?: number
  error?: string
  connect(): void
  disconnect(): Promise<void>
  syncNow(): Promise<void>
}

const Ctx = createContext<SyncState | null>(null)

/** Nach dieser Zeit wird beim Zurückkehren in die App erneut abgeglichen. */
const RESYNC_AFTER = 60_000
const INTERVAL = 5 * 60_000

export function SyncProvider({ children }: { children: ReactNode }) {
  const { profile, selectProfile } = useAppState()
  const pid = profile?.id
  const { pathname } = useLocation()
  const tokens = useLiveQuery(() => (pid ? getTokens(pid) : undefined), [pid])
  const status = useLiveQuery(() => (pid ? getSyncStatus(pid) : undefined), [pid])
  const [syncing, setSyncing] = useState(false)
  const [redirectError, setRedirectError] = useState<string>()
  const running = useRef<Promise<void> | null>(null)
  const lastRun = useRef(0)
  const connected = !!tokens

  // Rückkehr von der Dropbox-Anmeldung
  useEffect(() => {
    handleAuthRedirect()
      .then((target) => {
        if (target === 'pending') location.hash = '#/dropbox-import'
        else if (target) {
          selectProfile(target)
          location.hash = '#/einstellungen'
        }
      })
      .catch((e: Error) => setRedirectError(e.message))
  }, [])

  const syncNow = useCallback(async () => {
    if (!pid || !connected) return
    if (running.current) return running.current
    setSyncing(true)
    lastRun.current = Date.now()
    running.current = syncProfile(pid)
      .catch(() => {
        // Fehler stehen im Sync-Status und werden in den Einstellungen angezeigt.
      })
      .finally(() => {
        running.current = null
        setSyncing(false)
      })
    return running.current
  }, [pid, connected])

  // Abgleich beim Start, regelmäßig im Vordergrund und beim Verlassen/Zurückkehren
  useEffect(() => {
    if (!connected) return
    syncNow()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncNow()
      else if (Date.now() - lastRun.current > RESYNC_AFTER) syncNow()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(() => document.visibilityState === 'visible' && syncNow(), INTERVAL)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [connected, syncNow])

  // Nach jedem Seitenwechsel (z. B. Ende einer Lernsitzung, Import, Bearbeitung) kurz verzögert abgleichen.
  useEffect(() => {
    if (!connected) return
    const t = setTimeout(syncNow, 3000)
    return () => clearTimeout(t)
  }, [pathname, connected, syncNow])

  const value: SyncState = {
    available: !!DROPBOX_APP_KEY,
    connected,
    syncing,
    lastSync: status?.lastSync,
    error: redirectError ?? status?.error,
    connect: () => startAuth(pid),
    async disconnect() {
      if (pid) await dropboxDisconnect(pid)
    },
    syncNow,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSync(): SyncState {
  const v = useContext(Ctx)
  if (!v) throw new Error('SyncProvider fehlt')
  return v
}
