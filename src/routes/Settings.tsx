import { useRef, useState } from 'react'
import { TARGET_NIGHTS, type Settings as SettingsShape } from '../lib/types'
import { merge, withDerived } from '../lib/progress'
import { KEYS, set } from '../lib/store'
import type { App } from '../lib/useApp'

const ZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
]

export function Settings({ app }: { app: App }) {
  const [draft, setDraft] = useState<SettingsShape>(app.settings)
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) => {
    const next = { ...draft, [key]: value }
    setDraft(next)
    void app.saveSettings(next)
  }

  const [theme, applyTheme] = useState<'dark' | 'light'>(
    () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'),
  )
  const setTheme = (value: 'dark' | 'light') => {
    document.documentElement.dataset.theme = value
    applyTheme(value)
    try {
      localStorage.setItem('tn:theme', value)
    } catch {
      /* private mode */
    }
  }

  const exportJson = () => {
    const payload = withDerived(app.progress, app.todayKey)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `thousand-nights-${app.todayKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      const incoming = JSON.parse(await file.text())
      if (incoming?.version !== 1 || !incoming.nights) throw new Error('Not a progress file.')
      const merged = merge(app.progress, incoming)
      await set(KEYS.progress, merged)
      setNote({ kind: 'ok', text: 'Merged. Nothing was overwritten. Reload to see it.' })
    } catch (error) {
      setNote({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    }
  }

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(true)
    setNote(null)
    await action()
    setBusy(false)
    setNote(
      app.syncState === 'error'
        ? { kind: 'error', text: app.syncMessage ?? `${label} failed.` }
        : { kind: 'ok', text: `${label} done.` },
    )
  }

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">
        Night {app.stats.nightsCompleted} of {TARGET_NIGHTS}, started {app.progress.startedOn}.
      </p>

      {note && <div className={`status status--${note.kind === 'ok' ? 'ok' : 'error'}`}>{note.text}</div>}
      {app.syncState === 'error' && app.syncMessage && (
        <div className="status status--error">{app.syncMessage}</div>
      )}

      <h2 className="night__label" style={{ marginTop: 24 }}>Reading</h2>

      <div className="field">
        <label className="field__label" htmlFor="tz">Timezone</label>
        <select id="tz" value={draft.timeZone} onChange={(e) => update('timeZone', e.target.value)}>
          {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="hour">Each night opens at</label>
        <select
          id="hour"
          value={draft.rolloverHour}
          onChange={(e) => update('rolloverHour', Number(e.target.value))}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`}
            </option>
          ))}
        </select>
        <p className="field__hint">
          Everything read between this hour and the same hour tomorrow counts as one night.
        </p>
      </div>

      <div className="field">
        <label className="field__label">Theme</label>
        <div className="filters">
          <button className={`chip${theme === 'dark' ? ' chip--on' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
          <button className={`chip${theme === 'light' ? ' chip--on' : ''}`} onClick={() => setTheme('light')}>Light</button>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="scale">Reading size</label>
        <input
          id="scale" type="range" min={0.85} max={1.5} step={0.05}
          value={draft.fontScale}
          onChange={(e) => update('fontScale', Number(e.target.value))}
        />
      </div>

      <h2 className="night__label" style={{ marginTop: 28 }}>Durability</h2>
      <p className="field__hint" style={{ marginTop: -6, marginBottom: 16 }}>
        Every tap is saved on this device first, then committed to GitHub behind it.
        Without a token the count lives only on this phone.
      </p>

      <div className="field">
        <label className="field__label" htmlFor="token">Fine-grained access token</label>
        <input
          id="token" type="password" autoComplete="off" placeholder="github_pat_…"
          value={draft.token ?? ''}
          onChange={(e) => update('token', e.target.value.trim())}
        />
        <p className="field__hint">
          Scope it to this one repository, Contents: read and write. Nothing else is needed.
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="owner">Owner</label>
        <input id="owner" value={draft.owner} onChange={(e) => update('owner', e.target.value.trim())} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="repo">Repository</label>
        <input id="repo" value={draft.repo} onChange={(e) => update('repo', e.target.value.trim())} />
        <p className="field__hint">
          Point this at a private repository if you would rather the reading log not be public.
        </p>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="branch">Branch</label>
        <input id="branch" value={draft.branch} onChange={(e) => update('branch', e.target.value.trim())} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="path">File</label>
        <input id="path" value={draft.path} onChange={(e) => update('path', e.target.value.trim())} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 }}>
        <button className="button" disabled={busy} onClick={() => run('Sync', app.syncNow)}>
          Sync now
        </button>
        <button className="button button--quiet" disabled={busy} onClick={() => run('Restore', app.restoreNow)}>
          Restore from GitHub
        </button>
      </div>

      <h2 className="night__label">Backup</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="button button--quiet" onClick={exportJson}>Export</button>
        <button className="button button--quiet" onClick={() => fileRef.current?.click()}>Import</button>
        <input
          ref={fileRef} type="file" accept="application/json" hidden
          onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])}
        />
      </div>
      <p className="field__hint" style={{ marginTop: 10, marginBottom: 32 }}>
        Import merges rather than replaces, so a stale backup can never shorten your count.
      </p>
    </>
  )
}
