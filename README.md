# A Thousand Nights

> "For the next thousand nights, before you go to bed every night, read one short
> story... one poem a night, one short story a night, one essay a night, for the next
> 1,000 nights. From various fields: archaeology, zoology, biology, all the great
> philosophers of time... at the end of a thousand nights, Jesus God, you'll be full
> of stuff, won't you?"
>
> — Ray Bradbury

A reader that picks the three, puts them in front of you, and keeps the count.

## How it works

Each night opens at **6pm** in your timezone. Reading at 11pm and at 1am are the same
night, so the boundary never punishes you for staying up. Check off all three and the
counter goes up one, toward 1000. A separate streak tracks consecutive nights and can
break without touching the total — **the count never goes backwards.**

The three are dealt from the corpus by a seeded draw, so a refresh never re-rolls them,
and nothing repeats across all 1000 nights. A night you open but do not finish returns
its pieces to the pool: skipping a night costs you nothing.

**Curation, not rationing.** Length is never a reason a piece is kept out: a 45-minute
essay you want to read is worth more than a 12-minute one you do not. Time is handled at
deal time instead, visibly, by you — in `src/lib/curation.ts`.

Tonight states its own length up front, estimated per form: prose at 220 words a minute,
verse at 90, because a poem is read slowly and usually twice. Settings carries a soft
target (default 30 minutes, with **No target** as a real option) which decides exactly
one thing: when the app offers a swap.

When a night runs past the target, the app names the single heaviest *unread* piece and
offers something shorter, or "Read it anyway" — it never suggests trimming the poem,
because that saves nothing. Every card also carries a Swap control for a piece that
simply is not tonight's. A piece you pass over is recorded, not lost: it stays out of
tonight's redraws and returns to the pool for a night with more time.

Two details that matter in use. Swaps are deterministic in how many you have already
made, so the offer survives a reload instead of gambling again. And asking for something
shorter when nothing shorter exists says so, rather than quietly handing you something
longer.

Flag anything worth returning to and it lands in **Saved**, with a note if you want one.
**Fields** shows where your reading actually concentrates — bars scaled against your
most-read field, and a plain list of the fields you have never once touched.

## Architecture

The only infrastructure is a phone and GitHub.

```
GitHub Actions ──▶ public/corpus/*.json ──▶ GitHub Pages ──▶ your phone
  (all network work,      committed to        static hosting     PWA, reads
   all API keys)          the repository                         local-first

                          your phone ──▶ state branch: state/progress.json
                          (writes locally first, syncs behind it)
```

Nothing is fetched from a publisher at runtime. That sidesteps CORS, rate limits, keys
and link rot in one move, and makes the repository itself the permanent archive of the
1000 nights.

**Writes never block on the network.** A check-off goes to IndexedDB and returns
immediately, then syncs to GitHub behind it — a commit on a dedicated `state` branch, so
a thousand nightly commits never touch `main` or trigger a rebuild. When two devices
diverge, the two records are union-merged rather than overwritten, and the count is
always recomputed from the nights themselves. Losing a check-off to a clobbering write is
the one failure this app is built to make impossible.

## Setup

1. **Enable Pages** — Settings → Pages → Source: **GitHub Actions**. Push to `main` and
   the app deploys to `https://<you>.github.io/Brain-expander/`.
2. **Add it to your home screen** from Safari. It runs full-screen and reads offline.
3. **Create a token** at Settings → Developer settings → Fine-grained personal access
   tokens. Scope it to this one repository, **Repository permissions → Contents: Read and
   write**. Nothing else. Paste it into the app's Settings once.

   > On a free account Pages requires a public repository, so your reading log is public
   > by default. The app's Settings let you point progress at a different (private)
   > repository — no code change needed.

4. **Optional API keys**, as repository secrets under Settings → Secrets and variables →
   Actions. Every one is optional; a missing secret skips that source with a warning
   rather than failing the run.

   | Secret | Where | What it adds |
   |---|---|---|
   | `CONTACT_EMAIL` | your email | Politeness contact for Wikisource, OpenAlex and Crossref. Not a key; it just earns better rate limits. |
   | `GUARDIAN_API_KEY` | [open-platform.theguardian.com/access](https://open-platform.theguardian.com/access/) | Modern long-form essays across every field, well tagged. |
   | `CORE_API_KEY` | [core.ac.uk/services/api](https://core.ac.uk/services/api) | Open-access academic writing. |
   | `DPLA_API_KEY` | [pro.dp.la/developers/api-codex](https://pro.dp.la/developers/api-codex) | Archival and historical material. |

## The corpus

Sources, all free, most needing no key at all:

| Slot | Full text in-app | Read at the source |
|---|---|---|
| Poem | PoetryDB, Wikisource, Gutenberg | — |
| Short story | Wikisource, Gutenberg | Clarkesworld, Strange Horizons, Reactor |
| Essay | Wikisource, Gutenberg | The Guardian, Aeon, Nautilus, Quanta, The Marginalian |

A piece read at the source still needs a knowable length, or the app could not estimate
the night honestly: The Guardian reports a word count, and the RSS feeds carry the full
article in `content:encoded`. A feed item whose length cannot be established is dropped
rather than shown with no reading time at all.

**arXiv is included but off by default.** A research paper has no upper bound on length
and is not a bedtime essay. Run it deliberately with `npm run corpus -- --only arxiv` if
you want it. Mathematics and physics otherwise arrive through Quanta, Gutenberg's
mathematics and astronomy topics, and Wikisource's science categories.

**The licence rule is enforced in code.** Full text is stored only when a piece is public
domain or CC-BY/CC-BY-SA. Everything else is kept as metadata plus the publisher's own
summary and a link, and the build fails outright if any item claims full text without a
redistributable licence. This is why The Guardian appears as a link-out: the API does
return body text and the developer tier covers using it, but committing that text into a
public repository is republication, which the tier does not cover.

The starter corpus committed here is 12 hand-checked pieces — ten poems in full, two
stories linked — enough to open the app and see it work. The essay slot is empty until
the corpus workflow runs, which happens automatically on the first push to `main`.

**Field tagging is deterministic, not model-based** — subject headings, arXiv categories
and per-feed mappings run through a keyword table in `tools/corpus/tag.ts`. Reproducible,
and a mistake is fixed by adding one line to `tools/corpus/overrides.json`.

## Commands

```bash
npm run dev                      # local dev server
npm test                         # night boundaries, deal determinism, merge safety, estimates
npm run build                    # production build
npm run corpus -- --dry-run      # collect and validate, write nothing
npm run corpus -- --limit 40     # cap each source
npm run corpus -- --only feeds   # run one source
CORPUS_TIMEOUT_MS=1500 npm run corpus -- --dry-run   # fail fast on a restricted network
npx tsx tools/corpus/bootstrap.ts   # the small starter corpus
node tools/make-icons.mjs           # regenerate app icons

# One self-contained HTML file: bundle, styles and corpus all inline, as a classic
# script with no network requests after load. Writes standalone.html (a complete
# document, openable straight from disk) and fragment.html (content only, for a host
# that supplies its own skeleton). Both hide the GitHub and backup controls, since a
# preview has no durable store and offering them dead would be worse.
node tools/make-standalone.mjs
```

The corpus builder needs network access to the sources, so it is meant to run in Actions
— locally it will only reach whatever your network allows.
