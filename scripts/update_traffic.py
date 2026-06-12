#!/usr/bin/env python3
import datetime

try:
    parts = open('/tmp/metrics.txt').read().strip().split('|')
    date, tv, uv, tc, uc = parts
except Exception as e:
    print(f"Could not read metrics: {e}")
    date = datetime.date.today().isoformat()
    tv = uv = tc = uc = '0'

row = f"| {date} | {tv} | {uv} | {tc} | {uc} |"

try:
    lines = open('TRAFFIC.md').readlines()
except FileNotFoundError:
    lines = []

def insert_after_header(lines, marker, new_row):
    idx = max((i for i, l in enumerate(lines) if marker in l and l.strip().startswith('|')), default=-1)
    if idx == -1:
        return lines + [new_row + '\n']
    return lines[:idx+1] + [new_row + '\n'] + lines[idx+1:]

lines = insert_after_header(lines, 'Views repo', row)
open('TRAFFIC.md', 'w').writelines(lines)
print(f"Updated TRAFFIC.md: {row}")
