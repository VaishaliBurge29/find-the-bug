// Seed data for the shop. Everything here is fake.

const products = [
  { id: 1, name: 'Wireless Mouse', category: 'Accessories', price: 24.99, stock: 12, emoji: '🖱️', color: '#dbeafe', description: 'Silent clicks, 18-month battery life and a comfortable shape for all-day work.' },
  { id: 2, name: 'Mechanical Keyboard', category: 'Gaming', price: 89.5, stock: 0, emoji: '⌨️', color: '#fde68a', description: 'Hot-swappable switches, RGB lighting and a solid aluminium frame.' },
  { id: 3, name: 'Noise-Cancelling Headphones', category: 'Audio', price: 129, stock: 7, emoji: '🎧', color: '#e9d5ff', description: 'Active noise cancelling with 30 hours of playtime.' },
  { id: 4, name: 'USB-C Hub', category: 'Accessories', price: 34.99, stock: 20, emoji: '🔌', color: '#d1fae5', description: '7-in-1 hub with HDMI, SD card reader and 100 W pass-through charging.' },
  { id: 5, name: 'Desk Lamp', category: 'Office', price: 19.9, stock: 15, emoji: '💡', color: '#fef3c7', description: 'Dimmable LED lamp with three colour temperatures.' },
  { id: 6, name: 'Bluetooth Speaker', category: 'Audio', price: 49.99, stock: 9, emoji: '🔊', color: '#fce7f3', description: 'Waterproof (IPX7) speaker with deep bass.' },
  { id: 7, name: 'Ergonomic Chair', category: 'Office', price: 249, stock: 4, emoji: '🪑', color: '#e0e7ff', description: 'Adjustable lumbar support, armrests and seat depth.' },
  { id: 8, name: 'Gaming Headset', category: 'Gaming', price: 59.99, stock: 11, emoji: '🎮', color: '#fee2e2', description: '7.1 surround sound with a detachable microphone.' },
  { id: 9, name: 'Notebook Set', category: 'Office', price: 9.99, stock: 40, emoji: '📓', color: '#ecfccb', description: 'Three dotted A5 notebooks with recycled paper.' },
  { id: 10, name: 'Webcam HD', category: 'Accessories', price: 25, stock: 18, emoji: '📷', color: '#cffafe', description: '1080p webcam with autofocus and a privacy shutter.' },
  { id: 11, name: 'USB Microphone', category: 'Audio', price: 74.99, stock: 6, emoji: '🎙️', color: '#f5d0fe', description: 'Studio-quality cardioid microphone for podcasts and calls.' },
  { id: 12, name: 'Game Controller', category: 'Gaming', price: 44.99, stock: 14, emoji: '🕹️', color: '#ffedd5', description: 'Wireless controller for PC and console.' },
  { id: 13, name: 'Laptop Stand', category: 'Office', price: 29.99, stock: 22, emoji: '💻', color: '#f1f5f9', description: 'Foldable aluminium stand with six height levels.' },
];

const seedReviews = {
  1: [
    { name: 'Jonas', rating: 5, text: 'Super quiet, exactly what I needed.' },
    { name: 'Elif', rating: 5, text: 'Battery lasts forever.' },
    { name: 'Tom', rating: 4, text: 'Good, but a bit small for big hands.' },
    { name: 'Sara', rating: 4, text: 'Works fine with my Mac.' },
  ],
  3: [
    { name: 'Lena', rating: 5, text: 'The noise cancelling is amazing on trains.' },
    { name: 'Max', rating: 3, text: 'Great sound, but they get warm.' },
  ],
  6: [{ name: 'Paul', rating: 4, text: 'Loud and clear.' }],
  7: [
    { name: 'Nina', rating: 5, text: 'My back thanks me.' },
    { name: 'Ali', rating: 5, text: 'Worth every euro.' },
    { name: 'Kim', rating: 2, text: 'Assembly took forever.' },
  ],
};

// hunterId: null → shared seed data visible to every player.
const users = [
  { id: 1, name: 'Anna Schmidt', email: 'anna@example.com', password: 'Password123', hunterId: null },
  { id: 2, name: 'Lukas Weber', email: 'lukas@example.com', password: 'Lukas!2024', hunterId: null },
  { id: 3, name: 'Mia Fischer', email: 'mia@example.com', password: 'MiaF#9988', hunterId: null },
];

const orders = [
  {
    id: 1001, userId: 2, hunterId: null, createdAt: '2026-07-03T10:15:00Z', total: 254.99,
    customer: { name: 'Lukas Weber', email: 'lukas@example.com', street: 'Hauptstraße 12', postalCode: '67655', city: 'Kaiserslautern' },
    items: [{ id: 7, name: 'Ergonomic Chair', qty: 1, price: 249 }], cardLast4: '4242',
  },
  {
    id: 1002, userId: 3, hunterId: null, createdAt: '2026-08-21T16:40:00Z', total: 134.97,
    customer: { name: 'Mia Fischer', email: 'mia@example.com', street: 'Rheinallee 5', postalCode: '56068', city: 'Koblenz' },
    items: [{ id: 3, name: 'Noise-Cancelling Headphones', qty: 1, price: 129 }, { id: 9, name: 'Notebook Set', qty: 1, price: 9.99 }], cardLast4: '1881',
  },
  {
    id: 1003, userId: 1, hunterId: null, createdAt: '2026-09-15T09:05:00Z', total: 59.98,
    customer: { name: 'Anna Schmidt', email: 'anna@example.com', street: 'Domkloster 4', postalCode: '50667', city: 'Köln' },
    items: [{ id: 1, name: 'Wireless Mouse', qty: 1, price: 24.99 }, { id: 4, name: 'USB-C Hub', qty: 1, price: 34.99 }], cardLast4: '0005',
  },
];

function flashSaleEnd() {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  d.setHours(23, 59, 59, 0);
  return d;
}

const coupons = {
  WELCOME10: { percent: 10, expires: null },
  FLASH20: { percent: 20, get expires() { return flashSaleEnd(); } },
};

module.exports = { products, seedReviews, users, orders, coupons };
