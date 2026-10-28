// Game API: joining, reporting bugs, hints and the leaderboard.
// Unlike the shop, this part is meant to be bug-free.
const express = require('express');
const { BUGS, PAGES, CATEGORIES, POINTS } = require('./bugs');
const store = require('./store');

const router = express.Router();
const HINT_COST = 5;
const WRONG_PENALTY = 2;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keywordHits(bug, text) {
  return bug.keywords.filter((kw) => {
    if (/^[a-z0-9]{1,3}$/i.test(kw)) return new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i').test(text);
    return text.includes(kw.toLowerCase());
  }).length;
}

function publicBug(bug) {
  const { keywords, hint, ...rest } = bug;
  return { ...rest, points: POINTS[bug.difficulty] };
}

function rankOf(id) {
  const sorted = leaderboard();
  return sorted.findIndex((h) => h.id === id) + 1;
}

function leaderboard() {
  return store
    .allHunters()
    .sort((a, b) => b.score - a.score || b.found.length - a.found.length || lastFound(a) - lastFound(b));
}

function lastFound(h) {
  return h.found.length ? new Date(h.found[h.found.length - 1].at).getTime() : Infinity;
}

function requireHunter(req, res, next) {
  req.hunter = store.getHunter(req.hunterId);
  if (!req.hunter) return res.status(401).json({ error: 'Join the hunt first' });
  next();
}

router.get('/meta', (req, res) => {
  const pages = Object.fromEntries(Object.entries(PAGES).map(([key, p]) => [key, { label: p.label, features: p.features }]));
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, BUGS.filter((b) => b.category === c).length]));
  res.json({ pages, categories: CATEGORIES, totalBugs: BUGS.length, points: POINTS, hintCost: HINT_COST, wrongPenalty: WRONG_PENALTY, byCategory });
});

router.post('/join', (req, res) => {
  const nickname = String((req.body || {}).nickname || '').trim();
  if (req.hunterId === 'anonymous') return res.status(400).json({ error: 'Missing player id' });
  if (nickname.length < 2 || nickname.length > 24) return res.status(400).json({ error: 'Nickname must be 2–24 characters' });
  const taken = store.allHunters().some((h) => h.nickname.toLowerCase() === nickname.toLowerCase() && h.id !== req.hunterId);
  if (taken) return res.status(409).json({ error: 'That nickname is taken' });
  const hunter = store.upsertHunter(req.hunterId, nickname);
  res.json({ nickname: hunter.nickname });
});

router.get('/me', requireHunter, (req, res) => {
  const h = req.hunter;
  const found = h.found.map((f) => ({ ...publicBug(BUGS.find((b) => b.id === f.bugId)), foundAt: f.at, report: f.description }));
  const reports = h.found.length + h.wrong;
  res.json({
    nickname: h.nickname,
    score: h.score,
    foundCount: h.found.length,
    totalBugs: BUGS.length,
    wrong: h.wrong,
    accuracy: reports ? Math.round((h.found.length / reports) * 100) : null,
    rank: rankOf(req.hunterId),
    players: store.allHunters().length,
    found,
  });
});

router.post('/report', requireHunter, (req, res) => {
  const { page, feature = '', category, description = '' } = req.body || {};
  const text = String(description).trim().toLowerCase();
  if (!PAGES[page] || !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Choose a page and a category' });
  if (text.length < 15) return res.status(400).json({ error: 'Describe the bug in at least 15 characters — like a real bug report' });

  const h = req.hunter;
  const foundIds = new Set(h.found.map((f) => f.bugId));
  const scored = BUGS.filter((b) => b.page === page && b.category === category)
    .map((b) => ({ bug: b, score: (b.feature === feature ? 3 : 0) + keywordHits(b, text) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  const match = scored.find((c) => !foundIds.has(c.bug.id));
  if (match) {
    const points = POINTS[match.bug.difficulty];
    h.score += points;
    h.found.push({ bugId: match.bug.id, at: new Date().toISOString(), description: String(description).slice(0, 500) });
    store.save();
    return res.json({ correct: true, points, bug: publicBug(match.bug), foundCount: h.found.length, totalBugs: BUGS.length });
  }

  if (scored.length) {
    return res.json({ correct: false, duplicate: true, points: 0, message: 'You already reported this bug. Duplicate reports happen in real life too 😉' });
  }

  h.wrong += 1;
  h.score -= WRONG_PENALTY;
  store.save();
  res.json({ correct: false, points: -WRONG_PENALTY, message: 'Not a known bug — or not described clearly enough. Check page, category and your description.' });
});

router.post('/hint', requireHunter, (req, res) => {
  const { page } = req.body || {};
  if (!PAGES[page]) return res.status(400).json({ error: 'Choose a page' });
  const h = req.hunter;
  const foundIds = new Set(h.found.map((f) => f.bugId));
  const open = BUGS.filter((b) => b.page === page && !foundIds.has(b.id));
  if (!open.length) return res.json({ done: true, message: 'You found every bug on this page! 🎉' });

  const unhinted = open.find((b) => !h.hints.includes(b.id));
  const bug = unhinted || open[0];
  let cost = 0;
  if (unhinted) {
    cost = HINT_COST;
    h.score -= cost;
    h.hints.push(bug.id);
    store.save();
  }
  res.json({ hint: bug.hint, technique: bug.technique, category: bug.category, cost, remainingOnPage: open.length });
});

router.get('/leaderboard', (req, res) => {
  const rows = leaderboard()
    .slice(0, 100)
    .map((h, i) => {
      const reports = h.found.length + h.wrong;
      return {
        rank: i + 1,
        nickname: h.nickname,
        score: h.score,
        found: h.found.length,
        accuracy: reports ? Math.round((h.found.length / reports) * 100) : null,
        you: h.id === req.hunterId,
      };
    });
  res.json({ totalBugs: BUGS.length, rows });
});

module.exports = router;
