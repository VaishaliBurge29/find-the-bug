const path = require('path');
const express = require('express');
const shop = require('./shop');
const hunt = require('./hunt');

const app = express();
app.use(express.json({ limit: '20kb' }));

// Every browser gets a random player id (stored in localStorage) that scopes its data.
app.use((req, res, next) => {
  const id = req.get('x-hunter-id') || '';
  req.hunterId = /^[a-z0-9-]{8,64}$/i.test(id) ? id : 'anonymous';
  next();
});

app.use('/api/hunt', hunt);
app.use('/api', shop);
app.use(express.static(path.join(__dirname, '..', 'public')));

// 🐞 Leaks internal details on purpose (see bug #13).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`🐞 BugHunt Shop running on http://localhost:${port}`));
}

module.exports = app;
