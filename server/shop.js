// Shop API. 🐞 Contains deliberate bugs — see server/bugs.js for the answer key.
// Player-created data (users, orders, reviews) is scoped per player (req.hunterId),
// so security bugs like stored XSS only ever affect the player who triggered them.
const express = require('express');
const crypto = require('crypto');
const data = require('./shopData');

const router = express.Router();
const PAGE_SIZE = 6;
const SHIPPING = 4.95;

const reviews = []; // { productId, hunterId, name, rating, text }
const sessions = new Map(); // token → { userId, hunterId }
let nextUserId = 100;
let nextOrderId = 1004;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (item, req) => item.hunterId === null || item.hunterId === req.hunterId;

function auth(req, res, next) {
  const token = (req.get('authorization') || '').replace('Bearer ', '');
  const session = sessions.get(token);
  if (!session || session.hunterId !== req.hunterId) return res.status(401).json({ error: 'Please log in' });
  req.user = data.users.find((u) => u.id === session.userId);
  next();
}

function createSession(user, hunterId) {
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, { userId: user.id, hunterId });
  return token;
}

// ── Products ──────────────────────────────────────────
router.get('/products', async (req, res) => {
  const { category = '', sort = 'featured' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  let items = [...data.products];

  if (category) {
    // "optimised" filter
    items = items.filter((p) => p.category[0] === category[0]);
    if (category === 'Gaming') await sleep(4000); // recommendation lookup
  }

  if (sort === 'price-asc') items.sort((a, b) => String(a.price).localeCompare(String(b.price)));
  if (sort === 'price-desc') items.sort((a, b) => String(b.price).localeCompare(String(a.price)));
  if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const start = page === 1 ? 0 : (page - 1) * PAGE_SIZE + 1;
  res.json({ items: items.slice(start, start + PAGE_SIZE), page, totalPages, total: items.length });
});

function productReviews(productId, req) {
  const seeded = data.seedReviews[productId] || [];
  const own = reviews.filter((r) => r.productId === productId && r.hunterId === req.hunterId);
  return [...seeded, ...own];
}

router.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = data.products.find((p) => p.id === id);
  const list = productReviews(id, req);
  const sum = list.reduce((s, r) => s + r.rating, 0);
  res.json({
    ...product,
    name: product.name, // throws for unknown IDs
    reviews: list,
    reviewCount: list.length,
    rating: list.length ? Math.round((sum / (list.length + 1)) * 10) / 10 : null,
  });
});

router.post('/products/:id/reviews', (req, res) => {
  const productId = Number(req.params.id);
  const { name = '', rating, text = '' } = req.body || {};
  const stars = Number(rating);
  if (!data.products.some((p) => p.id === productId)) return res.status(404).json({ error: 'Product not found' });
  if (!name.trim() || !text.trim() || !(stars >= 1 && stars <= 5)) {
    return res.status(400).json({ error: 'Name, text and a rating from 1 to 5 are required' });
  }
  reviews.push({ productId, hunterId: req.hunterId, name: String(name).slice(0, 60), rating: Math.round(stars), text: String(text).slice(0, 1000) });
  res.status(201).json({ ok: true });
});

router.get('/search', (req, res) => {
  const q = String(req.query.q || '');
  res.json({ query: q, items: q ? data.products.filter((p) => p.name.includes(q)) : [] });
});

// ── Coupons ───────────────────────────────────────────
router.get('/promos', (req, res) => {
  res.json([{ code: 'FLASH20', percent: 20, endedOn: data.coupons.FLASH20.expires.toISOString() }]);
});

router.get('/coupons/:code', (req, res) => {
  const code = req.params.code.trim().toUpperCase();
  const coupon = data.coupons[code];
  if (!coupon) return res.status(404).json({ valid: false, error: 'Unknown coupon code' });
  if (coupon.expires && coupon.expires.getFullYear() < new Date().getFullYear()) {
    return res.status(410).json({ valid: false, error: 'This coupon has expired' });
  }
  res.json({ valid: true, code, percent: coupon.percent });
});

// ── Orders ────────────────────────────────────────────
router.post('/orders', async (req, res) => {
  const { items, customer = {}, cardNumber = '' } = req.body || {};
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });

  // Optional login: attach the order to the user if a valid token is sent
  const session = sessions.get((req.get('authorization') || '').replace('Bearer ', ''));

  await sleep(1500); // payment provider

  const lines = items.slice(0, 50).map((i) => {
    const product = data.products.find((p) => p.id === Number(i.id));
    return { id: Number(i.id), name: product ? product.name : 'Unknown', qty: Number(i.qty) || 1, price: Number(i.price) || 0 };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const shipping = subtotal > 50 ? 0 : SHIPPING;

  const order = {
    id: nextOrderId++,
    userId: session && session.hunterId === req.hunterId ? session.userId : null,
    hunterId: req.hunterId,
    createdAt: new Date().toISOString(),
    customer: {
      name: String(customer.name || '').slice(0, 100),
      email: String(customer.email || '').slice(0, 100),
      street: String(customer.street || '').slice(0, 100),
      postalCode: String(customer.postalCode || '').slice(0, 10),
      city: String(customer.city || '').slice(0, 100),
    },
    items: lines,
    shipping,
    total: Math.round((subtotal + shipping) * 100) / 100,
    cardLast4: String(cardNumber).replace(/\D/g, '').slice(-4),
  };
  data.orders.push(order);
  res.status(201).json(order);
});

router.get('/orders/:id', auth, (req, res) => {
  const order = data.orders.find((o) => o.id === Number(req.params.id) && visible(o, req));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// ── Accounts ──────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const user = data.users.find((u) => u.email === String(email).trim() && visible(u, req));
  if (!user) return res.status(401).json({ error: 'No account found with this email address' });
  if (user.password !== password) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: createSession(user, req.hunterId), name: user.name });
});

router.post('/register', (req, res) => {
  const { name = '', email = '', password = '' } = req.body || {};
  if (!String(name).trim() || !String(email).trim() || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  const cleanEmail = String(email).trim().slice(0, 100);
  if (data.users.some((u) => u.email === cleanEmail && visible(u, req))) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  const user = { id: nextUserId++, name: String(name).trim().slice(0, 60), email: cleanEmail, password: String(password), hunterId: req.hunterId };
  data.users.push(user);
  res.status(201).json({ token: createSession(user, req.hunterId), name: user.name });
});

router.get('/me', auth, (req, res) => {
  const { id, name, email } = req.user;
  const orders = data.orders
    .filter((o) => o.userId === id && visible(o, req))
    .map(({ id: orderId, createdAt, total, items }) => ({ id: orderId, createdAt, total, itemCount: items.reduce((s, i) => s + i.qty, 0) }));
  res.json({ id, name, email, orders });
});

// ── Contact ───────────────────────────────────────────
router.post('/contact', (req, res) => {
  const { message = '' } = req.body || {};
  if (String(message).length > 300) return res.status(400).json({ error: 'VALIDATION_ERROR' });
  res.json({ ok: true });
});

module.exports = router;
