import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { alternative, buildPools, consumedBefore, dealFor, type Pools } from './deal'
import { loadIndex, prefetch } from './corpus'
import { msUntilRollover, nightIndexFor, nightKey } from './night'
import {
  emptyProgress, newSalt, recordDeal, setNote as setNoteOn, stats as computeStats,
  swapSlot as swapSlotOn, toggleDone as toggleDoneOn, toggleSaved as toggleSavedOn, type Stats,
} from './progress'
import { KEYS, get, set } from './store'
import { isConfigured, restore as restoreRemote, sync as syncRemote, type SyncState } from './sync'
import { estimateNight, heaviestSlot, overTarget, type NightEstimate } from './curation'
import { DEFAULT_SETTINGS, FORMS, type Form, type IndexEntry, type Progress, type Settings } from './types'

const SYNC_DEBOUNCE_MS = 1500

export interface App {
  ready: boolean
  error?: string
  settings: Settings
  progress: Progress
  index: IndexEntry[]
  byId: Map<string, IndexEntry>
  pools: Pools
  todayKey: string
  nightIndex: number
  dealt: Partial<Record<Form, string>>
  entries: Partial<Record<Form, IndexEntry | undefined>>
  estimate: NightEstimate
  /** The slot worth offering a swap on, or null when tonight already fits. */
  suggestSwap: Form | null
  stats: Stats
  msToRollover: number
  syncState: SyncState
  syncMessage?: string
  toggleDone: (form: Form) => void
  toggleSaved: (id: string) => void
  setNote: (id: string, note: string) => void
  /** Take another piece for this slot. Returns false when there is nothing to offer. */
  swap: (form: Form, shorterOnly?: boolean) => boolean
  saveSettings: (next: Settings) => Promise<void>
  syncNow: () => Promise<void>
  restoreNow: () => Promise<void>
}

export function useApp(): App {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [progress, setProgress] = useState<Progress>(() => emptyProgress('1970-01-01', 'bootstrap'))
  const [index, setIndex] = useState<IndexEntry[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMessage, setSyncMessage] = useState<string>()

  const shaRef = useRef<string | undefined>(undefined)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const latest = useRef({ progress, settings })
  latest.current = { progress, settings }

  /* Boot: local state first so the app is usable before any network call. */
  useEffect(() => {
    void (async () => {
      const [storedSettings, storedProgress, storedSha, entries] = await Promise.all([
        get<Settings>(KEYS.settings),
        get<Progress>(KEYS.progress),
        get<string>(KEYS.sha),
        loadIndex().catch((e: Error) => {
          setError(e.message)
          return [] as IndexEntry[]
        }),
      ])

      const merged = { ...DEFAULT_SETTINGS, ...(storedSettings ?? {}) }
      setSettings(merged)
      shaRef.current = storedSha ?? undefined
      setIndex(entries)

      if (storedProgress) {
        setProgress(storedProgress)
      } else {
        const first = nightKey(new Date(), merged.timeZone, merged.rolloverHour)
        const fresh = emptyProgress(first, newSalt())
        setProgress(fresh)
        await set(KEYS.progress, fresh)
      }
      setReady(true)
    })()
  }, [])

  /* Keep the clock honest so the night flips while the app is open. */
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])

  const todayKey = useMemo(
    () => nightKey(new Date(now), settings.timeZone, settings.rolloverHour),
    [now, settings.timeZone, settings.rolloverHour],
  )
  const nightIndex = useMemo(
    () => Math.max(0, nightIndexFor(todayKey, progress.startedOn)),
    [todayKey, progress.startedOn],
  )
  const pools = useMemo(() => buildPools(index), [index])
  const byId = useMemo(() => new Map(index.map((e) => [e.id, e])), [index])
  const dealt = useMemo(
    () => (index.length ? dealFor(nightIndex, progress, pools, todayKey) : {}),
    [index.length, nightIndex, progress, pools, todayKey],
  )
  const entries = useMemo(() => {
    const out: Partial<Record<Form, IndexEntry | undefined>> = {}
    for (const form of FORMS) {
      const id = dealt[form]
      out[form] = id ? byId.get(id) : undefined
    }
    return out
  }, [dealt, byId])

  const record = progress.nights[todayKey]
  const estimate = useMemo(() => estimateNight(entries, record?.done ?? []), [entries, record?.done])
  const suggestSwap = useMemo(
    () =>
      overTarget(estimate, settings.nightlyMinutes)
        ? heaviestSlot(estimate, record?.done ?? [])
        : null,
    [estimate, settings.nightlyMinutes, record?.done],
  )

  const stats = useMemo(() => computeStats(progress, todayKey), [progress, todayKey])
  const msToRollover = useMemo(
    () => msUntilRollover(new Date(now), settings.timeZone, settings.rolloverHour),
    [now, settings.timeZone, settings.rolloverHour],
  )

  /* Pin tonight's deal locally so a refresh cannot re-roll it. Not a sync trigger. */
  useEffect(() => {
    if (!ready || !index.length) return
    if (!FORMS.every((f) => dealt[f])) return
    setProgress((current) => {
      const pinned = recordDeal(current, todayKey, dealt)
      if (pinned !== current) void set(KEYS.progress, pinned)
      return pinned
    })
  }, [ready, index.length, todayKey, dealt])

  /* Read ahead two nights so a dead zone is never a broken night. */
  useEffect(() => {
    if (!ready || !index.length) return
    const ahead: string[] = [...FORMS.map((f) => dealt[f]).filter(Boolean) as string[]]
    for (let i = 1; i <= 2; i++) {
      const future = dealFor(nightIndex + i, progress, pools, `ahead-${nightIndex + i}`)
      for (const form of FORMS) if (future[form]) ahead.push(future[form]!)
    }
    prefetch(ahead)
    // Deliberately keyed on the night only: re-running on every progress edit is waste.
  }, [ready, index.length, nightIndex])

  const commit = useCallback((next: Progress, markDirty: boolean) => {
    setProgress(next)
    void set(KEYS.progress, next)
    if (markDirty) dirtyRef.current = true
  }, [])

  const runSync = useCallback(async () => {
    const { progress: current, settings: config } = latest.current
    if (!isConfigured(config)) {
      setSyncState('unconfigured')
      return
    }
    setSyncState('syncing')
    const key = nightKey(new Date(), config.timeZone, config.rolloverHour)
    const result = await syncRemote(config, current, key, shaRef.current)
    setSyncState(result.state)
    setSyncMessage(result.message)
    if (result.sha) {
      shaRef.current = result.sha
      void set(KEYS.sha, result.sha)
    }
    if (result.state === 'synced') {
      dirtyRef.current = false
      setProgress(result.progress)
      void set(KEYS.progress, result.progress)
    }
  }, [])

  /* Debounced background sync. The tap already succeeded; this is bookkeeping. */
  useEffect(() => {
    if (!ready || !dirtyRef.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void runSync(), SYNC_DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [ready, progress, runSync])

  /* Anything written while offline goes up as soon as the connection returns. */
  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current) void runSync()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  const toggleDone = useCallback(
    (form: Form) => commit(toggleDoneOn(latest.current.progress, todayKey, form), true),
    [commit, todayKey],
  )
  const toggleSaved = useCallback(
    (id: string) => commit(toggleSavedOn(latest.current.progress, id), true),
    [commit],
  )
  const setNote = useCallback(
    (id: string, note: string) => commit(setNoteOn(latest.current.progress, id, note), true),
    [commit],
  )

  const swap = useCallback(
    (form: Form, shorterOnly = false) => {
      const current = latest.current.progress
      const night = current.nights[todayKey]
      const currentId = night?.dealt[form]
      const currentWords = currentId ? byId.get(currentId)?.words : undefined

      const next = alternative(
        nightIndex,
        current.salt,
        form,
        pools,
        consumedBefore(current, nightIndex),
        night?.passed?.[form] ?? [],
        (id) => byId.get(id)?.words ?? 0,
        shorterOnly && currentWords ? currentWords : undefined,
      )
      if (!next) return false

      commit(swapSlotOn(current, todayKey, form, next), true)
      return true
    },
    [commit, todayKey, nightIndex, pools, byId],
  )

  const saveSettings = useCallback(async (next: Settings) => {
    setSettings(next)
    await set(KEYS.settings, next)
  }, [])

  const restoreNow = useCallback(async () => {
    setSyncState('syncing')
    const result = await restoreRemote(latest.current.settings, latest.current.progress)
    setSyncState(result.state)
    setSyncMessage(result.message)
    if (result.state === 'synced') {
      setProgress(result.progress)
      await set(KEYS.progress, result.progress)
      if (result.sha) {
        shaRef.current = result.sha
        await set(KEYS.sha, result.sha)
      }
    }
  }, [])

  return {
    ready, error, settings, progress, index, byId, pools, todayKey, nightIndex,
    dealt, entries, estimate, suggestSwap, stats, msToRollover, syncState, syncMessage,
    toggleDone, toggleSaved, setNote, swap, saveSettings, syncNow: runSync, restoreNow,
  }
}
