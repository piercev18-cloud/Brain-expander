/**
 * GitHub as the durable record.
 *
 * Progress is committed to a dedicated branch so that a thousand nightly commits never
 * touch `main` or trigger a Pages rebuild. The phone writes locally first and syncs
 * behind that, so the network is never on the critical path of a checkbox.
 */

import { merge, withDerived } from './progress'
import type { Progress, Settings } from './types'

const API = 'https://api.github.com'

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'unconfigured' | 'error'

export interface SyncResult {
  state: SyncState
  progress: Progress
  sha?: string
  message?: string
  at?: string
}

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function decode(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function api(settings: Settings, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${settings.token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })
}

export function isConfigured(settings: Settings): boolean {
  return !!settings.token && !!settings.owner && !!settings.repo
}

/** Create the state branch off the default branch if it is not there yet. */
async function ensureBranch(settings: Settings): Promise<void> {
  const { owner, repo, branch } = settings
  const head = await api(settings, `/repos/${owner}/${repo}/git/ref/heads/${branch}`)
  if (head.ok) return
  if (head.status !== 404) throw new Error(`branch check failed (${head.status})`)

  const info = await api(settings, `/repos/${owner}/${repo}`)
  if (!info.ok) throw new Error(`repository not reachable (${info.status})`)
  const base = (await info.json()).default_branch as string

  const baseRef = await api(settings, `/repos/${owner}/${repo}/git/ref/heads/${base}`)
  if (!baseRef.ok) throw new Error(`default branch not found (${baseRef.status})`)
  const sha = (await baseRef.json()).object.sha as string

  const created = await api(settings, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
  // 422 means another device created it a moment ago, which is fine.
  if (!created.ok && created.status !== 422) {
    throw new Error(`could not create branch ${branch} (${created.status})`)
  }
}

export interface Remote {
  progress: Progress | null
  sha?: string
}

export async function pull(settings: Settings): Promise<Remote> {
  const { owner, repo, path, branch } = settings
  const response = await api(
    settings,
    `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`,
  )
  if (response.status === 404) return { progress: null }
  if (!response.ok) throw new Error(`pull failed (${response.status})`)
  const body = await response.json()
  return { progress: JSON.parse(decode(body.content)) as Progress, sha: body.sha as string }
}

async function put(settings: Settings, progress: Progress, sha: string | undefined, note: string) {
  const { owner, repo, path, branch } = settings
  return api(settings, `/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: note,
      content: encode(JSON.stringify(progress, null, 2) + '\n'),
      branch,
      ...(sha ? { sha } : {}),
    }),
  })
}

/**
 * Pull, union-merge, push. On a conflicting write the remote is re-read and merged
 * again rather than overwritten — a check-off made on another device is never lost.
 */
export async function sync(
  settings: Settings,
  local: Progress,
  todayKey: string,
  knownSha?: string,
): Promise<SyncResult> {
  if (!isConfigured(settings)) return { state: 'unconfigured', progress: local }

  try {
    await ensureBranch(settings)

    let sha = knownSha
    let combined = local

    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await pull(settings)
      sha = remote.sha
      combined = remote.progress ? merge(local, remote.progress) : local

      const derived = withDerived(combined, todayKey)
      const note = `night ${derived.derived!.nightsCompleted} of 1000`
      const response = await put(settings, derived, sha, note)

      if (response.ok) {
        const body = await response.json()
        return {
          state: 'synced',
          progress: derived,
          sha: body.content?.sha as string,
          at: new Date().toISOString(),
        }
      }
      // 409/422 mean someone committed between our read and our write.
      if (response.status !== 409 && response.status !== 422) {
        const detail = await response.text()
        return {
          state: 'error',
          progress: combined,
          message: `GitHub refused the write (${response.status}). ${detail.slice(0, 160)}`,
        }
      }
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
    }

    return { state: 'error', progress: combined, message: 'Could not settle a conflicting write.' }
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return {
      state: offline ? 'offline' : 'error',
      progress: local,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Pull the remote record and merge it into local. Used to restore a fresh device. */
export async function restore(settings: Settings, local: Progress): Promise<SyncResult> {
  if (!isConfigured(settings)) return { state: 'unconfigured', progress: local }
  try {
    const remote = await pull(settings)
    if (!remote.progress) {
      return { state: 'error', progress: local, message: 'No record found in the repository yet.' }
    }
    return { state: 'synced', progress: merge(local, remote.progress), sha: remote.sha }
  } catch (error) {
    return {
      state: 'error',
      progress: local,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
