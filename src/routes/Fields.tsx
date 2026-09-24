import { useMemo } from 'react'
import { isComplete } from '../lib/progress'
import { FIELDS, FIELD_LABEL, FORMS, type Field } from '../lib/types'
import type { App } from '../lib/useApp'

/**
 * Ranked magnitude across one measure, so: horizontal bars, one hue, length carries
 * the value and every bar is directly labelled. No legend — a single series needs none.
 * Bars are normalised to the most-read field, which keeps the chart meaningful from
 * night one without inventing a target.
 */
export function Fields({ app }: { app: App }) {
  const counts = useMemo(() => {
    const tally = new Map<Field, number>()
    for (const [, record] of Object.entries(app.progress.nights)) {
      for (const form of FORMS) {
        if (!record.done.includes(form)) continue
        const id = record.dealt[form]
        const entry = id ? app.byId.get(id) : undefined
        for (const field of entry?.fields ?? []) {
          tally.set(field, (tally.get(field) ?? 0) + 1)
        }
      }
    }
    return tally
  }, [app.progress.nights, app.byId])

  const rows = useMemo(
    () =>
      FIELDS.map((field) => ({ field, count: counts.get(field) ?? 0 }))
        .sort((a, b) => b.count - a.count || FIELD_LABEL[a.field].localeCompare(FIELD_LABEL[b.field])),
    [counts],
  )

  const max = rows[0]?.count ?? 0
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const untouched = rows.filter((r) => r.count === 0).length
  const completedNights = Object.values(app.progress.nights).filter(isComplete).length

  return (
    <>
      <h1 className="page-title">Fields</h1>
      <p className="page-sub">
        {total === 0
          ? 'Finish a night and the shape of your reading starts to show.'
          : `${total} tagged piece${total === 1 ? '' : 's'} across ${completedNights} night${completedNights === 1 ? '' : 's'}. ` +
            `${untouched === 0 ? 'Every field touched.' : `${untouched} field${untouched === 1 ? '' : 's'} still untouched.`}`}
      </p>

      <div className="bars">
        {rows.map(({ field, count }) => (
          <div className={`bar${count === 0 ? ' bar--empty' : ''}`} key={field}>
            <div className="bar__head">
              <span className="bar__name">{FIELD_LABEL[field]}</span>
              <span className="bar__value">{count}</span>
            </div>
            <div className="bar__track">
              <div
                className="bar__fill"
                // A zero draws no ink at all: a stub would read as a small nonzero value.
                style={{
                  width: max > 0 ? `${(count / max) * 100}%` : '0%',
                  minWidth: count > 0 ? 3 : 0,
                }}
                role="progressbar"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-label={FIELD_LABEL[field]}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="field__hint" style={{ marginTop: 18 }}>
        Bars are scaled against your most-read field, so the picture is about proportion,
        not a target. A piece tagged with two fields counts once in each.
      </p>
    </>
  )
}
