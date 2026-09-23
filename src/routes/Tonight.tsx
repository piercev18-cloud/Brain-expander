import { useState } from 'react'
import { formatMinutes } from '../lib/curation'
import { isComplete } from '../lib/progress'
import { FIELD_LABEL, FORMS, FORM_LABEL, type Form, type IndexEntry } from '../lib/types'
import { Counter } from '../ui/Counter'
import { Check, Swap } from '../ui/icons'
import type { App } from '../lib/useApp'

function Card({
  entry, form, done, minutes, onToggle, onOpen, onSwap,
}: {
  entry: IndexEntry | undefined
  form: Form
  done: boolean
  minutes?: number
  onToggle: () => void
  onOpen: () => void
  onSwap: () => void
}) {
  if (!entry) {
    return (
      <div className="card">
        <div className="card__body">
          <div className="card__form">{FORM_LABEL[form]}</div>
          <div className="card__title">Nothing in the corpus yet</div>
          <div className="card__author">Run the corpus workflow to fill this slot.</div>
        </div>
      </div>
    )
  }
  return (
    <div className={`card${done ? ' card--done' : ''}`}>
      <button
        className={`tick${done ? ' tick--on' : ''}`}
        onClick={onToggle}
        aria-pressed={done}
        aria-label={done ? `Mark ${entry.title} unread` : `Mark ${entry.title} read`}
      >
        {done && <Check />}
      </button>
      <div className="card__body">
        <button className="card__open" onClick={onOpen}>
          <div className="card__form">{FORM_LABEL[form]}</div>
          <div className="card__title">{entry.title}</div>
          <div className="card__author">
            {entry.author}
            {entry.year ? ` · ${entry.year}` : ''}
          </div>
        </button>
        <div className="card__meta">
          {minutes ? <span>{formatMinutes(minutes)}</span> : null}
          {entry.fields.slice(0, 2).map((f) => (
            <span className="tag" key={f}>{FIELD_LABEL[f]}</span>
          ))}
          {entry.mode === 'link' && <span className="tag">links out</span>}
          {!done && (
            <button className="swap" onClick={onSwap} title="Take a different piece for this slot">
              <Swap /> Swap
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Tonight({ app, onOpen }: { app: App; onOpen: (id: string) => void }) {
  const [dismissed, setDismissed] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const record = app.progress.nights[app.todayKey]
  const complete = isComplete(record)
  const remaining = FORMS.filter((f) => !record?.done.includes(f)).length
  const { estimate, suggestSwap } = app

  const trySwap = (form: Form, shorterOnly: boolean) => {
    setNote(
      app.swap(form, shorterOnly)
        ? null
        : shorterOnly
          ? 'Nothing shorter left in that slot tonight.'
          : 'Nothing else left in that slot tonight.',
    )
  }

  return (
    <>
      <Counter stats={app.stats} msToRollover={app.msToRollover} syncState={app.syncState} />

      {app.error && <div className="status status--error" style={{ marginTop: 16 }}>{app.error}</div>}

      <section className="night">
        <h1 className="night__label">
          {complete
            ? 'Tonight — done'
            : `Tonight — ${remaining} to go${estimate.remaining > 0 ? ` · about ${formatMinutes(estimate.remaining)}` : ''}`}
        </h1>

        {suggestSwap && !dismissed && !complete && (
          <div className="nudge">
            <p className="nudge__text">
              Tonight runs about <b>{formatMinutes(estimate.remaining)}</b>, more than the{' '}
              {formatMinutes(app.settings.nightlyMinutes!)} you usually have. The{' '}
              {FORM_LABEL[suggestSwap].toLowerCase()} is{' '}
              <b>{formatMinutes(estimate.perSlot[suggestSwap] ?? 0)}</b> of it.
            </p>
            <div className="nudge__actions">
              <button className="button" onClick={() => trySwap(suggestSwap, true)}>
                Something shorter
              </button>
              <button className="button button--quiet" onClick={() => setDismissed(true)}>
                Read it anyway
              </button>
            </div>
            <p className="field__hint" style={{ marginTop: 10 }}>
              A piece you pass over is not lost — it goes back in the pool for a night you have more time.
            </p>
          </div>
        )}

        {note && <div className="status" style={{ marginTop: 14 }}>{note}</div>}

        {FORMS.map((form) => {
          const id = app.dealt[form]
          return (
            <Card
              key={form}
              form={form}
              entry={app.entries[form]}
              done={!!record?.done.includes(form)}
              minutes={estimate.perSlot[form]}
              onToggle={() => app.toggleDone(form)}
              onOpen={() => id && onOpen(id)}
              onSwap={() => trySwap(form, false)}
            />
          )
        })}

        {complete && (
          <p className="done-note">
            Night <b>{app.stats.nightsCompleted}</b> of 1000. That is one poem, one story and one
            essay more than yesterday. Come back after 6pm for three more.
          </p>
        )}
      </section>
    </>
  )
}
