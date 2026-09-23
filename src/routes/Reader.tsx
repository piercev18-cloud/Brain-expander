import { useEffect, useState } from 'react'
import { isRedistributable, loadItem, readingTime } from '../lib/corpus'
import { FIELD_LABEL, FORMS, FORM_LABEL, type Form, type Item } from '../lib/types'
import { Bookmark, Check, External } from '../ui/icons'
import type { App } from '../lib/useApp'

export function Reader({ app, id, onBack }: { app: App; id: string; onBack: () => void }) {
  const [item, setItem] = useState<Item | null>(null)
  const [failed, setFailed] = useState<string>()

  useEffect(() => {
    let live = true
    setItem(null)
    setFailed(undefined)
    loadItem(id)
      .then((loaded) => live && setItem(loaded))
      .catch((error: Error) => live && setFailed(error.message))
    window.scrollTo(0, 0)
    return () => {
      live = false
    }
  }, [id])

  const record = app.progress.nights[app.todayKey]
  // A piece is checkable from the reader only when it is one of tonight's three.
  const slot = FORMS.find((form) => app.dealt[form] === id)
  const done = !!(slot && record?.done.includes(slot))
  const saved = app.progress.saved.some((s) => s.id === id)

  if (failed) {
    return (
      <div className="reader">
        <button className="reader__back" onClick={onBack}>&larr; Back</button>
        <div className="status status--error">{failed}</div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="reader">
        <button className="reader__back" onClick={onBack}>&larr; Back</button>
        <p className="empty">Opening…</p>
      </div>
    )
  }

  const paragraphs = (item.body ?? '').split(/\n{2,}/).filter((p) => p.trim().length > 0)

  return (
    <div className="reader" style={{ ['--font-scale' as string]: app.settings.fontScale }}>
      <button className="reader__back" onClick={onBack}>&larr; Back</button>

      <div className="reader__form">{FORM_LABEL[item.form]}</div>
      <h1 className="reader__title">{item.title}</h1>
      <div className="reader__byline">
        {item.author}
        {item.year ? ` · ${item.year}` : ''}
      </div>
      <div className="reader__meta">
        {readingTime(item.form, item.words) && (
          <span className="tag">{readingTime(item.form, item.words)}</span>
        )}
        {item.fields.map((f) => (
          <span className="tag" key={f}>{FIELD_LABEL[f]}</span>
        ))}
        <span className="tag">{item.license}</span>
      </div>

      {item.mode === 'full' ? (
        <div className={`prose${item.form === 'poem' ? ' prose--verse' : ''}`}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : (
        <div className="linkout">
          <p className="linkout__summary">{item.summary}</p>
          <a className="button" href={item.url} target="_blank" rel="noreferrer noopener">
            Read at the source <External />
          </a>
          <p className="field__hint" style={{ marginTop: 14 }}>
            {isRedistributable(item.license)
              ? 'The full text is public domain but has not been fetched into the app yet. Run the corpus workflow and it will read here.'
              : 'This piece is under copyright, so it is read at its publisher rather than stored here.'}
          </p>
        </div>
      )}

      <div className="reader__actions">
        <button
          className={`icon-button${saved ? ' icon-button--on' : ''}`}
          onClick={() => app.toggleSaved(id)}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save this piece'}
        >
          <Bookmark filled={saved} />
        </button>
        {slot ? (
          <button
            className={done ? 'button button--quiet' : 'button'}
            onClick={() => {
              app.toggleDone(slot as Form)
              if (!done) onBack()
            }}
          >
            {done ? 'Read' : 'Mark as read'} {done && <Check />}
          </button>
        ) : (
          <span className="field__hint" style={{ flex: 1, textAlign: 'center' }}>
            From an earlier night
          </span>
        )}
      </div>
    </div>
  )
}
