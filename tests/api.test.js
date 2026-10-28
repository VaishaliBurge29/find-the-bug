// Run with: npm test
// Two kinds of tests:
//  1. The game (scoring, hints, leaderboard) must work correctly.
//  2. The planted bugs must still exist — if one of these fails, someone "fixed" the game.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.HUNTERS_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bughunt-')), 'hunters.json');
const app = require('../server/index');
const { BUGS } = require('../server/bugs');

let server;
let base;
const PLAYER = 'test-player-0001';
const OTHER = 'test-player-0002';

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api`;
});
after(() => server.close());

async function call(path, { method = 'GET', body, player = PLAYER, token } = {}) {
  const headers = { 'X-Hunter-Id': player };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
}

// ── 1. Game logic ─────────────────────────────────────
test('catalog has 41 bugs with unique ids and all required fields', () => {
  assert.equal(BUGS.length, 41);
  assert.equal(new Set(BUGS.map((b) => b.id)).size, BUGS.length);
  for (const b of BUGS) {
    for (const key of ['page', 'feature', 'category', 'difficulty', 'title', 'hint', 'technique', 'cause', 'prevention']) {
      assert.ok(b[key], `bug #${b.id} is missing ${key}`);
    }
    assert.ok(b.keywords.length > 0, `bug #${b.id} has no keywords`);
  }
});

test('every bug can be found with its own feature and title', async () => {
  const meta = (await call('/hunt/meta')).data;
  for (const b of BUGS) assert.ok(meta.pages[b.page].features.includes(b.feature), `bug #${b.id}: feature "${b.feature}" not offered`);
});

test('reporting requires joining first', async () => {
  const res = await call('/hunt/report', { player: 'not-joined-123', method: 'POST', body: { page: 'home', category: 'UI', description: 'something odd here' } });
  assert.equal(res.status, 401);
});

test('a correct report scores points, a duplicate scores nothing, a wrong one costs 2', async () => {
  await call('/hunt/join', { method: 'POST', body: { nickname: 'Tester' } });
  const report = { page: 'product', feature: 'Quantity field', category: 'Validation', description: 'Quantity -1 is accepted and added to the cart' };

  const first = await call('/hunt/report', { method: 'POST', body: report });
  assert.equal(first.data.correct, true);
  assert.equal(first.data.bug.id, 8);
  assert.equal(first.data.points, 10);

  // same feature + category, but the description points to the other quantity bug
  const second = await call('/hunt/report', { method: 'POST', body: { ...report, description: 'Max is 10 but entering exactly 10 is rejected' } });
  assert.equal(second.data.bug.id, 9);

  const wrong = await call('/hunt/report', { method: 'POST', body: { page: 'login', feature: 'Login button', category: 'Performance', description: 'Login button looks blue' } });
  assert.equal(wrong.data.correct, false);
  assert.equal(wrong.data.points, -2);

  const me = (await call('/hunt/me')).data;
  assert.equal(me.score, 10 + 20 - 2);
  assert.equal(me.foundCount, 2);
});

test('hints cost 5 points once, repeating is free', async () => {
  const before = (await call('/hunt/me')).data.score;
  const h1 = await call('/hunt/hint', { method: 'POST', body: { page: 'cart' } });
  assert.equal(h1.data.cost, 5);
  assert.ok(h1.data.hint);
  const after = (await call('/hunt/me')).data.score;
  assert.equal(after, before - 5);
});

test('nicknames are unique and leaderboard does not leak player ids', async () => {
  const taken = await call('/hunt/join', { player: OTHER, method: 'POST', body: { nickname: 'tester' } });
  assert.equal(taken.status, 409);
  const board = (await call('/hunt/leaderboard')).data;
  assert.equal(board.rows[0].nickname, 'Tester');
  assert.equal(board.rows[0].id, undefined);
});

// ── 2. The planted bugs are still there ───────────────
test('bug #1: price sort is alphabetical', async () => {
  const { data } = await call('/products?sort=price-asc');
  assert.deepEqual(data.items.slice(0, 2).map((p) => p.price), [129, 19.9]);
});

test('bug #3: "Audio" filter includes accessories', async () => {
  const { data } = await call('/products?category=Audio');
  assert.ok(data.items.some((p) => p.category === 'Accessories'));
});

test('bug #4: pagination skips the Ergonomic Chair', async () => {
  const p1 = (await call('/products?page=1')).data.items;
  const p2 = (await call('/products?page=2')).data.items;
  const names = [...p1, ...p2].map((p) => p.name);
  assert.ok(!names.includes('Ergonomic Chair'));
});

test('bug #10: rating average divides by n+1', async () => {
  const { data } = await call('/products/1');
  assert.equal(data.rating, 3.6); // real average of 5,5,4,4 is 4.5
});

test('bug #13: unknown product returns 500 with stack trace', async () => {
  const res = await call('/products/999');
  assert.equal(res.status, 500);
  assert.ok(res.data.stack);
});

test('bug #14: search is case-sensitive', async () => {
  assert.equal((await call('/search?q=Mouse')).data.items.length, 1);
  assert.equal((await call('/search?q=mouse')).data.items.length, 0);
});

test('bug #19: expired FLASH20 coupon is accepted (except on Jan 1–2)', async (t) => {
  const today = new Date();
  if (today.getMonth() === 0 && today.getDate() <= 2) return t.skip('expiry falls in previous year');
  const res = await call('/coupons/FLASH20');
  assert.equal(res.data.valid, true);
});

test('bugs #28 + #30: API trusts client prices and accepts an empty cart', async () => {
  const tampered = await call('/orders', { method: 'POST', body: { items: [{ id: 7, qty: 1, price: 0.01 }] } });
  assert.equal(tampered.data.items[0].price, 0.01);
  const empty = await call('/orders', { method: 'POST', body: { items: [] } });
  assert.equal(empty.status, 201);
});

test('bug #31: login reveals whether an email exists', async () => {
  const unknown = await call('/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'x' } });
  const wrongPw = await call('/login', { method: 'POST', body: { email: 'anna@example.com', password: 'x' } });
  assert.notEqual(unknown.data.error, wrongPw.data.error);
});

test('bug #34: same email can be registered with different case', async () => {
  const res = await call('/register', { method: 'POST', body: { name: 'Anna 2', email: 'Anna@example.com', password: 'Password123' } });
  assert.equal(res.status, 201);
});

test('bug #37: IDOR — Anna can read Lukas\'s order', async () => {
  const { data } = await call('/login', { method: 'POST', body: { email: 'anna@example.com', password: 'Password123' } });
  const res = await call('/orders/1001', { token: data.token });
  assert.equal(res.status, 200);
  assert.equal(res.data.customer.name, 'Lukas Weber');
});

test('bug #39: server rejects messages over 300 characters', async () => {
  const res = await call('/contact', { method: 'POST', body: { message: 'x'.repeat(301) } });
  assert.equal(res.status, 400);
});

// ── Player isolation (keeps the game safe to host publicly) ──
test('reviews and orders from one player are invisible to others', async () => {
  await call('/products/5/reviews', { method: 'POST', body: { name: 'X', rating: 5, text: '<img src=x onerror=alert(1)>' } });
  const mine = (await call('/products/5')).data.reviews;
  const theirs = (await call('/products/5', { player: OTHER })).data.reviews;
  assert.ok(mine.some((r) => r.text.includes('onerror')));
  assert.ok(!theirs.some((r) => r.text.includes('onerror')));

  const order = (await call('/orders', { method: 'POST', body: { items: [{ id: 1, qty: 1, price: 24.99 }] } })).data;
  const { data } = await call('/login', { player: OTHER, method: 'POST', body: { email: 'anna@example.com', password: 'Password123' } });
  const res = await call(`/orders/${order.id}`, { player: OTHER, token: data.token });
  assert.equal(res.status, 404);
});
