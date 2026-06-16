# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A single-file static web app for FIFA World Cup 2026 live scores. The entire frontend lives in **`index.html`** (~2100 lines of embedded CSS + vanilla JS). There is no build step, no npm, no framework — the file is deployed directly to GitHub Pages. A Python + GitHub Actions backend handles automated score updates every 30 minutes.

## Running Tests

```bash
node tests/scoring.test.js
```

No test framework is used. The test file contains a hand-rolled runner (`test()`/`expect()`) and runs directly in Node.js. All other files are linted/tested manually.

## Architecture

### The Single-File Pattern

`index.html` is structured in clear sections (marked with `═══` block comments):

- **`<style>`** — All CSS (dark/light theme via CSS variables, mobile-first)
- **DATA** (~line 600) — `GROUPS`, `FLAGS`, `FIXTURES` (72 fixtures), `BRACKET_ROUNDS`, `STATIC_RESULTS`
- **STATE** (~line 800) — Global mutable state: `liveData`, `standings`, `bracketData`, `favTeams`, `curPage`
- **ESPN FEED / FDORG FEED** (~line 820) — Fetch + normalization functions
- **SCORING** (~line 1030) — `buildStandings()`, `getQualStatus()`
- **RENDER** (~line 1140) — DOM manipulation functions: `renderAll()`, `renderScores()`, `renderGroups()`, etc.
- **EVENT HANDLERS / INIT** (~line 1850) — Tab switching, theme toggle, polling logic

### Data Flow

1. **`STATIC_RESULTS`** (embedded in `index.html`) is the offline baseline — `{fixtureId: {hs, as, status, src}}`
2. On load, `liveData = Object.assign({}, STATIC_RESULTS)` copies static results into mutable state
3. **`fetchScores()`** calls football-data.org (primary, auth required) or ESPN (fallback, no auth), then calls `buildStandings()` and `renderAll()`
4. **`buildStandings()`** recalculates group tables from `FIXTURES` + `liveData` from scratch on every call
5. **`renderAll()`** dispatches to per-tab render functions based on `curPage`

### Live Score Sources

- **Primary**: `https://api.football-data.org/v4/competitions/WC/matches` — requires `X-Auth-Token: FDORG_KEY` header. Processed by `processFDOrg()`.
- **Fallback**: ESPN public API at `site.api.espn.com` — no auth, processed by `processESPN()`.

Both sources normalize team names to match the Spanish names used in `FIXTURES` (e.g., `"Brazil"` → `"Brasil"`). The `NORM` object handles ESPN→Spanish mapping; `TEAM_MAP` in `update_results.py` handles football-data.org→Spanish.

### Automated Updates

`.github/workflows/update-results.yml` runs `scripts/update_results.py` every 30 minutes. The script:
1. Fetches finished matches from football-data.org
2. Parses fixture IDs from `index.html` via regex (matching on team names)
3. Overwrites the `STATIC_RESULTS = { ... }` block in `index.html` in place
4. Commits and pushes if anything changed

`PERMANENT` dict in `update_results.py` holds hand-verified fallback results the API misses — these are never overwritten.

### Knockout Bracket

`BRACKET_ROUNDS` defines the static bracket structure. `bracketData` (keyed by match ID like `'r32_1'`) stores results. Once groups complete, `populateBracket()` fills in team names from standings. Bracket winners propagate forward as each round resolves.

### Favorites & Persistence

`favTeams` (max 3 teams) persists via `localStorage` key `wc26_favs`. All times display in ART (UTC-3, `America/Argentina/Buenos_Aires`).

## Known Bugs (Documented in Tests)

`tests/scoring.test.js` documents **5 known bugs** in `index.html` that tests deliberately preserve to track:

1. **`getQualStatus()` off-by-one**: uses `(2 - row.p)` instead of `(3 - row.p)` — causes premature elimination display
2. **`NORM` maps to English**: ESPN names map to English team names that don't match Spanish FIXTURES
3. **`FDORG_NORM` uses accents**: maps to accented names (`México`, `Canadá`) that don't exist in FIXTURES
4. **`fetchWithTimeout()` drops headers**: 3rd `headers` argument is declared but ignored — auth header never sent to football-data.org from browser
5. **`processESPN()` data loss**: wipes all `liveData` before adding ESPN results, losing results for non-today matches

When fixing bugs, check `tests/scoring.test.js` first — the test file may already describe the fix.

## Key Conventions

- **All UI text is in Spanish** — team names, labels, tabs, messages
- **Fixture team names are canonical**: the exact strings in `FIXTURES[].h` and `FIXTURES[].a` (Spanish) are the source of truth; all API normalization must map to these
- **No build tools**: do not introduce npm, bundlers, or transpilers
- **No external JS libraries**: keep it vanilla
- **GitHub Secret `FDORG_KEY`**: the football-data.org API token; never hardcode a new value — the one in `index.html` is public-facing and rate-limited

## Deployment

Push to `main` → GitHub Pages auto-deploys `index.html` from the repo root. The Actions bot commits directly to `main` for score updates.
