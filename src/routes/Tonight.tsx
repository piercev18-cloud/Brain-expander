import { readingMinutes, readingTime } from '../lib/corpus'
import { isComplete } from '../lib/progress'
import { FIELD_LABEL, FORMS, FORM_LABEL, type Form, type IndexEntry } from '../lib/types'
import { Counter } from '../ui/Counter'
import { Check } from '../ui/icons'
import type { App } from '../lib/useApp'

function Card({
  entry, form, done, onToggle, onOpen,
}: {
  entry: IndexEntry | undefined
  form: Form
  done: boolean
  onToggle: () => void
  onOpen: () => void
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
      <button className="card__body" onClick={onOpen} style={{ background: 'none', border: 0, padding: 0 }}>
        <div className="card__form">{FORM_LABEL[form]}</div>
        <div className="card__title">{entry.title}</div>
        <div className="card__author">
          {entry.author}
          {entry.year ? ` · ${entry.year}` : ''}
        </div>
        <div className="card__meta">
          {readingTime(entry.words) && <span>{readingTime(entry.words)}</span>}
          {entry.fields.slice(0, 2).map((f) => (
            <span className="tag" key={f}>{FIELD_LABEL[f]}</span>
          ))}
          {entry.mode === 'link' && <span className="tag">links out</span>}
        </div>
      </button>
    </div>
  )
}

export function Tonight({ app, onOpen }: { app: App; onOpen: (id: string) => void }) {
  const record = app.progress.nights[app.todayKey]
  const complete = isComplete(record)
  const remaining = FORMS.filter((f) => !record?.done.includes(f)).length

  // What is actually left to read tonight, so the ask is never a surprise.
  const minutesLeft = FORMS.reduce((total, form) => {
    if (record?.done.includes(form)) return total
    const id = app.dealt[form]
    const entry = id ? app.byId.get(id) : undefined
    return total + (entry?.words ? readingMinutes(entry.words) : 0)
  }, 0)

  return (
    <>
      <Counter stats={app.stats} msToRollover={app.msToRollover} syncState={app.syncState} />

      {app.error && <div className="status status--error" style={{ marginTop: 16 }}>{app.error}</div>}

      <section className="night">
        <h1 className="night__label">
          {complete
            ? 'Tonight — done'
            : `Tonight — ${remaining} to go${minutesLeft > 0 ? ` · about ${minutesLeft} min` : ''}`}
        </h1>
        {FORMS.map((form) => {
          const id = app.dealt[form]
          return (
            <Card
              key={form}
              form={form}
              entry={id ? app.byId.get(id) : undefined}
              done={!!record?.done.includes(form)}
              onToggle={() => app.toggleDone(form)}
              onOpen={() => id && onOpen(id)}
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
