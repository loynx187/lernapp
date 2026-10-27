import { db } from './db'

/**
 * Dropbox-Anbindung ohne eigenen Server: OAuth mit PKCE direkt aus dem Browser.
 * Die App sieht nur ihren eigenen Ordner („Apps/<App-Name>“) in der Dropbox des Nutzers.
 *
 * Der App-Schlüssel ist öffentlich (PKCE braucht kein Geheimnis). Er stammt aus der
 * Dropbox-App, die einmalig unter https://www.dropbox.com/developers/apps angelegt wird.
 */
export const DROPBOX_APP_KEY: string = import.meta.env.VITE_DROPBOX_APP_KEY ?? ''

const AUTH_KEY = 'lernapp.dropboxAuth'
const PENDING = 'pending'

export interface DropboxTokens {
  refreshToken: string
  accessToken: string
  expiresAt: number
  connectedAt: number
}

export class DropboxError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly conflict = false,
  ) {
    super(message)
  }
}

export const redirectUri = () => new URL(import.meta.env.BASE_URL, location.origin).href
const metaKey = (profileId: string) => `dropbox:${profileId}`

export async function getTokens(profileId: string): Promise<DropboxTokens | undefined> {
  return (await db.meta.get(metaKey(profileId)))?.value as DropboxTokens | undefined
}

async function setTokens(profileId: string, t: DropboxTokens) {
  await db.meta.put({ key: metaKey(profileId), value: t })
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(len = 64): string {
  return base64url(crypto.getRandomValues(new Uint8Array(len))).slice(0, len)
}

/**
 * Startet die Anmeldung bei Dropbox. `target` ist das Profil, das verbunden wird,
 * oder undefined, wenn ein Profil aus Dropbox auf dieses Gerät geholt werden soll.
 */
export async function startAuth(target?: string) {
  const verifier = randomString(64)
  const state = randomString(24)
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  localStorage.setItem(AUTH_KEY, JSON.stringify({ verifier, state, target: target ?? PENDING }))
  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.search = new URLSearchParams({
    client_id: DROPBOX_APP_KEY,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri(),
    token_access_type: 'offline',
    state,
  }).toString()
  location.assign(url.href)
}

/**
 * Verarbeitet die Rückkehr von Dropbox (…/lernapp/?code=…&state=…).
 * Liefert das verbundene Profil bzw. 'pending' für den Import auf ein neues Gerät.
 */
export async function handleAuthRedirect(): Promise<string | undefined> {
  const params = new URLSearchParams(location.search)
  const code = params.get('code')
  const error = params.get('error')
  if (!code && !error) return undefined
  const stored = JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as { verifier: string; state: string; target: string } | null
  localStorage.removeItem(AUTH_KEY)
  history.replaceState(null, '', redirectUri())
  if (error || !stored || stored.state !== params.get('state')) throw new DropboxError('Die Verbindung mit Dropbox wurde abgebrochen.')

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      code: code!,
      grant_type: 'authorization_code',
      code_verifier: stored.verifier,
      client_id: DROPBOX_APP_KEY,
      redirect_uri: redirectUri(),
    }),
  })
  if (!res.ok) throw new DropboxError('Dropbox hat die Anmeldung nicht bestätigt.', res.status)
  const t = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number }
  await setTokens(stored.target, {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
    connectedAt: Date.now(),
  })
  return stored.target
}

/** Überträgt einen beim Import geholten Zugang auf das importierte Profil. */
export async function adoptPendingTokens(profileId: string) {
  const pending = await getTokens(PENDING)
  if (!pending) return
  await setTokens(profileId, pending)
  await db.meta.delete(metaKey(PENDING))
}

async function accessToken(profileId: string): Promise<string> {
  const t = await getTokens(profileId)
  if (!t) throw new DropboxError('Nicht mit Dropbox verbunden.')
  if (Date.now() < t.expiresAt) return t.accessToken
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refreshToken, client_id: DROPBOX_APP_KEY }),
  })
  if (res.status === 400 || res.status === 401) throw new DropboxError('Die Dropbox-Verbindung ist abgelaufen. Bitte neu verbinden.', res.status)
  if (!res.ok) throw new DropboxError('Dropbox ist gerade nicht erreichbar.', res.status)
  const j = (await res.json()) as { access_token: string; expires_in: number }
  await setTokens(profileId, { ...t, accessToken: j.access_token, expiresAt: Date.now() + (j.expires_in - 60) * 1000 })
  return j.access_token
}

/** Dropbox erwartet JSON im Header mit ASCII-maskierten Sonderzeichen. */
const headerJson = (v: unknown) => JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

async function call(profileId: string, url: string, init: RequestInit): Promise<Response> {
  const token = await accessToken(profileId)
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } })
  } catch {
    throw new DropboxError('Keine Verbindung zu Dropbox (offline?).')
  }
  return res
}

export interface Downloaded {
  data: Uint8Array<ArrayBuffer>
  rev: string
}

export async function download(profileId: string, path: string): Promise<Downloaded | null> {
  const res = await call(profileId, 'https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { 'Dropbox-API-Arg': headerJson({ path }) },
  })
  if (res.status === 409) return null
  if (!res.ok) throw new DropboxError('Herunterladen aus Dropbox fehlgeschlagen.', res.status)
  const meta = JSON.parse(res.headers.get('Dropbox-API-Result') ?? '{}') as { rev?: string }
  return { data: new Uint8Array(await res.arrayBuffer()), rev: meta.rev ?? '' }
}

/** Lädt hoch. Mit `rev` nur, wenn die Datei seitdem nicht von einem anderen Gerät geändert wurde. */
export async function upload(profileId: string, path: string, data: Uint8Array<ArrayBuffer> | string, rev?: string | null): Promise<string> {
  const mode = rev === undefined ? 'overwrite' : rev === null ? 'add' : { '.tag': 'update', update: rev }
  const res = await call(profileId, 'https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Dropbox-API-Arg': headerJson({ path, mode, autorename: false, mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: typeof data === 'string' ? new TextEncoder().encode(data) : data,
  })
  if (res.status === 409) throw new DropboxError('Die Datei wurde zwischenzeitlich geändert.', 409, true)
  if (!res.ok) throw new DropboxError('Hochladen nach Dropbox fehlgeschlagen.', res.status)
  return ((await res.json()) as { rev: string }).rev
}

/** Aktuelle Version (rev) einer Datei oder null, wenn es sie nicht gibt – ohne den Inhalt zu laden. */
export async function getRev(profileId: string, path: string): Promise<string | null> {
  const res = await call(profileId, 'https://api.dropboxapi.com/2/files/get_metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (res.status === 409) return null
  if (!res.ok) throw new DropboxError('Dropbox ist gerade nicht erreichbar.', res.status)
  return ((await res.json()) as { rev?: string }).rev ?? null
}

export async function deleteFile(profileId: string, path: string) {
  const res = await call(profileId, 'https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok && res.status !== 409) throw new DropboxError('Löschen in Dropbox fehlgeschlagen.', res.status)
}

export async function listFolder(profileId: string, path: string): Promise<{ name: string; path: string }[]> {
  const res = await call(profileId, 'https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (res.status === 409) return []
  if (!res.ok) throw new DropboxError('Dropbox-Ordner konnte nicht gelesen werden.', res.status)
  const j = (await res.json()) as { entries: { '.tag': string; name: string; path_lower: string }[] }
  return j.entries.filter((e) => e['.tag'] === 'file').map((e) => ({ name: e.name, path: e.path_lower }))
}

export async function disconnect(profileId: string) {
  try {
    await call(profileId, 'https://api.dropboxapi.com/2/auth/token/revoke', { method: 'POST' })
  } catch {
    // Auch ohne Netz lokal trennen.
  }
  await db.meta.delete(metaKey(profileId))
}
