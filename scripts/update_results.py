#!/usr/bin/env python3
"""
Auto-updates STATIC_RESULTS in index.html with all finished World Cup matches.
Runs in GitHub Actions every 3 hours.
"""
import json, os, re, urllib.request, urllib.error, sys
from datetime import datetime, timezone

FDORG_KEY = os.environ.get('FDORG_KEY', '')
TODAY = datetime.now(timezone.utc).strftime('%Y-%m-%d')

# ── Team name mapping: football-data.org names → Spanish names used in FIXTURES ──
TEAM_MAP = {
    'Mexico': 'Mexico',
    'South Korea': 'Corea del Sur',
    'South Africa': 'Sudáfrica',
    'Czech Republic': 'República Checa',
    'Bosnia and Herzegovina': 'Bosnia-Herzegovina',
    'Switzerland': 'Suiza',
    'Brazil': 'Brasil',
    'Morocco': 'Marruecos',
    'Haiti': 'Haiti',
    'Scotland': 'Escocia',
    'United States': 'Estados Unidos',
    'Paraguay': 'Paraguay',
    'Australia': 'Australia',
    'Turkey': 'Turquía',
    'Türkiye': 'Turquía',
    'Germany': 'Alemania',
    "Côte d'Ivoire": 'Costa de Marfil',
    'Ecuador': 'Ecuador',
    'Netherlands': 'Países Bajos',
    'Japan': 'Japón',
    'Sweden': 'Suecia',
    'Tunisia': 'Túnez',
    'Belgium': 'Bélgica',
    'Egypt': 'Egipto',
    'Iran': 'Iran',
    'New Zealand': 'Nueva Zelanda',
    'Spain': 'España',
    'Uruguay': 'Uruguay',
    'Saudi Arabia': 'Arabia Saudita',
    'Cape Verde': 'Cabo Verde',
    'France': 'Francia',
    'Senegal': 'Senegal',
    'Iraq': 'Iraq',
    'Norway': 'Noruega',
    'Argentina': 'Argentina',
    'Algeria': 'Argelia',
    'Austria': 'Austria',
    'Jordan': 'Jordania',
    'Portugal': 'Portugal',
    'Colombia': 'Colombia',
    'DR Congo': 'Congo DR',
    'Uzbekistan': 'Uzbekistan',
    'England': 'Inglaterra',
    'Croatia': 'Croacia',
    'Ghana': 'Ghana',
    'Panama': 'Panamá',
    'Curacao': 'Curaçao',
    'Canada': 'Canada',
    'Qatar': 'Qatar',
}

def norm(name):
    return TEAM_MAP.get(name, name)

# ── Extract FIXTURES from index.html to build a lookup table ──
def load_fixtures(html):
    fixtures = {}
    # Match lines like: {id:7, g:"B",h:"Canada", a:"Bosnia-Herzegovina",utc:"...",v:"..."},
    for m in re.finditer(r'\{id:(\d+),\s*g:"[^"]+",\s*h:"([^"]+)",\s*a:"([^"]+)",\s*utc:"([^"]+)"', html):
        fid = int(m.group(1))
        fixtures[fid] = {
            'id': fid,
            'h': m.group(2).strip(),
            'a': m.group(3).strip(),
            'utc': m.group(4),
        }
    return fixtures

def fetch_completed_matches():
    """Fetch all finished matches from football-data.org"""
    url = f'https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-06-11&dateTo={TODAY}'
    req = urllib.request.Request(url, headers={'X-Auth-Token': FDORG_KEY})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())['matches']
    except Exception as e:
        print(f'ERROR fetching from football-data.org: {e}', file=sys.stderr)
        return []

def build_static_results(matches, fixtures):
    """Map API matches to fixture IDs, return dict of results"""
    results = {}
    # Build reverse lookup: (home_es, away_es) -> fixture_id
    lookup = {}
    for fid, fix in fixtures.items():
        lookup[(fix['h'], fix['a'])] = fid

    for m in matches:
        status = m.get('status', '')
        if status not in ('FINISHED', 'AWARDED'):
            continue
        h_raw = m.get('homeTeam', {}).get('name') or m.get('homeTeam', {}).get('shortName', '')
        a_raw = m.get('awayTeam', {}).get('name') or m.get('awayTeam', {}).get('shortName', '')
        h_es = norm(h_raw)
        a_es = norm(a_raw)
        hs = m['score']['fullTime'].get('home', 0) or 0
        as_ = m['score']['fullTime'].get('away', 0) or 0

        fid = lookup.get((h_es, a_es)) or lookup.get((a_es, h_es))
        if fid is None:
            print(f'  WARNING: no fixture match for "{h_es}" vs "{a_es}" (raw: "{h_raw}" vs "{a_raw}")', file=sys.stderr)
            continue

        # If teams were swapped (our fixture has them reversed), swap scores
        fix = fixtures[fid]
        if fix['h'] == a_es:
            hs, as_ = as_, hs

        results[fid] = {'hs': hs, 'as': as_}
        print(f'  ✓ id:{fid} {fix["h"]} {hs}-{as_} {fix["a"]}')

    return results

def format_static_results(results):
    """Render STATIC_RESULTS JS object"""
    if not results:
        return 'const STATIC_RESULTS = {};\n'
    lines = ['const STATIC_RESULTS = {']
    for fid in sorted(results.keys()):
        r = results[fid]
        lines.append(f"  {fid}: {{hs:{r['hs']}, as:{r['as']}, status:'ft', src:'auto'}},")
    lines.append('};')
    return '\n'.join(lines) + '\n'

def update_html(html, new_block):
    """Replace the STATIC_RESULTS block in index.html"""
    pattern = r'const STATIC_RESULTS = \{.*?\};\n'
    if not re.search(pattern, html, re.DOTALL):
        print('ERROR: could not find STATIC_RESULTS in index.html', file=sys.stderr)
        sys.exit(1)
    return re.sub(pattern, new_block, html, flags=re.DOTALL)

# ── Main ──
print(f'Fetching completed WC matches up to {TODAY}...')
html = open('index.html', encoding='utf-8').read()
fixtures = load_fixtures(html)
print(f'  Loaded {len(fixtures)} fixtures from index.html')

matches = fetch_completed_matches()
print(f'  Got {len(matches)} finished matches from API')

results = build_static_results(matches, fixtures)
print(f'  Mapped {len(results)} results to fixtures')

if not results:
    print('No results to write, exiting.')
    sys.exit(0)

new_block = format_static_results(results)
new_html = update_html(html, new_block)
open('index.html', 'w', encoding='utf-8').write(new_html)
print(f'Done. Updated STATIC_RESULTS with {len(results)} entries.')
