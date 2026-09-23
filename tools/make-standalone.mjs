/**
 * Build the app as one self-contained HTML file: styles, bundle and corpus all inline,
 * no module script and no relative fetches. For hosts that serve the page from a path
 * not known at build time, or in a frame where neither can be relied on.
 *
 *   node tools/make-standalone.mjs [outdir]
 *
 * Writes two forms of the same page:
 *   standalone.html  a complete document, openable from disk or any host
 *   fragment.html    content only, for a host that supplies its own document skeleton
 *
 * The difference is the charset declaration. Without one, a host that serves HTML with
 * no charset renders every em dash and curly quote as mojibake, so the standalone form
 * declares it rather than trusting the host.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const outDir = process.argv[2] ?? 'dist-preview'
const dir = mkdtempSync(join(tmpdir(), 'standalone-'))

execFileSync('npx', ['vite', 'build', '--outDir', dir, '--emptyOutDir'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_BASE: './',
    APP_PWA: 'off',
    APP_IIFE: '1',
    VITE_PREVIEW: '1',
  },
})

const assets = readdirSync(join(dir, 'assets'))
const jsFile = assets.find((f) => f.endsWith('.js'))
if (!jsFile) throw new Error('no bundle produced')
const js = readFileSync(join(dir, 'assets', jsFile), 'utf8')

// In a classic-script build Vite folds the stylesheet into the bundle, which injects
// it at runtime. Only pick one up if it was emitted separately.
const cssFile = assets.find((f) => f.endsWith('.css'))
const css = cssFile ? readFileSync(join(dir, 'assets', cssFile), 'utf8') : ''

const corpusDir = join('public', 'corpus')
const index = JSON.parse(readFileSync(join(corpusDir, 'index.json'), 'utf8'))
const items = {}
for (const file of readdirSync(join(corpusDir, 'items'))) {
  const item = JSON.parse(readFileSync(join(corpusDir, 'items', file), 'utf8'))
  items[item.id] = item
}

// </script> inside embedded JSON would close the tag early.
const safe = (value) => JSON.stringify(value).replace(/<\//g, '<\\/')

const head = `<title>A Thousand Nights</title>
${css ? `<style>\n${css}\n</style>` : ''}`

const bodyContent = `<script>
  // Set the theme before first paint: a bedtime app must never flash white.
  try {
    var t = localStorage.getItem('tn:theme');
    document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark';
  } catch (e) {}
  window.__CORPUS__ = { index: ${safe(index)}, items: ${safe(items)} };
</script>
<div id="root"></div>
<script>
${js}
</script>
`

// The Artifact frame supplies the document skeleton, so that form is content only.
const fragment = `${head}\n${bodyContent}`

const document = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141311">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<style>html,body{margin:0;height:100%}</style>
${head}
</head>
<body>
${bodyContent}</body>
</html>
`

writeFileSync(join(outDir, 'standalone.html'), document)
writeFileSync(join(outDir, 'fragment.html'), fragment)
rmSync(dir, { recursive: true, force: true })
console.log(
  `standalone.html ${(document.length / 1024).toFixed(0)} KB · ` +
  `fragment.html ${(fragment.length / 1024).toFixed(0)} KB · ${index.length} pieces embedded`,
)
