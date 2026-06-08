#!/usr/bin/env python3
import datetime

# Read metrics written by previous step
try:
    parts = open('/tmp/metrics.txt').read().strip().split('|')
    date,tv,uv,av,as_,t1,t2,t3,t4,t5,t6,t7,r1,r2,r3,r4,r5,r6 = parts
except Exception as e:
    print(f"Could not read metrics: {e}")
    date = datetime.date.today().isoformat()
    tv=uv=av=as_=t1=t2=t3=t4=t5=t6=t7=r1=r2=r3=r4=r5=r6 = '0'

row1 = f"| {date} | {tv} | {uv} | {av} | {as_} |"
row2 = f"| {date} | {t1} | {t2} | {t3} | {t4} | {t5} | {t6} | {t7} |"
row3 = f"| {date} | {r1} | {r2} | {r3} | {r4} | {r5} | {r6} |"

HEADER = """# 📊 Traffic Log — Mundial 2026 by JPF

Actualizado cada dia a las 06:00 UTC.
App: https://jpfiorilli.github.io/worldcup2026

## Metricas diarias
| Fecha | Visitas repo | Unicos | App visits | Shares |
|---|---|---|---|---|

## Uso de tabs
| Fecha | Scores | Grupos | Fixture | Estadios | Bracket | Favs | Config |
|---|---|---|---|---|---|---|---|

## Regiones (timezone del visitante)
| Fecha | America | Europa | Africa | Asia | Pacifico | Australia |
|---|---|---|---|---|---|---|
"""

try:
    lines = open('TRAFFIC.md').readlines()
except FileNotFoundError:
    lines = HEADER.splitlines(keepends=True)

def insert_after_last(lines, marker, new_row):
    idx = max((i for i,l in enumerate(lines) if marker in l and l.strip().startswith('|')), default=-1)
    if idx == -1:
        return lines + [new_row + '\n']
    return lines[:idx+1] + [new_row + '\n'] + lines[idx+1:]

lines = insert_after_last(lines, 'Visitas repo', row1)
lines = insert_after_last(lines, 'Scores | Grupos', row2)
lines = insert_after_last(lines, 'America', row3)

open('TRAFFIC.md','w').writelines(lines)
print(f"Updated TRAFFIC.md with {date}")
print(f"  Visits: {av}, Shares: {as_}")
print(f"  Top tab: scores={t1} groups={t2} fixtures={t3}")
print(f"  Regions: america={r1} europe={r2} asia={r4}")
