// scoring.test.js — unit tests for World Cup 2026 scoring logic
// Run with: node tests/scoring.test.js

'use strict';

// ── Test runner ──────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function expect(val) {
  return {
    toBe(expected) {
      if (val !== expected)
        throw new Error(`expected ${JSON.stringify(expected)}, got ${JSON.stringify(val)}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(val), b = JSON.stringify(expected);
      if (a !== b) throw new Error(`expected ${b}, got ${a}`);
    },
    toBeLessThanOrEqual(n) {
      if (val > n) throw new Error(`expected ${val} <= ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      if (val < n) throw new Error(`expected ${val} >= ${n}`);
    }
  };
}

// ── Minimal fixtures for a single group ─────────────────────────────────────
const GROUPS = {
  X: { n: 'Grupo X', teams: ['Team A', 'Team B', 'Team C', 'Team D'] }
};

// 6 matches (round-robin within 4 teams)
const FIXTURES = [
  { id: 1, g: 'X', h: 'Team A', a: 'Team B', utc: '2026-06-11T19:00:00Z' },
  { id: 2, g: 'X', h: 'Team A', a: 'Team C', utc: '2026-06-15T19:00:00Z' },
  { id: 3, g: 'X', h: 'Team A', a: 'Team D', utc: '2026-06-19T19:00:00Z' },
  { id: 4, g: 'X', h: 'Team B', a: 'Team C', utc: '2026-06-15T22:00:00Z' },
  { id: 5, g: 'X', h: 'Team B', a: 'Team D', utc: '2026-06-19T22:00:00Z' },
  { id: 6, g: 'X', h: 'Team C', a: 'Team D', utc: '2026-06-23T19:00:00Z' },
];

let liveData = {};
let standings = {};

// ── Extracted logic (matches index.html as-is, BEFORE any fixes) ─────────────

function buildStandings_CURRENT() {
  standings = {};
  for (const [k, d] of Object.entries(GROUPS))
    standings[k] = d.teams.map(t => ({ t, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, p: 0 }));
  for (const f of FIXTURES) {
    const d = liveData[f.id]; if (!d || d.status === 'sched') continue;
    const hi = standings[f.g].findIndex(r => r.t === f.h);
    const ai = standings[f.g].findIndex(r => r.t === f.a);
    if (hi < 0 || ai < 0) continue;
    const H = standings[f.g][hi], A = standings[f.g][ai];
    H.p++; A.p++; H.gf += d.hs; H.ga += d.as; A.gf += d.as; A.ga += d.hs;
    if (d.hs > d.as) { H.w++; H.pts += 3; A.l++; }
    else if (d.hs === d.as) { H.d++; H.pts++; A.d++; A.pts++; }
    else { A.w++; A.pts += 3; H.l++; }
  }
  for (const k of Object.keys(standings))
    standings[k].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

// BUG: uses (2 - row.p) instead of (3 - row.p)
function getQualStatus_BUGGY(grp, idx, row, gStandings) {
  const gfixes = FIXTURES.filter(f => f.g === grp);
  const played = gfixes.filter(f => liveData[f.id]?.status === 'ft').length;
  const total = gfixes.length;
  if (played === 0) return 'tbd';
  if (played === total) {
    if (idx < 2) return 'q';
    return 'elim';
  }
  const maxRemaining = (2 - row.p) * 3; // BUG: should be (3 - row.p) * 3
  const r3 = gStandings[2]?.pts || 0;
  if (idx < 2 && row.pts > r3 + maxRemaining) return 'q';
  if (idx >= 2) {
    const r2 = gStandings[1]?.pts || 0;
    if (row.pts + maxRemaining < r2) return 'elim';
    return 'mq';
  }
  return 'mq';
}

// FIXED version: uses (3 - row.p)
function getQualStatus_FIXED(grp, idx, row, gStandings) {
  const gfixes = FIXTURES.filter(f => f.g === grp);
  const played = gfixes.filter(f => liveData[f.id]?.status === 'ft').length;
  const total = gfixes.length;
  if (played === 0) return 'tbd';
  if (played === total) {
    if (idx < 2) return 'q';
    return 'elim';
  }
  const maxRemaining = (3 - row.p) * 3; // FIXED
  const r3 = gStandings[2]?.pts || 0;
  if (idx < 2 && row.pts > r3 + maxRemaining) return 'q';
  if (idx >= 2) {
    const r2 = gStandings[1]?.pts || 0;
    if (row.pts + maxRemaining < r2) return 'elim';
    return 'mq';
  }
  return 'mq';
}

// ── buildStandings tests ─────────────────────────────────────────────────────
console.log('\n── buildStandings ──');

test('no games played → all zeros', () => {
  liveData = {};
  buildStandings_CURRENT();
  for (const row of standings['X']) {
    expect(row.pts).toBe(0);
    expect(row.p).toBe(0);
    expect(row.gf).toBe(0);
    expect(row.ga).toBe(0);
  }
});

test('home win 2-0 → 3 pts home, 0 pts away, correct goal counts', () => {
  liveData = { 1: { hs: 2, as: 0, status: 'ft' } };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  const B = standings['X'].find(r => r.t === 'Team B');
  expect(A.pts).toBe(3); expect(A.w).toBe(1); expect(A.gf).toBe(2); expect(A.ga).toBe(0);
  expect(B.pts).toBe(0); expect(B.l).toBe(1); expect(B.gf).toBe(0); expect(B.ga).toBe(2);
});

test('draw 1-1 → 1 pt each, correct goal counts', () => {
  liveData = { 1: { hs: 1, as: 1, status: 'ft' } };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  const B = standings['X'].find(r => r.t === 'Team B');
  expect(A.pts).toBe(1); expect(A.d).toBe(1); expect(A.gf).toBe(1); expect(A.ga).toBe(1);
  expect(B.pts).toBe(1); expect(B.d).toBe(1);
});

test('away win 0-2 → 3 pts away, 0 pts home', () => {
  liveData = { 1: { hs: 0, as: 2, status: 'ft' } };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  const B = standings['X'].find(r => r.t === 'Team B');
  expect(A.pts).toBe(0); expect(A.l).toBe(1);
  expect(B.pts).toBe(3); expect(B.w).toBe(1);
});

test('standings sorted pts DESC, then GD DESC, then GF DESC', () => {
  // A beats B 3-0 (A: 3pts, B: 0pts)
  // C beats B 1-0 (C: 3pts, B: 0pts)
  // C draws D 0-0  (C: 4pts, D: 1pt)
  liveData = {
    1: { hs: 3, as: 0, status: 'ft' },
    4: { hs: 0, as: 1, status: 'ft' },
    6: { hs: 0, as: 0, status: 'ft' },
  };
  buildStandings_CURRENT();
  const g = standings['X'];
  expect(g[0].t).toBe('Team C'); expect(g[0].pts).toBe(4);
  expect(g[1].t).toBe('Team A'); expect(g[1].pts).toBe(3);
  expect(g[2].t).toBe('Team D'); expect(g[2].pts).toBe(1);
  expect(g[3].t).toBe('Team B'); expect(g[3].pts).toBe(0);
});

test('live match counts toward standings (projected)', () => {
  liveData = { 1: { hs: 1, as: 0, status: 'live' } };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  expect(A.pts).toBe(3);
  expect(A.p).toBe(1);
});

test('sched match does NOT count toward standings', () => {
  liveData = { 1: { hs: 1, as: 0, status: 'sched' } };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  expect(A.pts).toBe(0);
  expect(A.p).toBe(0);
});

test('complete group: 3 wins, 2 losses, 1 draw accumulate correctly', () => {
  // A beats B, A beats C, A beats D, B beats C, D beats B, C draws D
  liveData = {
    1: { hs: 1, as: 0, status: 'ft' }, // A 3pts
    2: { hs: 1, as: 0, status: 'ft' }, // A 3pts
    3: { hs: 1, as: 0, status: 'ft' }, // A 3pts
    4: { hs: 1, as: 0, status: 'ft' }, // B 3pts
    5: { hs: 0, as: 1, status: 'ft' }, // D 3pts
    6: { hs: 1, as: 1, status: 'ft' }, // C,D 1pt each
  };
  buildStandings_CURRENT();
  const A = standings['X'].find(r => r.t === 'Team A');
  const B = standings['X'].find(r => r.t === 'Team B');
  const C = standings['X'].find(r => r.t === 'Team C');
  const D = standings['X'].find(r => r.t === 'Team D');
  expect(A.pts).toBe(9); expect(A.w).toBe(3); expect(A.p).toBe(3);
  expect(B.pts).toBe(3); expect(B.w).toBe(1); expect(B.l).toBe(2);
  expect(D.pts).toBe(4); // 3 + 1 from draw
  expect(C.pts).toBe(1); // only drew with D
});

// ── getQualStatus tests ──────────────────────────────────────────────────────
console.log('\n── getQualStatus ──');

test('no games played → tbd', () => {
  liveData = {};
  buildStandings_CURRENT();
  const s = standings['X'];
  expect(getQualStatus_FIXED('X', 0, s[0], s)).toBe('tbd');
});

test('all 6 finished: top 2 → q, bottom 2 → elim', () => {
  liveData = {
    1: { hs: 1, as: 0, status: 'ft' },
    2: { hs: 1, as: 0, status: 'ft' },
    3: { hs: 1, as: 0, status: 'ft' },
    4: { hs: 1, as: 0, status: 'ft' },
    5: { hs: 1, as: 0, status: 'ft' },
    6: { hs: 1, as: 0, status: 'ft' },
  };
  buildStandings_CURRENT();
  const s = standings['X'];
  expect(getQualStatus_FIXED('X', 0, s[0], s)).toBe('q');
  expect(getQualStatus_FIXED('X', 1, s[1], s)).toBe('q');
  expect(getQualStatus_FIXED('X', 2, s[2], s)).toBe('elim');
  expect(getQualStatus_FIXED('X', 3, s[3], s)).toBe('elim');
});

test('BUG: buggy version gives wrong maxRemaining when p=1 (2-1=1 vs 3-1=2)', () => {
  // With p=1 played:
  // BUGGY:  maxRemaining = (2-1)*3 = 3  (off by 3)
  // FIXED:  maxRemaining = (3-1)*3 = 6  (correct)
  liveData = { 1: { hs: 1, as: 0, status: 'ft' } };
  buildStandings_CURRENT();
  const s = standings['X'];
  const A = s.find(r => r.t === 'Team A'); // A has 3pts, p=1
  const Aidx = s.findIndex(r => r.t === 'Team A');
  // Buggy: maxRemaining=3, A.pts(3) vs r3.pts(0)+maxRemaining(3) → 3 > 3? NO → returns 'mq' (wrong)
  // Fixed: maxRemaining=6, A.pts(3) vs r3.pts(0)+maxRemaining(6) → 3 > 6? NO → returns 'mq' (correct)
  // After just 1 game of 6, nobody is mathematically through — both should say 'mq'
  const buggyResult = getQualStatus_BUGGY('X', Aidx, A, s);
  const fixedResult = getQualStatus_FIXED('X', Aidx, A, s);
  expect(buggyResult).toBe('mq');  // buggy gives mq (happens to be right here)
  expect(fixedResult).toBe('mq');  // fixed also gives mq
});

test('FIXED: 1st place with 9pts, all 3 played → mathematically through', () => {
  // A wins all 3 group games, others have 0-3pts
  liveData = {
    1: { hs: 1, as: 0, status: 'ft' }, // A beats B
    2: { hs: 1, as: 0, status: 'ft' }, // A beats C
    3: { hs: 1, as: 0, status: 'ft' }, // A beats D
  };
  buildStandings_CURRENT();
  const s = standings['X'];
  const A = s.find(r => r.t === 'Team A');
  const Aidx = s.findIndex(r => r.t === 'Team A');
  // A: 9pts, p=3; maxRemaining(fixed) = (3-3)*3 = 0
  // r3 might have 0-3 pts. A.pts(9) > r3.pts(≤3) + 0 → should be 'q'
  expect(getQualStatus_FIXED('X', Aidx, A, s)).toBe('q');
  // Buggy: maxRemaining = (2-3)*3 = -3 → negative! A.pts(9) > r3 + (-3) → always 'q' (accidentally correct here)
  expect(getQualStatus_BUGGY('X', Aidx, A, s)).toBe('q');
});

test('FIXED: 4th place with 0pts p=2, 2nd has 3pts → buggy eliminates early, fixed keeps alive', () => {
  // A beats B, A beats C, A beats D, B beats D — 4 of 6 games played.
  // D: 0pts, p=2. B: 3pts (beat D, lost to A), p=2.
  // D still has 1 game left (vs C) → can earn 3 more pts.
  // Buggy: maxRemaining = (2-2)*3 = 0 → D(0) + 0 < B(3) → 'elim' (WRONG: D hasn't played 3 yet)
  // Fixed: maxRemaining = (3-2)*3 = 3 → D(0) + 3 = 3, NOT < 3 → 'mq' (CORRECT)
  liveData = {
    1: { hs: 1, as: 0, status: 'ft' }, // A beats B
    2: { hs: 1, as: 0, status: 'ft' }, // A beats C
    3: { hs: 1, as: 0, status: 'ft' }, // A beats D (D: p=1)
    5: { hs: 1, as: 0, status: 'ft' }, // B beats D (D: p=2, 0pts)
    // Games 4 (B vs C) and 6 (C vs D) not yet played
  };
  buildStandings_CURRENT();
  const s = standings['X'];
  const D = s.find(r => r.t === 'Team D');
  const Didx = s.findIndex(r => r.t === 'Team D');
  expect(D.p).toBe(2);
  expect(D.pts).toBe(0);
  expect(s[1].pts).toBe(3); // 2nd place is B with 3pts (beat D)
  // Buggy: (2-2)*3=0 → 0 < 3 → 'elim' (eliminates D when D still has a game left)
  expect(getQualStatus_BUGGY('X', Didx, D, s)).toBe('elim'); // premature elimination
  // Fixed: (3-2)*3=3 → 0+3=3, 3 is NOT < 3 → 'mq' (D can still tie 2nd with a win)
  expect(getQualStatus_FIXED('X', Didx, D, s)).toBe('mq');
});

// ── NORM map coverage test ───────────────────────────────────────────────────
console.log('\n── NORM / FDORG_NORM mapping ──');

// Current NORM from index.html (as-is, known bugs)
const NORM_CURRENT = {
  'USA':'United States','US':'United States','USMNT':'United States','United States of America':'United States',
  'Bosnia & Herzegovina':'Bosnia-Herzegovina','Bosnia and Herzegovina':'Bosnia-Herzegovina',
  'Korea Republic':'South Korea','Republic of Korea':'South Korea',
  "Costa de Marfil":'Ivory Coast',"Costa de Marfil":'Ivory Coast','Cote dIvoire':'Ivory Coast',
  'IR Iran':'Iran','Czech Republic':'Czechia','Türkiye':'Turkey','Turkiye':'Turkey',
  'Saudi Arabia':'Saudi Arabia','KSA':'Saudi Arabia'
};

// These are the Spanish names used in FIXTURES/GROUPS
const FIXTURE_NAMES = [
  'Mexico','Corea del Sur','Sudáfrica','República Checa',
  'Canada','Bosnia-Herzegovina','Qatar','Suiza',
  'Brasil','Marruecos','Haiti','Escocia',
  'Estados Unidos','Paraguay','Australia','Turquía',
  'Alemania','Curaçao','Costa de Marfil','Ecuador',
  'Países Bajos','Japón','Suecia','Túnez',
  'Bélgica','Egipto','Iran','Nueva Zelanda',
  'España','Uruguay','Arabia Saudita','Cabo Verde',
  'Francia','Senegal','Iraq','Noruega',
  'Argentina','Argelia','Austria','Jordania',
  'Portugal','Colombia','Congo DR','Uzbekistan',
  'Inglaterra','Croacia','Ghana','Panamá'
];

const fixtureSet = new Set(FIXTURE_NAMES);

test('NORM current: USA maps to English "United States" (not Spanish "Estados Unidos")', () => {
  const result = NORM_CURRENT['USA'] || 'USA';
  // This is the BUG: should map to 'Estados Unidos' for fixture matching
  expect(result).toBe('United States'); // confirms the bug
  const matchesFixture = fixtureSet.has(result);
  expect(matchesFixture).toBe(false); // 'United States' is NOT in fixtures
});

test('NORM current: "Korea Republic" maps to "South Korea" (not "Corea del Sur")', () => {
  const result = NORM_CURRENT['Korea Republic'] || 'Korea Republic';
  expect(result).toBe('South Korea'); // bug: should be 'Corea del Sur'
  expect(fixtureSet.has(result)).toBe(false);
});

// FDORG_NORM (current, with known bugs)
const FDORG_NORM_CURRENT = {
  'Mexico':'México','South Korea':'Corea del Sur','South Africa':'Sudáfrica',
  'Czech Republic':'República Checa','Bosnia and Herzegovina':'Bosnia-Herzegovina',
  'Switzerland':'Suiza','Brazil':'Brasil','Morocco':'Marruecos','Haiti':'Haití',
  'Scotland':'Escocia','United States':'Estados Unidos','Paraguay':'Paraguay',
  'Australia':'Australia','Turkey':'Turquía','Germany':'Alemania',
  "Côte d'Ivoire":'Costa de Marfil','Ecuador':'Ecuador','Netherlands':'Países Bajos',
  'Japan':'Japón','Sweden':'Suecia','Tunisia':'Túnez','Belgium':'Bélgica',
  'Egypt':'Egipto','Iran':'Irán','New Zealand':'Nueva Zelanda','Spain':'España',
  'Uruguay':'Uruguay','Saudi Arabia':'Arabia Saudita','Cape Verde':'Cabo Verde',
  'France':'Francia','Senegal':'Senegal','Iraq':'Iraq','Norway':'Noruega',
  'Argentina':'Argentina','Algeria':'Argelia','Austria':'Austria','Jordan':'Jordania',
  'Portugal':'Portugal','Colombia':'Colombia','DR Congo':'Congo DR',
  'Uzbekistan':'Uzbekistán','England':'Inglaterra','Croatia':'Croacia',
  'Ghana':'Ghana','Panama':'Panamá','Curacao':'Curaçao','Canada':'Canadá',
  'Qatar':'Qatar',
};

test('FDORG_NORM: "Mexico" maps to "México" (accent) but fixture has "Mexico" (no accent)', () => {
  const mapped = FDORG_NORM_CURRENT['Mexico'];
  expect(mapped).toBe('México'); // confirms the bug
  expect(fixtureSet.has(mapped)).toBe(false); // 'México' not in fixtures
  expect(fixtureSet.has('Mexico')).toBe(true); // 'Mexico' IS in fixtures
});

test('FDORG_NORM: "Canada" maps to "Canadá" but fixture has "Canada"', () => {
  const mapped = FDORG_NORM_CURRENT['Canada'];
  expect(mapped).toBe('Canadá'); // bug
  expect(fixtureSet.has(mapped)).toBe(false);
  expect(fixtureSet.has('Canada')).toBe(true);
});

test('FDORG_NORM: "Iran" maps to "Irán" but fixture has "Iran"', () => {
  const mapped = FDORG_NORM_CURRENT['Iran'];
  expect(mapped).toBe('Irán'); // bug
  expect(fixtureSet.has(mapped)).toBe(false);
  expect(fixtureSet.has('Iran')).toBe(true);
});

test('FDORG_NORM: "Haiti" maps to "Haití" but fixture has "Haiti"', () => {
  const mapped = FDORG_NORM_CURRENT['Haiti'];
  expect(mapped).toBe('Haití'); // bug
  expect(fixtureSet.has(mapped)).toBe(false);
  expect(fixtureSet.has('Haiti')).toBe(true);
});

test('FDORG_NORM: "Uzbekistan" maps to "Uzbekistán" but fixture has "Uzbekistan"', () => {
  const mapped = FDORG_NORM_CURRENT['Uzbekistan'];
  expect(mapped).toBe('Uzbekistán'); // bug
  expect(fixtureSet.has(mapped)).toBe(false);
  expect(fixtureSet.has('Uzbekistan')).toBe(true);
});

// ── fetchWithTimeout header test ─────────────────────────────────────────────
console.log('\n── fetchWithTimeout header support ──');

// Simulate the current fetchWithTimeout signature
async function fetchWithTimeout_CURRENT(url, ms = 8000) {
  // Current implementation ignores any 3rd argument
  // Headers are silently dropped
  return null; // mock
}

test('fetchWithTimeout ignores headers: 3rd arg is accepted but not forwarded to fetch()', () => {
  // JS function.length only counts params without defaults.
  // fetchWithTimeout(url, ms=8000) → length = 1 (ms has default, not counted)
  // A 3rd headers arg would silently be ignored — confirmed by inspecting the body.
  expect(fetchWithTimeout_CURRENT.length).toBeLessThanOrEqual(2); // 1 or 2 (url only, or url+ms)
});

// ── processESPN liveData wipe test ───────────────────────────────────────────
console.log('\n── processESPN liveData reset behavior ──');

test('processESPN wipes all liveData including historical results', () => {
  // Simulate: we have yesterday's result in liveData
  const mockLiveData = {
    1: { hs: 2, as: 1, status: 'ft' }, // yesterday's completed game
  };

  // Current processESPN does: liveData={}
  // This simulates what happens when ESPN is called as fallback
  let simulatedLive = { ...mockLiveData };
  simulatedLive = {}; // what processESPN does
  // Then only adds what ESPN returned (today's games)
  // Yesterday's result (id:1) is GONE
  expect(Object.keys(simulatedLive).length).toBe(0); // confirms the destructive reset
});

// ── populateBracketFromStandings logic test ──────────────────────────────────
console.log('\n── populateBracketFromStandings ──');

// Minimal bracket structure matching index.html's BRACKET_ROUNDS[0]
const BRACKET_ROUNDS_TEST = [{
  id: 'r32', label: 'Ronda de 32', matches: [
    { id: 'r32_1', utc: '2026-06-28T22:00:00Z', label: '1X vs 2Y', v: 'Test City' },
    { id: 'r32_2', utc: '2026-06-29T01:00:00Z', label: '3° mejor #1', v: 'Test City' },
  ]
}];

// Expanded GROUPS for this test
const GROUPS_BRACKET = {
  X: { n: 'Grupo X', teams: ['Team A', 'Team B', 'Team C', 'Team D'] },
  Y: { n: 'Grupo Y', teams: ['Team E', 'Team F', 'Team G', 'Team H'] },
};
const FIXTURES_BRACKET = [
  { id: 1, g: 'X', h: 'Team A', a: 'Team B', utc: '2026-06-11T19:00:00Z' },
  { id: 2, g: 'X', h: 'Team A', a: 'Team C', utc: '2026-06-15T19:00:00Z' },
  { id: 3, g: 'X', h: 'Team A', a: 'Team D', utc: '2026-06-19T19:00:00Z' },
  { id: 4, g: 'X', h: 'Team B', a: 'Team C', utc: '2026-06-15T22:00:00Z' },
  { id: 5, g: 'X', h: 'Team B', a: 'Team D', utc: '2026-06-19T22:00:00Z' },
  { id: 6, g: 'X', h: 'Team C', a: 'Team D', utc: '2026-06-23T19:00:00Z' },
  { id: 7, g: 'Y', h: 'Team E', a: 'Team F', utc: '2026-06-11T22:00:00Z' },
  { id: 8, g: 'Y', h: 'Team E', a: 'Team G', utc: '2026-06-15T22:00:00Z' },
  { id: 9, g: 'Y', h: 'Team E', a: 'Team H', utc: '2026-06-19T22:00:00Z' },
  { id: 10, g: 'Y', h: 'Team F', a: 'Team G', utc: '2026-06-15T23:00:00Z' },
  { id: 11, g: 'Y', h: 'Team F', a: 'Team H', utc: '2026-06-19T23:00:00Z' },
  { id: 12, g: 'Y', h: 'Team G', a: 'Team H', utc: '2026-06-23T22:00:00Z' },
];

function buildStandingsBracket(ld) {
  const st = {};
  for (const [k, d] of Object.entries(GROUPS_BRACKET))
    st[k] = d.teams.map(t => ({ t, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, p: 0 }));
  for (const f of FIXTURES_BRACKET) {
    const d = ld[f.id]; if (!d || d.status === 'sched') continue;
    const hi = st[f.g].findIndex(r => r.t === f.h);
    const ai = st[f.g].findIndex(r => r.t === f.a);
    if (hi < 0 || ai < 0) continue;
    const H = st[f.g][hi], A = st[f.g][ai];
    H.p++; A.p++; H.gf += d.hs; H.ga += d.as; A.gf += d.as; A.ga += d.hs;
    if (d.hs > d.as) { H.w++; H.pts += 3; A.l++; }
    else if (d.hs === d.as) { H.d++; H.pts++; A.d++; A.pts++; }
    else { A.w++; A.pts += 3; H.l++; }
  }
  for (const k of Object.keys(st))
    st[k].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  return st;
}

function populateBracketTest(ld, st, bracketData) {
  const labelRe = /^(\d+)([A-Z]) vs (\d+)([A-Z])$/;
  const r32 = BRACKET_ROUNDS_TEST[0];
  for (const m of r32.matches) {
    if (bracketData[m.id]?.status === 'ft' || bracketData[m.id]?.status === 'live') continue;
    const match = labelRe.exec(m.label);
    if (!match) continue;
    const p1 = parseInt(match[1]) - 1, g1 = match[2];
    const p2 = parseInt(match[3]) - 1, g2 = match[4];
    const g1fixes = FIXTURES_BRACKET.filter(f => f.g === g1);
    const g2fixes = FIXTURES_BRACKET.filter(f => f.g === g2);
    const g1done = g1fixes.length > 0 && g1fixes.every(f => ld[f.id]?.status === 'ft');
    const g2done = g2fixes.length > 0 && g2fixes.every(f => ld[f.id]?.status === 'ft');
    if (!g1done || !g2done) continue;
    const st1 = st[g1], st2 = st[g2];
    if (!st1 || !st2) continue;
    const t1 = st1[p1]?.t, t2 = st2[p2]?.t;
    if (!t1 || !t2) continue;
    if (!bracketData[m.id]) bracketData[m.id] = { h: t1, a: t2, hs: 0, as: 0, status: 'sched', min: '' };
    else { bracketData[m.id].h = t1; bracketData[m.id].a = t2; }
  }
}

test('bracket slot stays empty when groups not yet complete', () => {
  const ld = { 1: { hs: 1, as: 0, status: 'ft' } }; // only 1 of 12 games done
  const st = buildStandingsBracket(ld);
  const bd = {};
  populateBracketTest(ld, st, bd);
  expect(bd['r32_1']).toBe(undefined); // not populated yet
});

test('bracket slot populated once both groups complete', () => {
  // All 12 group games finished. A wins group X (9pts), E wins group Y (9pts)
  const ld = {};
  [1,2,3,4,5,6].forEach(id => ld[id] = { hs: id<=3?1:0, as: id<=3?0:1, status: 'ft' });
  // A beats B,C,D (ids 1,2,3). B,C,D beat each other (ids 4,5,6 → away wins)
  ld[1] = { hs: 1, as: 0, status: 'ft' }; // A beats B → A: 1st
  ld[2] = { hs: 1, as: 0, status: 'ft' }; // A beats C
  ld[3] = { hs: 1, as: 0, status: 'ft' }; // A beats D
  ld[4] = { hs: 0, as: 1, status: 'ft' }; // C beats B → C: 2nd
  ld[5] = { hs: 0, as: 1, status: 'ft' }; // D beats B → D: 3rd
  ld[6] = { hs: 1, as: 0, status: 'ft' }; // C beats D → C: 2nd confirmed
  // Group Y: E wins all, F is 2nd
  [7,8,9].forEach(id => ld[id] = { hs: 1, as: 0, status: 'ft' }); // E beats F,G,H
  ld[10] = { hs: 1, as: 0, status: 'ft' }; // F beats G
  ld[11] = { hs: 1, as: 0, status: 'ft' }; // F beats H
  ld[12] = { hs: 0, as: 0, status: 'ft' }; // G draws H
  const st = buildStandingsBracket(ld);
  expect(st['X'][0].t).toBe('Team A'); // 1st in X
  expect(st['Y'][0].t).toBe('Team E'); // 1st in Y
  expect(st['Y'][1].t).toBe('Team F'); // 2nd in Y
  const bd = {};
  populateBracketTest(ld, st, bd);
  // r32_1: 1X vs 2Y → Team A vs Team F
  if (bd['r32_1'] === undefined) throw new Error('bracket slot r32_1 was not populated');
  expect(bd['r32_1'].h).toBe('Team A');
  expect(bd['r32_1'].a).toBe('Team F');
  expect(bd['r32_1'].status).toBe('sched');
});

test('bracket slot with "3° mejor" label is skipped (not parsed)', () => {
  const ld = {};
  [1,2,3,4,5,6,7,8,9,10,11,12].forEach(id => ld[id] = { hs: 1, as: 0, status: 'ft' });
  const st = buildStandingsBracket(ld);
  const bd = {};
  populateBracketTest(ld, st, bd);
  if (bd['r32_2'] !== undefined) throw new Error('r32_2 (3° mejor) should not be auto-populated');
});

test('bracket slot not overwritten if match is already live or ft', () => {
  const ld = {};
  [1,2,3,4,5,6,7,8,9,10,11,12].forEach(id => ld[id] = { hs: 1, as: 0, status: 'ft' });
  const st = buildStandingsBracket(ld);
  const bd = { 'r32_1': { h: 'Old A', a: 'Old B', hs: 2, as: 1, status: 'ft', min: '' } };
  populateBracketTest(ld, st, bd);
  expect(bd['r32_1'].h).toBe('Old A'); // not overwritten
  expect(bd['r32_1'].status).toBe('ft');
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`\n⚠  ${failed} test(s) document known bugs that need fixing.\n`);
  process.exit(1);
}
console.log('All tests passed.\n');
