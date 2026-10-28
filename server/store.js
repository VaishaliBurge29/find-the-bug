// Tiny JSON-file store for players. Good enough for a training game.
const fs = require('fs');
const path = require('path');

const FILE = process.env.HUNTERS_FILE || path.join(__dirname, '..', 'data', 'hunters.json');

let db = { hunters: {} };
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  // first run — start empty
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function getHunter(id) {
  return db.hunters[id] || null;
}

function upsertHunter(id, nickname) {
  if (!db.hunters[id]) {
    db.hunters[id] = { id, nickname, score: 0, found: [], wrong: 0, hints: [], joinedAt: new Date().toISOString() };
  } else {
    db.hunters[id].nickname = nickname;
  }
  save();
  return db.hunters[id];
}

function allHunters() {
  return Object.values(db.hunters);
}

module.exports = { getHunter, upsertHunter, allHunters, save };
