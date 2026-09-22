import { useEffect, useState } from 'react'
import { Fields } from './routes/Fields'
import { Reader } from './routes/Reader'
import { Saved } from './routes/Saved'
import { Settings } from './routes/Settings'
import { Tonight } from './routes/Tonight'
import { Bars, Bookmark, Gear, Moon } from './ui/icons'
import { useApp } from './lib/useApp'

/** Hash routing: GitHub Pages has no rewrite rules, so a refresh must never 404. */
function useRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1) || '/')
  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

const TABS = [
  { href: '#/', label: 'Tonight', Icon: Moon },
  { href: '#/saved', label: 'Saved', Icon: Bookmark },
  { href: '#/fields', label: 'Fields', Icon: Bars },
  { href: '#/settings', label: 'Settings', Icon: Gear },
] as const

export function App() {
  const app = useApp()
  const route = useRoute()

  const open = (id: string) => {
    window.location.hash = `#/read/${id}`
  }
  const back = () => window.history.back()

  if (!app.ready) return <div className="app" />

  const reading = route.startsWith('/read/') ? decodeURIComponent(route.slice('/read/'.length)) : null
  const tab = reading ? '' : route

  return (
    <>
      <main className="app">
        {reading ? (
          <Reader app={app} id={reading} onBack={back} />
        ) : route === '/saved' ? (
          <Saved app={app} onOpen={open} />
        ) : route === '/fields' ? (
          <Fields app={app} />
        ) : route === '/settings' ? (
          <Settings app={app} />
        ) : (
          <Tonight app={app} onOpen={open} />
        )}
      </main>

      <nav className="nav">
        {TABS.map(({ href, label, Icon }) => (
          <a key={href} href={href} aria-current={tab === href.slice(1) ? 'page' : undefined}>
            <Icon />
            {label}
          </a>
        ))}
      </nav>
    </>
  )
}
