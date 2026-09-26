import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DB_FILE = path.join(__dirname, 'db.json');

function getOffsetDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

// Default Indian Household Initial Database
const INITIAL_DB = {
  wasteLogs: [
    { id: 'log-1', name: 'Leftover Rice & Curry', category: 'Cooked Meals', quantity: '2 bowls', cost: 80.00, reason: 'Cooked too much food', date: '2026-09-21' },
    { id: 'log-2', name: 'Extra Chapati / Rotis', category: 'Rotis & Bread', quantity: '4 roties', cost: 40.00, reason: 'Cooked too much food', date: '2026-09-19' },
    { id: 'log-3', name: 'Sour Dahi / Curd', category: 'Dairy', quantity: '250g', cost: 45.00, reason: 'Food spoils before consume', date: '2026-09-17' },
    { id: 'log-4', name: 'Wilted Palak (Spinach)', category: 'Vegetables', quantity: '1 bunch', cost: 30.00, reason: 'Food spoils before consume', date: '2026-09-14' },
    { id: 'log-5', name: 'Expired Milk Packet', category: 'Dairy', quantity: '500 ml', cost: 32.00, reason: 'Expired food', date: '2026-09-10' }
  ],
  expiryItems: [
    { id: 'exp-1', name: 'Fresh Dahi (Curd)', category: 'Dairy', quantity: '400g', expiryDate: getOffsetDate(1) },
    { id: 'exp-2', name: 'Paneer Pack', category: 'Dairy', quantity: '200g', expiryDate: getOffsetDate(0) },
    { id: 'exp-3', name: 'Amul Milk Packet', category: 'Dairy', quantity: '1 L', expiryDate: getOffsetDate(2) },
    { id: 'exp-4', name: 'Cooked Mixed Sabzi', category: 'Cooked Meals', quantity: '1 bowl', expiryDate: getOffsetDate(1) },
    { id: 'exp-5', name: 'Fresh Dhaniya & Chillies', category: 'Vegetables', quantity: '100g', expiryDate: getOffsetDate(4) },
    { id: 'exp-6', name: 'Atta Dough Ball', category: 'Rotis & Bread', quantity: '1 bowl', expiryDate: getOffsetDate(1) }
  ],
  groceryList: [
    { id: 'groc-1', name: 'Whole Wheat Atta (5kg)', category: 'Pantry', bought: false, estPrice: 240 },
    { id: 'groc-2', name: 'Toor Dal (1kg)', category: 'Pantry', bought: false, estPrice: 160 },
    { id: 'groc-3', name: 'Fresh Tomatoes (1kg)', category: 'Vegetables', bought: true, estPrice: 40 },
    { id: 'groc-4', name: 'Fresh Paneer (200g)', category: 'Dairy', bought: false, estPrice: 90 }
  ],
  userProfile: {
    ecoStreak: 7,
    lastCheckIn: new Date().toISOString().split('T')[0],
    ecoPoints: 450,
    level: 3
  },
  goals: [
    { id: 'goal-1', title: 'Keep Monthly Food Waste Under ₹500', target: 500, timeframe: 'Monthly' },
    { id: 'goal-2', title: 'Zero Wasted Sabzi This Week', target: 0, timeframe: 'Weekly' }
  ],
  practicedTips: ['tip-1', 'tip-2'],
  bookmarkedTips: ['tip-1']
};

// Load DB
function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf8');
    return INITIAL_DB;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_DB;
  }
}

// Save DB
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write to db.json:', err);
  }
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Health Check
app.get('/api/status', (req, res) => {
  const db = readDb();
  res.json({
    status: 'online',
    appName: 'Savebite Backend API',
    totalLogs: db.wasteLogs.length,
    pantryItems: db.expiryItems.length,
    groceryItems: db.groceryList.length,
    userProfile: db.userProfile,
    serverTime: new Date().toISOString()
  });
});

// GET /api/state (Full state sync)
app.get('/api/state', (req, res) => {
  const db = readDb();
  res.json(db);
});

// GET /api/logs
app.get('/api/logs', (req, res) => {
  const db = readDb();
  const totalCost = db.wasteLogs.reduce((sum, log) => sum + (parseFloat(log.cost) || 0), 0);
  res.json({
    logs: db.wasteLogs,
    totalCost,
    totalItems: db.wasteLogs.length
  });
});

// POST /api/logs
app.post('/api/logs', (req, res) => {
  const db = readDb();
  const { name, category, cost, quantity, reason, date } = req.body;

  if (!name || cost === undefined || cost === null) {
    return res.status(400).json({ error: 'Name and cost are required' });
  }

  const newLog = {
    id: 'log-' + Date.now(),
    name: name.trim(),
    category: category || 'Cooked Meals',
    cost: parseFloat(cost) || 0,
    quantity: quantity || '1 portion',
    reason: reason || 'Cooked too much food',
    date: date || new Date().toISOString().split('T')[0]
  };

  db.wasteLogs.unshift(newLog);
  writeDb(db);
  res.status(201).json(newLog);
});

// DELETE /api/logs/:id
app.delete('/api/logs/:id', (req, res) => {
  const db = readDb();
  db.wasteLogs = db.wasteLogs.filter(l => l.id !== req.params.id);
  writeDb(db);
  res.json({ success: true, remaining: db.wasteLogs.length });
});

// GET /api/expiry
app.get('/api/expiry', (req, res) => {
  const db = readDb();
  const today = new Date();
  today.setHours(0,0,0,0);

  const processed = db.expiryItems.map(item => {
    const expDate = new Date(item.expiryDate);
    expDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    
    let status = 'FRESH';
    if (diffDays <= 0) status = 'URGENT';
    else if (diffDays <= 3) status = 'SOON';

    return { ...item, diffDays, status };
  });

  res.json(processed);
});

// POST /api/expiry
app.post('/api/expiry', (req, res) => {
  const db = readDb();
  const { name, category, quantity, expiryDate } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  const newItem = {
    id: 'exp-' + Date.now(),
    name: name.trim(),
    category: category || 'Dairy',
    quantity: quantity || '1 pack',
    expiryDate: expiryDate || getOffsetDate(3)
  };

  db.expiryItems.unshift(newItem);
  writeDb(db);
  res.status(201).json(newItem);
});

// PUT /api/expiry/:id/eat
app.put('/api/expiry/:id/eat', (req, res) => {
  const db = readDb();
  db.expiryItems = db.expiryItems.filter(i => i.id !== req.params.id);
  db.userProfile.ecoPoints = (db.userProfile.ecoPoints || 0) + 15;
  writeDb(db);
  res.json({ success: true, points: db.userProfile.ecoPoints });
});

// DELETE /api/expiry/:id
app.delete('/api/expiry/:id', (req, res) => {
  const db = readDb();
  db.expiryItems = db.expiryItems.filter(i => i.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// GET /api/grocery
app.get('/api/grocery', (req, res) => {
  const db = readDb();
  res.json(db.groceryList);
});

// POST /api/grocery
app.post('/api/grocery', (req, res) => {
  const db = readDb();
  const { name, category, estPrice } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Item name is required' });
  }

  const duplicatePantry = db.expiryItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()));

  const newItem = {
    id: 'groc-' + Date.now(),
    name: name.trim(),
    category: category || 'Pantry',
    bought: false,
    estPrice: parseFloat(estPrice) || 50,
    duplicateWarning: !!duplicatePantry
  };

  db.groceryList.unshift(newItem);
  writeDb(db);
  res.status(201).json(newItem);
});

// PUT /api/grocery/:id/toggle
app.put('/api/grocery/:id/toggle', (req, res) => {
  const db = readDb();
  const item = db.groceryList.find(g => g.id === req.params.id);
  if (item) {
    item.bought = !item.bought;
    writeDb(db);
  }
  res.json(item || {});
});

// DELETE /api/grocery/bought
app.delete('/api/grocery/bought', (req, res) => {
  const db = readDb();
  db.groceryList = db.groceryList.filter(g => !g.bought);
  writeDb(db);
  res.json({ success: true });
});

// DELETE /api/grocery/:id
app.delete('/api/grocery/:id', (req, res) => {
  const db = readDb();
  db.groceryList = db.groceryList.filter(g => g.id !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

// GET /api/daily-meal-plan (Zero-Waste Daily Meal Schedule)
app.get('/api/daily-meal-plan', (req, res) => {
  const db = readDb();
  const today = new Date();
  today.setHours(0,0,0,0);

  const urgentItems = db.expiryItems.filter(item => {
    const expDate = new Date(item.expiryDate);
    expDate.setHours(0,0,0,0);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  });

  const plan = {
    date: new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }),
    breakfast: {
      dish: 'Roti Cutlets / Idli Upma',
      usesItems: urgentItems.filter(i => i.category === 'Rotis & Bread' || i.name.toLowerCase().includes('roti') || i.name.toLowerCase().includes('idli')).map(i => i.name),
      prepTime: '12 mins',
      tip: 'Toss leftover stale roties or idlis with mustard seeds, curry leaves & turmeric.'
    },
    lunch: {
      dish: 'Phodnicha Bhaat & Tadka Dal Shorba',
      usesItems: urgentItems.filter(i => i.category === 'Cooked Meals' || i.name.toLowerCase().includes('rice') || i.name.toLowerCase().includes('dal')).map(i => i.name),
      prepTime: '15 mins',
      tip: 'Re-heat leftover rice with peanuts and curry leaves for fluffy fried rice.'
    },
    snack: {
      dish: 'Fresh Dahi Lassi / Fruit Chaat',
      usesItems: urgentItems.filter(i => i.category === 'Dairy' || i.category === 'Vegetables').map(i => i.name),
      prepTime: '5 mins',
      tip: 'Whisk slightly sour curd with sugar & cardamom for instant refreshing Lassi.'
    },
    dinner: {
      dish: 'Mix-Veg Stuffed Parathas with Paneer Bhurji',
      usesItems: urgentItems.filter(i => i.name.toLowerCase().includes('paneer') || i.category === 'Vegetables').map(i => i.name),
      prepTime: '20 mins',
      tip: 'Crumble expiring paneer into quick Bhurji with onions and tomatoes.'
    }
  };

  res.json(plan);
});

// POST /api/streak/check-in
app.post('/api/streak/check-in', (req, res) => {
  const db = readDb();
  const todayStr = new Date().toISOString().split('T')[0];

  if (db.userProfile.lastCheckIn !== todayStr) {
    db.userProfile.ecoStreak = (db.userProfile.ecoStreak || 0) + 1;
    db.userProfile.ecoPoints = (db.userProfile.ecoPoints || 0) + 50;
    db.userProfile.lastCheckIn = todayStr;
    writeDb(db);
  }

  res.json({
    success: true,
    streak: db.userProfile.ecoStreak,
    points: db.userProfile.ecoPoints
  });
});

// GET /api/goals
app.get('/api/goals', (req, res) => {
  const db = readDb();
  res.json(db.goals || []);
});

// POST /api/goals
app.post('/api/goals', (req, res) => {
  const db = readDb();
  const { title, target, timeframe } = req.body;
  const newGoal = {
    id: 'goal-' + Date.now(),
    title: title.trim(),
    target: parseFloat(target) || 500,
    timeframe: timeframe || 'Monthly'
  };
  db.goals = db.goals || [];
  db.goals.push(newGoal);
  writeDb(db);
  res.status(201).json(newGoal);
});

// POST /api/reset
app.post('/api/reset', (req, res) => {
  writeDb(INITIAL_DB);
  res.json({ success: true, db: INITIAL_DB });
});

// Start Server
app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🌱 Savebite Indian Full-Stack REST API Server Running!`);
  console.log(`🔗 Local URL: http://localhost:${PORT}`);
  console.log(`📊 Health Check: http://localhost:${PORT}/api/status`);
  console.log(`===================================================`);
});
