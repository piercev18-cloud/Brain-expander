import { formatCountdown } from '../lib/night'
import { TARGET_NIGHTS } from '../lib/types'
import type { Stats } from '../lib/progress'
import type { SyncState } from '../lib/sync'

const SYNC_LABEL: Record<SyncState, string> = {
  idle: 'Not synced yet',
  syncing: 'Saving to GitHub',
  synced: 'Saved to GitHub',
  offline: 'Offline — will save later',
  unconfigured: 'Saved on this device only',
  error: 'Sync problem',
}

export function Counter({
  stats, msToRollover, syncState,
}: {
  stats: Stats
  msToRollover: number
  syncState: SyncState
}) {
  const pct = (stats.nightsCompleted / TARGET_NIGHTS) * 100
  return (
    <header className="counter">
      <div className="counter__row">
        <span className="counter__n">{stats.nightsCompleted}</span>
        <span className="counter__of">/ {TARGET_NIGHTS} nights</span>
      </div>
      <div className="counter__track">
        <div
          className="counter__fill"
          style={{ width: `${Math.max(pct, stats.nightsCompleted > 0 ? 0.4 : 0)}%` }}
          role="progressbar"
          aria-valuenow={stats.nightsCompleted}
          aria-valuemin={0}
          aria-valuemax={TARGET_NIGHTS}
          aria-label="Nights completed"
        />
      </div>
      <div className="counter__meta">
        <span><b>{stats.currentStreak}</b> night streak</span>
        <span>best <b>{stats.longestStreak}</b></span>
        <span>next in <b>{formatCountdown(msToRollover)}</b></span>
        <span className={`sync-dot sync-dot--${syncState}`}><i />{SYNC_LABEL[syncState]}</span>
      </div>
    </header>
  )
}
