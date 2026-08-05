const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const { Company, Setting, Ledger, SEED } = require('./models/Ledger');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const isServerless = Boolean(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = isServerless ? path.join(os.tmpdir(), 'data') : path.join(__dirname, 'data');
const LOCAL_LEDGER_FILE = path.join(DATA_DIR, 'ledger.json');
let useMongo = false;

const ensureLocalLedger = async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(LOCAL_LEDGER_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(LOCAL_LEDGER_FILE, JSON.stringify(SEED, null, 2), 'utf8');
      return SEED;
    }
    throw err;
  }
};

const saveLocalLedger = async ({ ownCompany, companies }) => {
  const doc = { key: 'main', ownCompany, companies };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOCAL_LEDGER_FILE, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
};

const getLedger = async () => {
  if (useMongo) {
    // 1. Auto-migration: check if old single Ledger document exists and migrate companies to individual Company documents
    try {
      const oldLedger = await Ledger.findOne({ key: 'main' });
      if (oldLedger && Array.isArray(oldLedger.companies) && oldLedger.companies.length > 0) {
        for (const comp of oldLedger.companies) {
          if (comp && comp.id) {
            await Company.findOneAndUpdate(
              { id: comp.id },
              { $set: { id: comp.id, name: comp.name, gstin: comp.gstin || '', entries: comp.entries || [] } },
              { upsert: true, new: true }
            );
          }
        }
        await Ledger.updateOne({ key: 'main' }, { $unset: { companies: "" } });
      }
    } catch (_) {}

    // 2. Fetch setting for ownCompany
    let setting = await Setting.findOne({ key: 'main' });
    if (!setting) {
      setting = await Setting.create({ key: 'main', ownCompany: SEED.ownCompany });
    }

    // 3. Fetch all separate company documents
    let companies = await Company.find({}).sort({ createdAt: 1 }).lean();
    if (companies.length === 0 && SEED.companies && SEED.companies.length > 0) {
      await Company.insertMany(SEED.companies);
      companies = await Company.find({}).sort({ createdAt: 1 }).lean();
    }

    return {
      ownCompany: setting.ownCompany || SEED.ownCompany,
      companies
    };
  }
  return ensureLocalLedger();
};

const upsertLedger = async ({ ownCompany, companies }) => {
  if (useMongo) {
    if (ownCompany) {
      await Setting.findOneAndUpdate(
        { key: 'main' },
        { $set: { ownCompany } },
        { new: true, upsert: true }
      );
    }

    if (Array.isArray(companies)) {
      const activeIds = [];
      for (const comp of companies) {
        if (!comp || !comp.id) continue;
        activeIds.push(comp.id);
        await Company.findOneAndUpdate(
          { id: comp.id },
          { $set: { id: comp.id, name: comp.name, gstin: comp.gstin || '', entries: comp.entries || [] } },
          { new: true, upsert: true }
        );
      }

      // Delete companies removed by user
      await Company.deleteMany({ id: { $nin: activeIds } });
    }

    const updatedCompanies = await Company.find({}).sort({ createdAt: 1 }).lean();
    const setting = await Setting.findOne({ key: 'main' });

    return {
      ownCompany: (setting && setting.ownCompany) || ownCompany || SEED.ownCompany,
      companies: updatedCompanies
    };
  }
  return saveLocalLedger({ ownCompany, companies });
};

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`🚀 SKGS Ledger server running at http://localhost:${PORT}`);
  });
};

const isValidMongoUri = (uri) => /^mongodb(\+srv)?:\/\//.test(uri);

const initialize = async () => {
  app.use(express.json({ limit: '2mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  if (MONGODB_URI) {
    if (!isValidMongoUri(MONGODB_URI)) {
      console.error('❌ Invalid MONGODB_URI. It should start with mongodb:// or mongodb+srv://');
    }

    try {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
      } catch (_) {}
      await mongoose.connect(MONGODB_URI);
      useMongo = true;
      console.log('✅ Connected to MongoDB Atlas');
    } catch (err) {
      console.error('❌ MongoDB connection error:', err.message);
      console.warn('⚠️ Starting server with local JSON fallback instead of MongoDB.');
    }
  } else {
    console.warn('⚠️ MONGODB_URI is not set. Starting server with local JSON fallback storage.');
  }

  await ensureLocalLedger();
  if (require.main === module) {
    startServer();
  }
};

initialize();

const router = express.Router();

// GET the whole ledger (all companies + their bills).
// Creates the document with starter seed data on first run.
router.get('/ledger', async (req, res) => {
  try {
    const doc = await getLedger();
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (upsert) the whole ledger. The frontend sends the full
// { ownCompany, companies: [...] } object on every change.
router.put('/ledger', async (req, res) => {
  try {
    const { ownCompany, companies } = req.body;
    if (!Array.isArray(companies)) {
      return res.status(400).json({ error: 'companies must be an array' });
    }
    const doc = await upsertLedger({ ownCompany, companies });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple health check, handy for hosting platforms
router.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', router);
app.use('/.netlify/functions/api', router);

// Fallback: send index.html for any other route (so the PWA
// works even if someone refreshes on a deep link)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;
module.exports.handler = require('serverless-http')(app);
