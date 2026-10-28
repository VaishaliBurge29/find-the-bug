/* Shared helpers, header/footer and the 🐞 Bug Hunt panel. */

// ── Player id (scopes your data on the server) ─────────
function storageGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

let hunterId = storageGet('hunterId', null);
if (!hunterId) {
  hunterId = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
  storageSet('hunterId', hunterId);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Hunter-Id': hunterId };
  const token = storageGet('shopToken', null);
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* no body */ }
  return { ok: res.ok, status: res.status, data };
}

// ── Formatting ─────────────────────────────────────────
const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
const formatEUR = (n) => eur.format(n);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function productImageSrc(p) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="${p.color}"/><text x="200" y="185" font-size="120" text-anchor="middle">${p.emoji}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function qs(name) {
  return new URLSearchParams(location.search).get(name);
}

function toast(message) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    document.body.appendChild(wrap);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = message;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Cart (stored in the browser) ───────────────────────
const getCart = () => storageGet('cart', []);
const getCoupons = () => storageGet('coupons', []);
function saveCart(cart) {
  storageSet('cart', cart);
  updateCartBadge();
}

function addToCart(product, qty) {
  const cart = getCart();
  const line = cart.find((i) => i.id === product.id);
  if (line) line.qty += qty;
  else cart.push({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, color: product.color, qty });
  saveCart(cart);
  toast(`Added ${qty} × ${product.name} to your cart`);
}

const FREE_SHIPPING_FROM = 50;
const SHIPPING = 4.95;

function computeTotals(cart = getCart(), coupons = getCoupons()) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const percent = Math.min(100, coupons.reduce((s, c) => s + c.percent, 0));
  const discount = Math.round(subtotal * percent) / 100;
  const shipping = cart.length === 0 || subtotal > FREE_SHIPPING_FROM ? 0 : SHIPPING;
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;
  const vat = total - total / 1.19;
  return { subtotal, discount, shipping, total, vat };
}

function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = getCart().reduce((s, i) => s + i.qty, 0);
}

// ── Header & footer ────────────────────────────────────
function renderHeader() {
  const user = storageGet('shopUser', null);
  const el = document.getElementById('site-header');
  if (!el) return;
  el.className = 'site-header';
  el.innerHTML = `
    <div class="inner">
      <a class="logo" href="/">🐞 BugHunt <span>Shop</span></a>
      <form class="header-search" action="/search.html" role="search">
        <input name="q" placeholder="Search products…" aria-label="Search products" value="${escapeHtml(qs('q') || '')}">
        <button type="submit">Search</button>
      </form>
      <nav class="nav" aria-label="Main">
        <a href="/">Shop</a>
        <a href="/contact.html">Contact</a>
        ${user ? `<a href="/account.html">👤 ${escapeHtml(user)}</a>` : '<a href="/login.html">Login</a>'}
        <a class="cart-link" href="/cart.html">🛒 Cart<span class="badge" id="cart-count">0</span></a>
      </nav>
    </div>`;
  updateCartBadge();
}

function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.className = 'site-footer';
  el.innerHTML = `
    <div class="inner">
      <span>© ${new Date().getFullYear()} BugHunt Shop · A training game for software testers · All data is fake</span>
      <span><a href="/how-to-play.html">How to play</a> · <a href="/leaderboard.html">Leaderboard</a> · <button class="btn-link" id="newsletter-open" style="color:inherit">Newsletter</button></span>
    </div>`;
  document.getElementById('newsletter-open').addEventListener('click', openNewsletter);
}

function openNewsletter() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="nl-title">
      <div class="close">×</div>
      <h2 id="nl-title">Get 10% off 📬</h2>
      <p>Subscribe to our newsletter and get the code <b>WELCOME10</b>.</p>
      <form class="form" id="nl-form">
        <label>Email <input type="email" required></label>
        <button type="submit">Subscribe</button>
      </form>
    </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelector('.close').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#nl-form').addEventListener('submit', (e) => {
    e.preventDefault();
    backdrop.querySelector('.modal').innerHTML = '<div class="close">×</div><h2>Thanks! 🎉</h2><p>Use <b>WELCOME10</b> at checkout.</p>';
    backdrop.querySelector('.close').addEventListener('click', () => backdrop.remove());
  });
}

// ── 🐞 Bug Hunt panel ──────────────────────────────────
const Hunt = {
  meta: null,
  me: null,
  tab: 'report',

  async init() {
    const fab = document.createElement('button');
    fab.className = 'hunt-fab';
    fab.innerHTML = '🐞 Bug Hunt<span class="count" id="hunt-fab-count"></span>';
    fab.setAttribute('aria-controls', 'hunt-drawer');
    fab.addEventListener('click', () => this.open());

    const drawer = document.createElement('aside');
    drawer.className = 'hunt-drawer';
    drawer.id = 'hunt-drawer';
    drawer.setAttribute('aria-label', 'Bug Hunt');
    drawer.innerHTML = '<div class="hunt-head"></div><div class="hunt-tabs" role="tablist"></div><div class="hunt-body"></div>';
    document.body.append(fab, drawer);
    this.drawer = drawer;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) this.close(); });

    const [meta, me] = await Promise.all([api('/hunt/meta'), api('/hunt/me')]);
    this.meta = meta.data;
    this.me = me.ok ? me.data : null;
    this.updateFab();
  },

  open() {
    this.drawer.classList.add('open');
    this.render();
    const first = this.drawer.querySelector('input, select, button');
    if (first) first.focus();
  },
  close() {
    this.drawer.classList.remove('open');
    document.querySelector('.hunt-fab').focus();
  },

  async refresh() {
    const me = await api('/hunt/me');
    this.me = me.ok ? me.data : null;
    this.updateFab();
  },

  updateFab() {
    const el = document.getElementById('hunt-fab-count');
    if (el && this.meta) el.textContent = this.me ? `${this.me.foundCount}/${this.meta.totalBugs}` : '';
  },

  render() {
    const head = this.drawer.querySelector('.hunt-head');
    const tabs = this.drawer.querySelector('.hunt-tabs');
    const body = this.drawer.querySelector('.hunt-body');
    const total = this.meta ? this.meta.totalBugs : 0;

    head.innerHTML = `<div class="top"><h2>🐞 Bug Hunt</h2><button class="hunt-close" aria-label="Close">×</button></div>`;
    head.querySelector('.hunt-close').addEventListener('click', () => this.close());

    if (!this.me) {
      tabs.innerHTML = '';
      body.innerHTML = `
        <p>This shop contains <b style="color:var(--hunt-accent)">${total} hidden bugs</b> — functional, validation, security, accessibility and more. Find them, report them, climb the leaderboard.</p>
        <form id="hunt-join">
          <label>Choose a nickname<input name="nickname" maxlength="24" required autocomplete="nickname"></label>
          <button class="primary" type="submit">Start hunting</button>
          <p class="hunt-msg" role="alert"></p>
        </form>
        <p><a href="/how-to-play.html">How to play →</a></p>`;
      body.querySelector('#hunt-join').addEventListener('submit', async (e) => {
        e.preventDefault();
        const res = await api('/hunt/join', { method: 'POST', body: { nickname: e.target.nickname.value } });
        if (!res.ok) { body.querySelector('.hunt-msg').textContent = res.data.error; return; }
        await this.refresh();
        this.render();
      });
      return;
    }

    const me = this.me;
    const stats = document.createElement('div');
    stats.innerHTML = `
      <div class="hunt-stats">
        <div><b>${me.score}</b><span>Points</span></div>
        <div><b>${me.foundCount}/${total}</b><span>Bugs</span></div>
        <div><b>#${me.rank}</b><span>of ${me.players}</span></div>
      </div>
      <div class="progress" aria-hidden="true"><div style="width:${(me.foundCount / total) * 100}%"></div></div>`;
    const who = document.createElement('div');
    who.style.cssText = 'color:var(--hunt-muted);font-size:.85rem;margin-top:4px';
    who.textContent = 'Playing as ' + me.nickname;
    head.append(who, stats);

    tabs.innerHTML = ['report', 'hint', 'found'].map((t) =>
      `<button role="tab" data-tab="${t}" class="${this.tab === t ? 'active' : ''}" aria-selected="${this.tab === t}">${{ report: '📝 Report', hint: '💡 Hint', found: `🏆 Found (${me.foundCount})` }[t]}</button>`).join('');
    tabs.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.tab = b.dataset.tab; this.render(); }));

    if (this.tab === 'report') this.renderReport(body);
    if (this.tab === 'hint') this.renderHint(body);
    if (this.tab === 'found') this.renderFound(body);
  },

  pageOptions(selected) {
    return Object.entries(this.meta.pages).map(([k, p]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${p.label}</option>`).join('');
  },

  renderReport(body) {
    const current = document.body.dataset.page || 'home';
    body.innerHTML = `
      <form id="hunt-report">
        <label>Page<select name="page">${this.pageOptions(current)}</select></label>
        <label>Feature / area<select name="feature"></select></label>
        <label>Category<select name="category">${this.meta.categories.map((c) => `<option>${c}</option>`).join('')}</select></label>
        <label>What did you find? (steps, expected vs. actual)
          <textarea name="description" rows="5" minlength="15" required placeholder="e.g. Entered -1 as quantity → item added with -1. Expected: error message."></textarea>
        </label>
        <button class="primary" type="submit">Submit bug report</button>
      </form>
      <div id="hunt-out"></div>
      <p>Wrong reports cost ${this.meta.wrongPenalty} points. Points: easy ${this.meta.points.easy} · medium ${this.meta.points.medium} · hard ${this.meta.points.hard}.</p>`;
    const form = body.querySelector('#hunt-report');
    const fillFeatures = () => {
      form.feature.innerHTML = this.meta.pages[form.page.value].features.map((f) => `<option>${f}</option>`).join('');
    };
    form.page.addEventListener('change', fillFeatures);
    fillFeatures();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      const res = await api('/hunt/report', {
        method: 'POST',
        body: { page: form.page.value, feature: form.feature.value, category: form.category.value, description: form.description.value },
      });
      btn.disabled = false;
      const out = body.querySelector('#hunt-out');
      out.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'hunt-result';
      if (!res.ok) {
        box.classList.add('bad');
        box.textContent = res.data.error;
      } else if (res.data.correct) {
        const b = res.data.bug;
        box.classList.add('good');
        box.innerHTML = `<h3>✅ Bug #${b.id} confirmed! +${res.data.points}</h3><div class="t"></div>
          <dl><dt>Why it happens</dt><dd class="c"></dd><dt>How to prevent it</dt><dd class="p"></dd><dt>Test technique</dt><dd class="q"></dd></dl>`;
        box.querySelector('.t').textContent = b.title;
        box.querySelector('.c').textContent = b.cause;
        box.querySelector('.p').textContent = b.prevention;
        box.querySelector('.q').textContent = b.technique;
        form.description.value = '';
      } else {
        box.classList.add(res.data.duplicate ? 'neutral' : 'bad');
        box.textContent = (res.data.points ? `${res.data.points} points. ` : '') + res.data.message;
      }
      out.appendChild(box);
      await this.refresh();
      // update the header stats without wiping the result
      const keep = out.innerHTML;
      this.render();
      this.drawer.querySelector('#hunt-out').innerHTML = keep;
    });
  },

  renderHint(body) {
    const current = document.body.dataset.page || 'home';
    body.innerHTML = `
      <p>Stuck? Get a nudge for an unfound bug on a page. Each new hint costs ${this.meta.hintCost} points; repeating one is free.</p>
      <form id="hunt-hint">
        <label>Page<select name="page">${this.pageOptions(current)}</select></label>
        <button class="primary" type="submit">Get a hint (−${this.meta.hintCost})</button>
      </form>
      <div id="hunt-out"></div>`;
    body.querySelector('#hunt-hint').addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await api('/hunt/hint', { method: 'POST', body: { page: e.target.page.value } });
      const out = body.querySelector('#hunt-out');
      const box = document.createElement('div');
      box.className = 'hunt-result neutral';
      if (res.data.done) {
        box.textContent = res.data.message;
      } else {
        box.innerHTML = '<h3>💡 Hint</h3><div class="h"></div><dl><dt>Try this technique</dt><dd class="t"></dd><dt>Category</dt><dd class="c"></dd></dl><p class="r"></p>';
        box.querySelector('.h').textContent = res.data.hint;
        box.querySelector('.t').textContent = res.data.technique;
        box.querySelector('.c').textContent = res.data.category;
        box.querySelector('.r').textContent = `${res.data.remainingOnPage} bug(s) left on this page${res.data.cost ? ` · −${res.data.cost} points` : ' · free (already bought)'}`;
      }
      out.innerHTML = '';
      out.appendChild(box);
      await this.refresh();
      const keep = out.innerHTML;
      this.render();
      this.drawer.querySelector('#hunt-out').innerHTML = keep;
    });
  },

  renderFound(body) {
    const me = this.me;
    if (!me.found.length) {
      body.innerHTML = '<p>No bugs found yet. Start exploring the shop! 🔍</p>';
      return;
    }
    body.innerHTML = '';
    const byCat = {};
    me.found.forEach((b) => { byCat[b.category] = (byCat[b.category] || 0) + 1; });
    const summary = document.createElement('p');
    summary.textContent = this.meta.categories.map((c) => `${c} ${byCat[c] || 0}/${this.meta.byCategory[c]}`).join(' · ');
    body.appendChild(summary);

    [...me.found].reverse().forEach((b) => {
      const d = document.createElement('details');
      d.className = 'found-item';
      d.innerHTML = `<summary></summary><div class="sub"></div><dl><dt>Why it happens</dt><dd class="c"></dd><dt>How to prevent it</dt><dd class="p"></dd><dt>Test technique</dt><dd class="q"></dd><dt>Your report</dt><dd class="r"></dd></dl>`;
      d.querySelector('summary').textContent = `#${b.id} ${b.title}`;
      const diff = document.createElement('span');
      diff.className = `diff diff-${b.difficulty}`;
      diff.textContent = `+${b.points}`;
      d.querySelector('summary').appendChild(diff);
      d.querySelector('.sub').textContent = `${this.meta.pages[b.page].label} · ${b.feature} · ${b.category}`;
      d.querySelector('.c').textContent = b.cause;
      d.querySelector('.p').textContent = b.prevention;
      d.querySelector('.q').textContent = b.technique;
      d.querySelector('.r').textContent = b.report;
      body.appendChild(d);
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();
  renderFooter();
  Hunt.init();
});
