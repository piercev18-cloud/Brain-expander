import { useMemo, useState } from 'react'
import { readingTime } from '../lib/corpus'
import { FIELDS, FIELD_LABEL, FORMS, FORM_LABEL, type Field, type Form } from '../lib/types'
import type { App } from '../lib/useApp'

export function Saved({ app, onOpen }: { app: App; onOpen: (id: string) => void }) {
  const [form, setForm] = useState<Form | 'all'>('all')
  const [field, setField] = useState<Field | 'all'>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return app.progress.saved
      .map((saved) => ({ saved, entry: app.byId.get(saved.id) }))
      .filter((row): row is { saved: typeof row.saved; entry: NonNullable<typeof row.entry> } => !!row.entry)
      .filter(({ entry }) => form === 'all' || entry.form === form)
      .filter(({ entry }) => field === 'all' || entry.fields.includes(field))
      .filter(({ entry, saved }) =>
        !needle ||
        entry.title.toLowerCase().includes(needle) ||
        entry.author.toLowerCase().includes(needle) ||
        (saved.note ?? '').toLowerCase().includes(needle))
      .reverse()
  }, [app.progress.saved, app.byId, form, field, query])

  // Only offer a field filter for fields actually present among the saved pieces.
  const presentFields = useMemo(() => {
    const present = new Set<Field>()
    for (const saved of app.progress.saved) {
      for (const f of app.byId.get(saved.id)?.fields ?? []) present.add(f)
    }
    return FIELDS.filter((f) => present.has(f))
  }, [app.progress.saved, app.byId])

  return (
    <>
      <h1 className="page-title">Saved</h1>
      <p className="page-sub">
        {app.progress.saved.length === 0
          ? 'Nothing kept yet.'
          : `${app.progress.saved.length} piece${app.progress.saved.length === 1 ? '' : 's'} worth returning to.`}
      </p>

      {app.progress.saved.length > 0 && (
        <>
          <input
            className="search"
            placeholder="Search titles, authors, notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filters">
            <button className={`chip${form === 'all' ? ' chip--on' : ''}`} onClick={() => setForm('all')}>
              All forms
            </button>
            {FORMS.map((f) => (
              <button key={f} className={`chip${form === f ? ' chip--on' : ''}`} onClick={() => setForm(f)}>
                {FORM_LABEL[f]}
              </button>
            ))}
          </div>
          {presentFields.length > 1 && (
            <div className="filters">
              <button className={`chip${field === 'all' ? ' chip--on' : ''}`} onClick={() => setField('all')}>
                All fields
              </button>
              {presentFields.map((f) => (
                <button key={f} className={`chip${field === f ? ' chip--on' : ''}`} onClick={() => setField(f)}>
                  {FIELD_LABEL[f]}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {rows.length === 0 ? (
        <p className="empty">
          {app.progress.saved.length === 0
            ? 'Flag a poem or an essay while you read it and it will wait for you here.'
            : 'Nothing matches that.'}
        </p>
      ) : (
        rows.map(({ saved, entry }) => (
          <div className="card" key={saved.id}>
            <div className="card__body">
              <button
                onClick={() => onOpen(entry.id)}
                style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', width: '100%' }}
              >
                <div className="card__form">{FORM_LABEL[entry.form]}</div>
                <div className="card__title">{entry.title}</div>
                <div className="card__author">{entry.author}{entry.year ? ` · ${entry.year}` : ''}</div>
              </button>
              <div className="card__meta">
                {readingTime(entry.words) && <span>{readingTime(entry.words)}</span>}
                {entry.fields.slice(0, 2).map((f) => (
                  <span className="tag" key={f}>{FIELD_LABEL[f]}</span>
                ))}
              </div>
              {editing === saved.id ? (
                <input
                  className="search"
                  style={{ marginTop: 10, marginBottom: 0 }}
                  autoFocus
                  defaultValue={saved.note ?? ''}
                  placeholder="Why this one?"
                  onBlur={(e) => {
                    app.setNote(saved.id, e.target.value)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              ) : (
                <button
                  onClick={() => setEditing(saved.id)}
                  style={{
                    background: 'none', border: 0, padding: '8px 0 0', textAlign: 'left',
                    color: saved.note ? 'var(--ink-secondary)' : 'var(--ink-muted)',
                    fontSize: 13, fontStyle: saved.note ? 'italic' : 'normal',
                  }}
                >
                  {saved.note || 'Add a note'}
                </button>
              )}
            </div>
            <button
              className="icon-button"
              style={{ width: 36, height: 36 }}
              onClick={() => app.toggleSaved(saved.id)}
              aria-label={`Remove ${entry.title} from saved`}
            >
              ×
            </button>
          </div>
        ))
      )}
    </>
  )
}
