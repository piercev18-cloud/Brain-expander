/**
 * Local storage. The tap always writes here and returns immediately, so a check-off
 * never waits on the network and never fails on a dead connection.
 *
 * IndexedDB with a localStorage mirror: iOS can evict either one, and a reading log
 * three years deep deserves two chances before it falls back to GitHub.
 */

const DB_NAME = 'thousand-nights'
const STORE = 'kv'
const MIRROR_PREFIX = 'tn:'

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, 1)
    } catch {
      return resolve(null)
    }
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
  return dbPromise
}

function mirrorGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(MIRROR_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function mirrorSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(MIRROR_PREFIX + key, JSON.stringify(value))
  } catch {
    /* quota or private mode; IndexedDB remains the primary */
  }
}

export async function get<T>(key: string): Promise<T | null> {
  const db = await openDb()
  if (db) {
    const value = await new Promise<T | null>((resolve) => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
        request.onsuccess = () => resolve((request.result as T) ?? null)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    if (value !== null) return value
  }
  return mirrorGet<T>(key)
}

export async function set(key: string, value: unknown): Promise<void> {
  mirrorSet(key, value)
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function remove(key: string): Promise<void> {
  try {
    localStorage.removeItem(MIRROR_PREFIX + key)
  } catch {
    /* ignore */
  }
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export const KEYS = {
  progress: 'progress',
  settings: 'settings',
  sha: 'remote-sha',
} as const
